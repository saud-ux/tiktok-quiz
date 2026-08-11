import React, { createContext, useContext, useReducer, useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { getSocket } from './services/socket';
import { getOrCreatePid, savePlayer, getSavedPlayer, clearPlayer } from './services/storage';
import { playSound, initAudio } from './services/sounds';
import { ABILITY_CAT_MAP } from './constants/abilities';

const GameContext = createContext(null);

const initialState = {
  screen: 'join',
  myId: null,
  myName: '',
  myAvatar: null,
  myPoints: 0,
  myStreak: 0,
  myAbilities: { attack: null, defense: null, general: null },
  abilitiesState: { attack: false, defense: false, general: false },
  myBonusAbility: null,
  allPlayers: {},
  currentQ: null,
  questionActive: false,
  hasAnswered: false,
  myAnswer: null,
  isCut: false,
  shuffleMap: null,
  hasUsedLastSecond: false,
  jokerUsed: false,
  orderArr: [],
  questionTime: 20,
  timeLeft: 20,
  isLastQuestion: false,

  // Overlays
  frozenClicksLeft: 0,
  showFrozen: false,
  showPreQ: false,
  preQAbilities: [],
  showTargetModal: false,
  targetModalTitle: '',
  targetModalCallback: null,
  showStoreVote: false,
  storeVoteData: { yes: 0, no: 0, voted: 0, total: 0, secsLeft: 15 },
  storeVoted: false,
  showStore: false,
  storeItems: [],
  storeDuration: 30,
  storePurchased: {},

  // Results
  lastResult: null,
  lastLeaderboard: [],
  lastQuestionLeaderboard: [],
  finalData: null,

  // Notifications
  toast: null,
  attackHit: null,
  reverseOffer: null,
  hintText: null,
  eliminatedOptions: [],
  showLastQAnnouncement: false,
  newLeaderName: null,
  revealSequence: null,
  lbReveal: null,
  tripleBoost: false,
  retryAvailable: false,
  revivalAvailable: false,
  spyResult: null,

  connected: false,
  _joinName: '',
  _joinAvatar: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET': return { ...state, ...action.payload };
    case 'SET_PLAYER': {
      const ps = { ...state.allPlayers };
      action.payload.forEach(p => { ps[p.id] = p; });
      return { ...state, allPlayers: ps };
    }
    case 'REPLACE_PLAYERS': {
      const ps = {};
      action.payload.forEach(p => { ps[p.id] = p; });
      return { ...state, allPlayers: ps };
    }
    case 'TOAST': return { ...state, toast: action.payload };
    case 'CLEAR_TOAST': return { ...state, toast: null };
    case 'RESET': return { ...initialState, connected: state.connected };
    default: return state;
  }
}

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const socketRef = useRef(null);
  const toastTimerRef = useRef(null);
  const storeTimerRef = useRef(null);
  const preQTimerRef = useRef(null);
  const reverseTimerRef = useRef(null);
  const storeVoteTimerRef = useRef(null);

  const set = useCallback((payload) => dispatch({ type: 'SET', payload }), []);

  const toast = useCallback((msg, color = '', dur = 3500) => {
    clearTimeout(toastTimerRef.current);
    dispatch({ type: 'TOAST', payload: { msg, color } });
    toastTimerRef.current = setTimeout(() => dispatch({ type: 'CLEAR_TOAST' }), dur);
  }, []);

  useEffect(() => {
    initAudio();
    const socket = getSocket();
    socketRef.current = socket;

    socket.on('connect', async () => {
      set({ connected: true });
      const pid = await getOrCreatePid().catch(() => null);
      const saved = await getSavedPlayer().catch(() => null);
      if (pid && saved) {
        socket.emit('player:join', { ...saved, persistentId: pid });
      }
    });

    socket.on('disconnect', () => set({ connected: false }));

    socket.on('game:state', (data) => {
      dispatch({ type: 'REPLACE_PLAYERS', payload: data.players });
    });

    socket.on('player:joined', async ({ id, player }) => {
      set({
        myId: id,
        myName: player.name,
        myAvatar: player.avatar,
        myPoints: player.points || 0,
        myStreak: player.streak || 0,
        myAbilities: {
          attack: player.abilities.attack.type,
          defense: player.abilities.defense.type,
          general: player.abilities.general.type,
        },
        abilitiesState: { attack: false, defense: false, general: false },
        screen: 'lobby',
      });
      await savePlayer({
        name: player.name,
        avatar: player.avatar,
        abilities: {
          attack: player.abilities.attack.type,
          defense: player.abilities.defense.type,
          general: player.abilities.general.type,
        },
      }).catch(() => {});
    });

    socket.on('player:rejoined', ({ id, player, active, question, timeLeft, questionTime, storeVoteActive, storeVoteSecsLeft, storeVoteTally, alreadyVoted }) => {
      const updates = {
        myId: id,
        myName: player.name,
        myAvatar: player.avatar,
        myPoints: player.points,
        myStreak: player.streak,
        myAbilities: {
          attack: player.abilities.attack.type,
          defense: player.abilities.defense.type,
          general: player.abilities.general.type,
        },
        abilitiesState: {
          attack: player.abilities.attack.used,
          defense: player.abilities.defense.used,
          general: player.abilities.general.used,
        },
      };

      if (active && question) {
        Object.assign(updates, {
          screen: 'game',
          currentQ: question,
          questionActive: true,
          timeLeft,
          questionTime: questionTime || 20,
          hasAnswered: false,
          isCut: false,
          shuffleMap: null,
        });
      } else {
        updates.screen = 'lobby';
      }

      set(updates);

      if (storeVoteActive) {
        set({
          showStoreVote: true,
          storeVoted: alreadyVoted || false,
          storeVoteData: storeVoteTally || { yes: 0, no: 0, voted: 0, total: 0, secsLeft: storeVoteSecsLeft || 0 },
        });
      }

      toast('✅ تم إعادة الاتصال', 'green');
    });

    socket.on('game:players-update', (ps) => {
      dispatch({ type: 'REPLACE_PLAYERS', payload: ps });
    });

    socket.on('game:leaderboard', (lb) => {
      // Update points/streak from leaderboard
    });

    socket.on('game:pre-question', ({ abilities }) => {
      set({ showPreQ: true, preQAbilities: abilities });
    });

    socket.on('game:waiting-pre-question', () => {
      // Show a waiting indicator
    });

    socket.on('game:question-start', ({ question, isLastQuestion, questionTime: qt }) => {
      set({
        screen: 'game',
        currentQ: question,
        questionActive: true,
        hasAnswered: false,
        myAnswer: null,
        isCut: false,
        shuffleMap: null,
        orderArr: question.type === 'order' ? question.options.map((_, i) => i) : [],
        questionTime: qt || 20,
        timeLeft: qt || 20,
        isLastQuestion: isLastQuestion || false,
        showPreQ: false,
        showFrozen: false,
        frozenClicksLeft: 0,
        hintText: null,
        eliminatedOptions: [],
        retryAvailable: false,
        revivalAvailable: false,
        revealSequence: null,
        lbReveal: null,
      });
      if (isLastQuestion) {
        toast('🔥 السؤال الأخير! المركز الأخير يحصل على ×3', 'gold', 5000);
      }
    });

    socket.on('game:timer', (t) => {
      set({ timeLeft: t });
      if (t <= 5 && t > 0) playSound('tick');
      if (t <= 0) playSound('buzzer');
    });

    socket.on('game:answer-progress', ({ answered, total }) => {
      // Could update a progress indicator
    });

    socket.on('player:answer-accepted', ({ choice, correct, isRetry, isLastSecond, isOrder, isText }) => {
      if (correct) playSound('correct');
      else playSound('wrong');
      if (isOrder) {
        toast(correct ? '✅ ترتيبك صحيح!' : '❌ ترتيب خاطئ', correct ? 'green' : 'red');
      } else if (isText) {
        toast(correct ? '✅ إجابة صحيحة!' : '❌ إجابة خاطئة', correct ? 'green' : 'red');
      } else if (!isRetry) {
        const msg = isLastSecond
          ? (correct ? '⚡ غيّرت وأجبت صح! ✅' : '⚡ غيّرت وأجبت غلط ❌')
          : (correct ? '✅ إجابة صحيحة!' : '❌ إجابة خاطئة');
        toast(msg, correct ? 'green' : 'red');
      }
    });

    socket.on('game:retry-available', () => {
      set({ retryAvailable: true });
    });

    socket.on('game:revival-available', () => {
      set({ revivalAvailable: true });
    });

    socket.on('game:reveal-sequence', ({ sequence }) => {
      set({ revealSequence: sequence });
      playSound('reveal');
    });

    socket.on('game:question-end', (data) => {
      set({
        questionActive: false,
        isCut: false,
        showFrozen: false,
        frozenClicksLeft: 0,
        lastResult: data,
        lastLeaderboard: data.leaderboard || [],
        lastQuestionLeaderboard: data.questionLeaderboard || [],
        retryAvailable: false,
        revivalAvailable: false,
        revealSequence: null,
      });
      // Show results after a brief delay to let reveal finish
      setTimeout(() => {
        set({
          screen: 'result',
          lbReveal: data.leaderboard || [],
        });
      }, stateRef.current.revealSequence ? 2800 : 500);
    });

    socket.on('game:final', ({ top3, leaderboard: lb }) => {
      set({
        screen: 'final',
        finalData: { top3, leaderboard: lb },
      });
      playSound('reveal');
    });

    socket.on('game:notify', ({ type, msg }) => {
      const colorMap = {
        'shield-active': 'green', 'ability-active': 'gold', 'revival-active': 'green',
        'holed': 'red', 'attack-reflected': 'gold', 'reverse-fired': 'green',
        'immunity-saved': 'green', 'cut-active': 'red', 'frozen-active': 'red',
        'hole-incoming': 'gold', 'frozen-incoming': 'red', 'cut-incoming': 'red',
        'blur-incoming': 'red', 'blur-success': 'gold', 'error': 'red',
        'theft-success': 'gold', 'theft-failed': 'red',
      };
      toast(msg, colorMap[type] || '');

      if (['cut-active', 'cut-incoming', 'frozen-incoming', 'frozen-active', 'hole-incoming', 'blur-incoming'].includes(type)) {
        const iconMap = { 'cut-active': '✂️', 'cut-incoming': '✂️', 'frozen-active': '❄️', 'frozen-incoming': '❄️', 'hole-incoming': '🕳️', 'blur-incoming': '🌀' };
        set({ attackHit: { icon: iconMap[type] || '⚔️', msg } });
        playSound('attackHit');
        setTimeout(() => set({ attackHit: null }), 1800);
      }

      if (type === 'cut-active' || type === 'escaped-active') {
        set({ isCut: true });
      }

      if (type === 'frozen-active') {
        set({ showFrozen: true, frozenClicksLeft: 15, isCut: true });
      }
    });

    socket.on('ability:result', ({ type, status }) => {
      const cat = ABILITY_CAT_MAP[type];

      if (status === 'reflected') {
        toast('🔄 هجومك انعكس! الخاصية لم تُستهلك', 'gold', 3000);
        return;
      }
      if (status === 'blocked') {
        toast('🛡️ الهدف محصّن! الخاصية لم تُستهلك', 'gold', 3000);
        return;
      }

      if (cat) {
        set({ abilitiesState: { ...stateRef.current.abilitiesState, [cat]: true } });
      }
    });

    socket.on('game:hint', ({ hint }) => {
      set({ hintText: hint });
    });

    socket.on('game:bonus-ability', ({ type, icon, name, desc }) => {
      set({ myBonusAbility: { type, icon, name, desc, used: false } });
      playSound('bonusChime');
      toast(`🎁 خاصية مجانية: ${name}`, 'gold', 4000);
    });

    socket.on('game:shuffle-options', ({ shuffle, attackerName }) => {
      set({ shuffleMap: shuffle });
      playSound('attackHit');
      toast(`🌀 ${attackerName} أربك خياراتك!`, 'red');
    });

    socket.on('game:spy-result', ({ targetName, choiceText, correct, changed }) => {
      const tag = changed ? ' (غيّر إجابته)' : '';
      toast(`🔍 ${targetName} اختار: "${choiceText}" ${correct ? '✅' : '❌'}${tag}`, correct ? 'gold' : 'red', 5000);
    });

    socket.on('game:joker-result', ({ eliminated }) => {
      set({ jokerUsed: true, eliminatedOptions: eliminated });
      toast('🃏 تم حذف خياران خاطئان!', 'gold', 3000);
    });

    socket.on('game:new-leader', ({ name }) => {
      set({ newLeaderName: name });
      playSound('reveal');
      setTimeout(() => set({ newLeaderName: null }), 3500);
    });

    socket.on('game:last-question-announcement', () => {
      set({ showLastQAnnouncement: true, isLastQuestion: true });
      playSound('lastQuestion');
      setTimeout(() => set({ showLastQAnnouncement: false }), 4000);
    });

    socket.on('game:triple-boost', () => {
      set({ tripleBoost: true });
      setTimeout(() => set({ tripleBoost: false }), 4000);
    });

    socket.on('game:reverse-offer', ({ attackerName, type }) => {
      set({ reverseOffer: { attackerName, type, secsLeft: 5 } });
      clearInterval(reverseTimerRef.current);
      let secs = 5;
      reverseTimerRef.current = setInterval(() => {
        secs--;
        if (secs <= 0) {
          clearInterval(reverseTimerRef.current);
          set({ reverseOffer: null });
        } else {
          set({ reverseOffer: { attackerName, type, secsLeft: secs } });
        }
      }, 1000);
    });

    socket.on('game:store-open', ({ items, duration }) => {
      set({ showStore: true, storeItems: items, storeDuration: duration, storePurchased: {} });
      playSound('bonusChime');
      toast('🛒 المتجر مفتوح! اشترِ ميزة للسؤال القادم', 'gold', 4000);
    });

    socket.on('game:store-closed', () => {
      set({ showStore: false });
      toast('🔒 أُغلق المتجر', '', 2000);
    });

    socket.on('game:store-purchased', ({ itemId, newPoints, cost }) => {
      set({
        myPoints: newPoints,
        storePurchased: { ...stateRef.current.storePurchased, [itemId]: true },
      });
      playSound('bonusChime');
      toast(`✅ تم الشراء (−${cost} نقطة)`, 'green', 2500);
    });

    socket.on('game:eliminate-option', ({ eliminate }) => {
      set({ eliminatedOptions: [...(stateRef.current.eliminatedOptions || []), eliminate] });
      toast('🗑️ تم حذف خيار خاطئ تلقائياً!', 'gold', 3000);
    });

    socket.on('game:store-vote-start', ({ duration }) => {
      set({
        showStoreVote: true,
        storeVoted: false,
        storeVoteData: { yes: 0, no: 0, voted: 0, total: 0, secsLeft: duration },
      });
      clearInterval(storeVoteTimerRef.current);
      let secs = duration;
      storeVoteTimerRef.current = setInterval(() => {
        secs--;
        if (secs <= 0) clearInterval(storeVoteTimerRef.current);
        set({
          storeVoteData: { ...stateRef.current.storeVoteData, secsLeft: Math.max(0, secs) },
        });
      }, 1000);
    });

    socket.on('game:store-vote-tally', ({ yes, no, voted, total }) => {
      set({ storeVoteData: { ...stateRef.current.storeVoteData, yes, no, voted, total } });
    });

    socket.on('game:store-vote-result', ({ open }) => {
      clearInterval(storeVoteTimerRef.current);
      set({ showStoreVote: false });
      toast(open ? '✅ صوّت الجمهور: المتجر يفتح! 🛒' : '❌ صوّت الجمهور: المتجر مغلق', open ? 'gold' : 'red', 3000);
    });

    socket.on('game:kicked', async () => {
      set({
        myId: null, myPoints: 0, myStreak: 0,
        abilitiesState: { attack: false, defense: false, general: false },
        questionActive: false, myBonusAbility: null,
        screen: 'join',
      });
      dispatch({ type: 'REPLACE_PLAYERS', payload: [] });
      await clearPlayer().catch(() => {});
      toast('🚫 تم طردك من اللعبة من قبل الهوست', 'red', 5000);
    });

    socket.on('game:reset', async () => {
      dispatch({ type: 'RESET' });
      await clearPlayer().catch(() => {});
    });

    // Handle app going to background during a question
    const appStateSub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState !== 'active' && stateRef.current.questionActive) {
        socket.emit('player:question-escape');
      }
    });

    return () => {
      appStateSub?.remove();
      socket.removeAllListeners();
      clearTimeout(toastTimerRef.current);
      clearTimeout(storeTimerRef.current);
      clearInterval(preQTimerRef.current);
      clearInterval(reverseTimerRef.current);
      clearInterval(storeVoteTimerRef.current);
    };
  }, []);

  // Keep points/streak in sync with allPlayers
  useEffect(() => {
    if (state.myId && state.allPlayers[state.myId]) {
      const me = state.allPlayers[state.myId];
      if (me.points !== state.myPoints || me.streak !== state.myStreak) {
        set({ myPoints: me.points, myStreak: me.streak });
      }
    }
  }, [state.allPlayers, state.myId]);

  const actions = {
    set,
    toast,
    emit: (event, data) => socketRef.current?.emit(event, data),
    joinGame: async (name, avatar, abilities) => {
      const pid = await getOrCreatePid();
      socketRef.current?.emit('player:join', { name, avatar, abilities, persistentId: pid });
    },
    submitAnswer: (choice) => {
      const s = stateRef.current;
      const actualChoice = s.shuffleMap ? s.shuffleMap[choice] : choice;
      socketRef.current?.emit('player:answer', { choice: actualChoice });
      set({ hasAnswered: true, myAnswer: choice });
    },
    submitOrderAnswer: (orderArr) => {
      socketRef.current?.emit('player:answer', { orderAnswer: orderArr });
      set({ hasAnswered: true });
      toast('📤 تم إرسال ترتيبك!', 'gold');
    },
    submitTextAnswer: (text) => {
      socketRef.current?.emit('player:answer', { textAnswer: text });
      set({ hasAnswered: true });
    },
    useAbility: (category, targetId) => {
      socketRef.current?.emit('player:use-ability', { category, targetId });
    },
    useJoker: () => {
      socketRef.current?.emit('player:use-joker');
    },
    useBonus: () => {
      socketRef.current?.emit('player:use-ability', { category: 'bonus' });
      set({ myBonusAbility: { ...stateRef.current.myBonusAbility, used: true } });
    },
    useRetry: () => {
      set({ hasAnswered: false, retryAvailable: false, abilitiesState: { ...stateRef.current.abilitiesState, defense: true } });
      toast('↩️ اختر إجابتك!', 'gold');
    },
    useRevival: () => {
      socketRef.current?.emit('player:use-revival');
      set({ revivalAvailable: false, abilitiesState: { ...stateRef.current.abilitiesState, general: true } });
    },
    breakIce: () => {
      const left = stateRef.current.frozenClicksLeft - 1;
      set({ frozenClicksLeft: left });
      if (left <= 0) {
        socketRef.current?.emit('player:break-ice');
        setTimeout(() => set({ showFrozen: false, isCut: false }), 200);
      }
    },
    preQuestionDecision: (use, category, type, targetId) => {
      socketRef.current?.emit('player:pre-question-decision', { use, category, type, targetId });
      set({ showPreQ: false });
      if (use && category) {
        set({ abilitiesState: { ...stateRef.current.abilitiesState, [category]: true } });
      }
    },
    reverseDecision: (use) => {
      clearInterval(reverseTimerRef.current);
      set({ reverseOffer: null });
      socketRef.current?.emit('player:reverse-decision', { use });
      if (use) {
        set({ abilitiesState: { ...stateRef.current.abilitiesState, defense: true } });
      }
    },
    castStoreVote: (vote) => {
      set({ storeVoted: true });
      socketRef.current?.emit('player:store-vote', { vote });
    },
    buyStoreItem: (itemId) => {
      socketRef.current?.emit('player:buy-store-item', { itemId });
    },
    changeAnswer: (choice) => {
      const s = stateRef.current;
      const actualChoice = s.shuffleMap ? s.shuffleMap[choice] : choice;
      socketRef.current?.emit('player:change-answer', { choice: actualChoice });
      set({ hasAnswered: true, hasUsedLastSecond: true, myAnswer: choice });
    },
    updateProfile: (name, avatar) => {
      socketRef.current?.emit('player:update-profile', { name, avatar });
      set({ myName: name, ...(avatar ? { myAvatar: avatar } : {}) });
    },
    goToScreen: (screen) => set({ screen }),
  };

  return (
    <GameContext.Provider value={{ state, actions, dispatch }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
