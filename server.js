const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.static(path.join(__dirname, 'public')));

function normalizeArabic(str) {
  if (!str) return '';
  return str
    .trim()
    .replace(/[ً-ٰٟ]/g, '') // strip diacritics
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/^ال/, '')
    .toLowerCase();
}

app.get('/host', (_, res) => res.sendFile(path.join(__dirname, 'public', 'host.html')));
app.get('/play', (_, res) => res.sendFile(path.join(__dirname, 'public', 'play.html')));
app.get('/leaderboard', (_, res) => res.sendFile(path.join(__dirname, 'public', 'leaderboard.html')));
app.get('/download/fusha', (_, res) => res.download(path.join(__dirname, 'public', 'question-bank-fusha.json'), 'question-bank-fusha.json'));
app.get('/download/questions', (_, res) => res.download(path.join(__dirname, 'public', 'question-bank.json'), 'question-bank.json'));

// ─────────────────────────────────────────────────────────────
// GAME STATE
// ─────────────────────────────────────────────────────────────
const DEFAULT_QUESTION_TIME = 20;

let G = newState();

function newState() {
  return {
    players: {},
    question: null,
    qNum: 0,
    active: false,
    timeLeft: DEFAULT_QUESTION_TIME,
    questionTime: DEFAULT_QUESTION_TIME,
    timerRef: null,
    answers: {},
    effects: {},
    nextEffects: {},
    retryPending: {},
    revivalPending: {},
    reverseOffers: {},
    disconnectTimers: {},
    escapedPlayers: new Set(),
    preQ: false,
    preQEligible: new Set(),
    preQResponded: new Set(),
    preQTimeout: null,
    preQDecisions: {},
    pendingQuestionStart: null,
    isLastQuestion: false,
    isDramatic: true, // ← الكشف الدرامي مفعّل افتراضياً
    jokerUsed: {},       // ← من استخدم الجوكر في هذا السؤال
    leaderId: null,      // ← معرّف المتصدر الحالي
    storeOpen: false,    // ← حالة المتجر
    storePurchases: {},  // ← مشتريات المتجر { pid: { hint, eliminate, multiplier } }
    storeTimer: null,    // ← مؤقت إغلاق المتجر
    storeVoteActive: false,
    storeVoted: new Set(),
    storeVoteYes: 0,
    storeVoteNo: 0,
    storeVoteTimer: null,
    storeVoteEndTime: 0,
    autoEndRef: null,
  };
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function findByPid(pid) {
  return Object.values(G.players).find(p => p.persistentId === pid);
}
function leaderboard() {
  return Object.values(G.players)
    .sort((a, b) => b.points - a.points)
    .map((p, i) => ({ rank: i + 1, id: p.id, name: p.name, avatar: p.avatar, points: p.points, streak: p.streak }));
}

function publicPlayers() {
  return Object.values(G.players).map(p => ({
    id: p.id, name: p.name, avatar: p.avatar, points: p.points, streak: p.streak,
    isGhost: G.effects[p.id]?.ghost || false,
  }));
}

function notify(targetId, type, msg) {
  io.to(targetId).emit('game:notify', { type, msg });
}

function checkPendingQuestionStart() {
  if (!G.pendingQuestionStart) return;
  const preQPending = Object.values(G.reverseOffers).some(o => o.preQ);
  if (!preQPending) {
    const fn = G.pendingQuestionStart;
    G.pendingQuestionStart = null;
    fn();
  }
}

// ─────────────────────────────────────────────────────────────
// APPLY ATTACK
// ─────────────────────────────────────────────────────────────
function applyAttack(attackerId, type, targetId, immediate = false, skipReverseOffer = false) {
  const attacker = G.players[attackerId];
  const target   = G.players[targetId];
  if (!target || !attacker) return { ok: false };

  const tEff = G.effects[targetId] || {};

  if (!skipReverseOffer && !G.reverseOffers[targetId]) {
    const defAb = target.abilities?.defense;
    if (defAb && defAb.type === 'reverse' && !defAb.used) {
      G.reverseOffers[targetId] = {
        attackerId, type, immediate,
        timeout: setTimeout(() => {
          delete G.reverseOffers[targetId];
          applyAttack(attackerId, type, targetId, immediate, true);
          checkPendingQuestionStart();
        }, 5000),
      };
      io.to(targetId).emit('game:reverse-offer', { attackerName: attacker.name, type });
      return { ok: true, pending: true };
    }
  }

  if (tEff.reverse) {
    tEff.reverse = false;
    if (immediate) {
      if (type === 'freeze') {
        G.effects[attackerId] = { ...(G.effects[attackerId] || {}), frozen: true };
        // ← إشعار فوري بالتأثير على المهاجم
        io.to(attackerId).emit('game:notify', { type: 'frozen-active', msg: `❄️ ${target.name} عكس هجومك! أنت مجمد الآن` });
      }
      if (type === 'cut') {
        G.effects[attackerId] = { ...(G.effects[attackerId] || {}), cut: true };
        // ← إشعار فوري بالتأثير على المهاجم
        io.to(attackerId).emit('game:notify', { type: 'cut-active', msg: `✂️ ${target.name} عكس هجومك! أنت مقطوع الآن` });
      }
    } else {
      if (type === 'freeze') G.nextEffects[attackerId] = { ...(G.nextEffects[attackerId] || {}), frozen: true };
      if (type === 'cut')    G.nextEffects[attackerId] = { ...(G.nextEffects[attackerId] || {}), cut: true };
    }
    if (type === 'hole') G.effects[targetId] = { ...(G.effects[targetId] || {}), holeTarget: attackerId };
    if (type === 'blur' && !G.answers[attackerId]) {
      const shuffle = [0,1,2,3].sort(() => Math.random() - 0.5);
      io.to(attackerId).emit('game:shuffle-options', { shuffle, attackerName: target.name });
    }
    notify(attackerId, 'attack-reflected', `🔄 ${target.name} عكس هجومك!`);
    notify(targetId,   'reverse-fired',    '🔄 درع الانعكاس انطلق على المهاجم!');
    return { ok: true, reflected: true };
  }

  if (tEff.immunity) {
    tEff.immunity = false;
    notify(attackerId, 'attack-blocked', `${target.name} محصن!`);
    notify(targetId,   'immunity-saved',  '🛡️ الحصانة أنقذتك!');
    return { ok: true, blocked: true };
  }

  if (tEff.ghost) {
    notify(attackerId, 'attack-blocked', `👻 ${target.name} مختفٍ! لا يمكن استهدافه`);
    return { ok: true, blocked: true };
  }

  if (type === 'hole') {
    G.effects[attackerId] = { ...(G.effects[attackerId] || {}), holeTarget: targetId };
    notify(targetId, 'hole-incoming', `🪙 ${attacker.name} يحاول سرقة نقاطك إذا أجبت صح!`);
  } else if (type === 'freeze') {
    if (immediate) {
      G.effects[targetId] = { ...(G.effects[targetId] || {}), frozen: true };
      notify(targetId, 'frozen-incoming', `❄️ ${attacker.name} جمّدك! لا خصائص في هذا السؤال`);
    } else {
      G.nextEffects[targetId] = { ...(G.nextEffects[targetId] || {}), frozen: true };
      notify(targetId, 'frozen-incoming', `❄️ ${attacker.name} جمّدك! لا خصائص في السؤال القادم`);
    }
  } else if (type === 'cut') {
    if (immediate) {
      G.effects[targetId] = { ...(G.effects[targetId] || {}), cut: true };
      notify(targetId, 'cut-incoming', `✂️ ${attacker.name} قطعك! لا إجابة في هذا السؤال`);
    } else {
      G.nextEffects[targetId] = { ...(G.nextEffects[targetId] || {}), cut: true };
      notify(targetId, 'cut-incoming', `✂️ ${attacker.name} قطعك! لا إجابة في السؤال القادم`);
    }
  } else if (type === 'blur') {
    if (G.answers[targetId]) {
      notify(attackerId, 'error', `❌ ${target.name} أجاب بالفعل!`);
      return { ok: false };
    }
    // Fisher-Yates shuffle مع ضمان تغيير الترتيب
    const arr = [0,1,2,3];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    if (arr.every((v, i) => v === i)) { [arr[0], arr[1]] = [arr[1], arr[0]]; }
    io.to(targetId).emit('game:shuffle-options', { shuffle: arr, attackerName: attacker.name });
    notify(targetId,   'blur-incoming',   `🌀 ${attacker.name} أربك خياراتك!`);
    notify(attackerId, 'blur-success',    `🌀 ربّكت ${target.name}! الخيارات اختلطت عليه`);
  }

  return { ok: true, success: true };
}

// ─────────────────────────────────────────────────────────────
// END QUESTION
// ─────────────────────────────────────────────────────────────
function endQuestion() {
  if (!G.active) return;
  clearInterval(G.timerRef);
  clearTimeout(G.autoEndRef);
  G.active = false;
  G.retryPending  = {};
  G.revivalPending = {};

  const q = G.question;
  const results = {};
  const oldLeaderId = G.leaderId; // ← تتبع القائد السابق

  // Phase 1 – حساب النقاط لكل لاعب
  Object.values(G.players).forEach(p => {
    const ans  = G.answers[p.id];
    const eff  = G.effects[p.id] || {};
    // ← دعم أسئلة الترتيب والنص
    const correct = (q.type === 'order' && ans?.isOrderCorrect !== undefined)
      ? ans.isOrderCorrect
      : q.type === 'text'
        ? (ans?.isTextCorrect || false)
        : (ans && ans.choice === q.correctAnswer);
    let delta = 0;

    if (correct) {
      const base  = 100;
      const speed = ans ? Math.floor((ans.timeLeft / G.questionTime) * 50) : 0;
      let pts = base + speed;
      if (p.streak >= 5)      pts = Math.floor(pts * 2);
      else if (p.streak >= 3) pts = Math.floor(pts * 1.5);
      if (eff.doubleRisk)     pts *= 2;
      if (eff.storeMultiplier) pts = Math.floor(pts * 1.5); // ← متجر النقاط
      delta = pts;
      p.lastStreak = p.streak;
      p.streak++;
    } else {
      if (eff.doubleRisk && ans) delta = -100;
      p.lastStreak = p.streak;
      if (!eff.revival) p.streak = 0;
    }

    results[p.id] = { isCorrect: correct, delta, choice: ans?.choice ?? null, streak: p.streak, timeTaken: ans ? (G.questionTime - ans.timeLeft) : null };
  });

  // Phase 2 – معالجة خاصية السرقة
  Object.entries(G.effects).forEach(([attackerId, eff]) => {
    if (!eff.holeTarget) return;
    const tid      = eff.holeTarget;
    const target   = G.players[tid];
    const attacker = G.players[attackerId];
    if (!target || !attacker) return;

    const tEff    = G.effects[tid]        || {};
    const aResult = results[attackerId]   || { delta: 0 };
    const tResult = results[tid]          || { delta: 0 };

    if (tEff.reverse) {
      tEff.reverse = false;
      // الانعكاس: السارق يخسر نقاطه بدلاً من الضحية
      const lost = Math.max(0, aResult.delta);
      results[attackerId] = { ...aResult, delta: 0, reflected: true };
      if (lost > 0) results[tid] = { ...tResult, delta: tResult.delta + lost, stolenGain: lost };
      notify(attackerId, 'attack-reflected', `🔄 ${target.name} عكس السرقة عليك!`);
      notify(tid,        'reverse-fired',    '🔄 درع الانعكاس انطلق!');
    } else if (tEff.immunity) {
      tEff.immunity = false;
      notify(attackerId, 'attack-blocked', `${target.name} محصن!`);
      notify(tid,        'immunity-saved',  '🛡️ الحصانة أنقذتك!');
    } else {
      const stolen = Math.max(0, tResult.delta);
      if (stolen > 0) {
        // الضحية أجابت صح → تسرق نقاطها وتعطيها للمهاجم
        results[tid]       = { ...tResult, delta: 0,                    holed: true };
        results[attackerId]= { ...aResult, delta: aResult.delta + stolen, stolenGain: stolen };
        notify(tid,       'holed',         `🪙 ${attacker.name} سرق نقاطك من هذا السؤال!`);
        notify(attackerId,'theft-success', `✅ سرقت ${stolen} نقطة من ${target.name}!`);
      } else {
        // الضحية أجابت خطأ أو ما أجابت → السرقة فشلت، لا شيء للمهاجم
        notify(attackerId,'theft-failed', `❌ ${target.name} لم يجب صح — السرقة فشلت`);
      }
    }
  });

  // Phase 2.5 – السؤال الأخير: المركز الأخير يحصل على ×3 نقاط
  if (G.isLastQuestion) {
    const sorted = Object.values(G.players).sort((a, b) => a.points - b.points);
    if (sorted.length >= 1) {
      const lastPlaceId = sorted[0].id;
      if (results[lastPlaceId] && results[lastPlaceId].delta > 0) {
        results[lastPlaceId].delta = Math.floor(results[lastPlaceId].delta * 3);
        results[lastPlaceId].tripleBoost = true;
      }
    }
  }

  // Phase 3 – تطبيق النقاط
  Object.values(G.players).forEach(p => {
    const r = results[p.id] || { delta: 0 };
    p.points = Math.max(0, p.points + r.delta);
  });

  // ← جديد: تتبع قائد جديد وإعلانه
  const postLb = leaderboard();
  const newLeaderId = postLb[0]?.id;
  if (newLeaderId && oldLeaderId && newLeaderId !== oldLeaderId && G.players[newLeaderId]) {
    io.emit('game:new-leader', {
      name:   G.players[newLeaderId].name,
      avatar: G.players[newLeaderId].avatar,
    });
  }
  G.leaderId = newLeaderId || G.leaderId;

  // Phase 4 – تحضير تأثيرات السؤال القادم
  const newEff = {};
  Object.keys(G.players).forEach(pid => {
    newEff[pid] = { cut: G.nextEffects[pid]?.cut || false, frozen: G.nextEffects[pid]?.frozen || false };
  });
  G.effects      = newEff;
  G.nextEffects  = {};

  const questionLeaderboard = Object.values(G.players)
    .map(p => ({
      id:        p.id,
      name:      p.name,
      avatar:    p.avatar,
      delta:     results[p.id]?.delta     || 0,
      isCorrect: results[p.id]?.isCorrect || false,
      streak:    p.streak,
      points:    p.points,
    }))
    .sort((a, b) => b.delta - a.delta);

  const endPayload = {
    correctAnswer:      q.correctAnswer,
    textAnswer:         q.type === 'text' ? q.answer : undefined,
    results,
    leaderboard:        leaderboard(),
    questionLeaderboard,
    qNum:               G.qNum,
    wasLastQuestion:    G.isLastQuestion,
  };

  if (G.isDramatic) {
    // Phase 4.5 – تسلسل الكشف الدرامي (الخطأ أولاً، الصح آخراً)
    const revealSequence = Object.entries(results)
      .filter(([pid]) => G.players[pid])
      .map(([pid, r]) => ({
        id:          pid,
        name:        G.players[pid]?.name,
        avatar:      G.players[pid]?.avatar,
        isCorrect:   r.isCorrect,
        delta:       r.delta,
        choice:      r.choice,
        tripleBoost: r.tripleBoost || false,
        holed:       r.holed       || false,
      }))
      .sort((a, b) => a.isCorrect - b.isCorrect);

    const revealDelay = Math.min(revealSequence.length * 1400 + 1200, 18000);
    io.emit('game:reveal-sequence', { sequence: revealSequence, correctAnswer: q.correctAnswer, options: q.options });
    setTimeout(() => {
      io.emit('game:question-end', endPayload);
      io.emit('game:leaderboard', leaderboard());
    }, revealDelay);
  } else {
    // عرض فوري بدون كشف درامي
    io.emit('game:question-end', endPayload);
    io.emit('game:leaderboard', leaderboard());
  }

  // Phase 5 – الفرصة الأخيرة: كل سؤالين يحصل الأخير على خاصية مجانية
  if (G.qNum % 4 === 0 && !G.isLastQuestion) {
    const sorted = Object.values(G.players).sort((a, b) => a.points - b.points);
    if (sorted.length >= 2) {
      const lastPlace = sorted[0];
      const bonusPool = ['retry', 'immunity', 'hint'];
      const bonusType = bonusPool[Math.floor(Math.random() * bonusPool.length)];
      const info = {
        retry:    { icon: '↩️', name: 'إعادة',  desc: 'فرصة ثانية إذا أخطأت' },
        immunity: { icon: '🛡️', name: 'حصانة', desc: 'حماية من هجوم واحد' },
        hint:     { icon: '💡', name: 'تلميح',  desc: 'تلميح للسؤال القادم' },
      }[bonusType];
      lastPlace.bonusAbility = { type: bonusType, used: false };
      io.to(lastPlace.id).emit('game:bonus-ability', { ...info, type: bonusType });
    }
  }

  G.isLastQuestion = false;
}

// ─────────────────────────────────────────────────────────────
// START ACTUAL QUESTION
// ─────────────────────────────────────────────────────────────
function startActualQuestion() {
  clearTimeout(G.preQTimeout);
  G.preQ = false;
  G.active    = true;
  G.escapedPlayers = new Set();
  G.timeLeft  = G.questionTime;
  G.answers   = {};
  G.retryPending   = {};
  G.revivalPending = {};
  G.jokerUsed = {}; // ← مسح الجوكرات لكل سؤال

  // ← أسئلة الترتيب: خلط البنود
  if (G.question.type === 'order' && G.question.items) {
    const items = G.question.items;
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    G.question.shuffledItems = shuffled;
    G.question.itemMapping = shuffled.map(item => items.indexOf(item));
  }

  Object.keys(G.players).forEach(pid => {
    G.effects[pid] = {
      cut:            G.effects[pid]?.cut      || false,
      frozen:         G.effects[pid]?.frozen   || false,
      immunity:       G.effects[pid]?.immunity || false,
      reverse:        G.effects[pid]?.reverse  || false,
      ghost:          G.effects[pid]?.ghost    || false,
      spyTarget:      null,
      doubleRisk:     false,
      revival:        false,
      retry:          false,
      holeTarget:     null,
      storeMultiplier: G.storePurchases[pid]?.multiplier || false, // ← متجر
    };
  });

  // Apply deferred pre-question ability decisions (activated at question start, not during selection)
  const prevRevKeys = new Set(Object.keys(G.reverseOffers));
  const pendingBlurs = []; // blur must be sent AFTER game:question-start to avoid renderQuestion() clearing shuffleMap
  Object.entries(G.preQDecisions).forEach(([pid, dec]) => {
    if (!G.players[pid]) return;
    const { type, targetId } = dec;
    if (type === 'immunity') {
      G.effects[pid].immunity = true;
      io.to(pid).emit('ability:result', { type: 'immunity', status: 'active' });
      notify(pid, 'shield-active', '🛡️ الحصانة مفعّلة!');
    } else if (type === 'ghost') {
      G.effects[pid].ghost = true;
      io.to(pid).emit('ability:result', { type: 'ghost', status: 'active' });
      notify(pid, 'shield-active', '👻 أنت مخفي! لا أحد يستطيع استهدافك');
      io.emit('game:players-update', publicPlayers());
    } else if (type === 'blur' && targetId && G.players[targetId]) {
      // Check immunity/ghost on target before queuing
      const tEff = G.effects[targetId] || {};
      if (tEff.immunity) {
        io.to(pid).emit('ability:result', { type: 'blur', status: 'blocked', target: G.players[targetId]?.name });
      } else if (tEff.ghost) {
        io.to(pid).emit('ability:result', { type: 'blur', status: 'blocked', target: G.players[targetId]?.name });
      } else {
        pendingBlurs.push({ attackerId: pid, targetId });
      }
    } else if (targetId && G.players[targetId]) {
      const res = applyAttack(pid, type, targetId, true);
      if (res.ok && !res.pending) {
        const st = res.reflected ? 'reflected' : res.blocked ? 'blocked' : 'success';
        io.to(pid).emit('ability:result', { type, status: st, target: G.players[targetId]?.name });
      } else if (res.ok && res.pending) {
        io.to(pid).emit('ability:result', { type, status: 'success', target: G.players[targetId]?.name });
      }
    }
  });
  G.preQDecisions = {};

  // Mark reverse offers created during the pre-Q decisions loop
  let preQRevCount = 0;
  Object.keys(G.reverseOffers).forEach(k => {
    if (!prevRevKeys.has(k)) { G.reverseOffers[k].preQ = true; preQRevCount++; }
  });

  function fireQuestion() {
    const playerQ = {
      text:    G.question.text,
      options: G.question.type === 'order'
        ? (G.question.shuffledItems || G.question.items)
        : G.question.options,
      number:  G.qNum,
      image:   G.question.image || null,
      type:    G.question.type  || 'normal',
    };
    io.emit('game:question-start', {
      question: playerQ,
      timeLeft: G.questionTime,
      questionTime: G.questionTime,
      isLastQuestion: G.isLastQuestion,
    });

    // Send blur shuffle AFTER question-start so renderQuestion() doesn't clear shuffleMap
    if (pendingBlurs.length > 0) {
      setTimeout(() => {
        pendingBlurs.forEach(({ attackerId, targetId }) => {
          if (!G.players[targetId] || !G.players[attackerId]) return;
          const attacker = G.players[attackerId];
          const arr = [0,1,2,3].sort(() => Math.random() - 0.5);
          if (arr.every((v, i) => v === i)) { [arr[0], arr[1]] = [arr[1], arr[0]]; }
          io.to(targetId).emit('game:shuffle-options', { shuffle: arr, attackerName: attacker.name });
          notify(targetId,   'blur-incoming', `🌀 ${attacker.name} أربك خياراتك!`);
          notify(attackerId, 'blur-success',  `🌀 ربّكت ${G.players[targetId].name}! الخيارات اختلطت عليه`);
          io.to(attackerId).emit('ability:result', { type: 'blur', status: 'success', target: G.players[targetId]?.name });
        });
      }, 400);
    }

    // ← تطبيق مشتريات المتجر (تلميح + حذف خيار)
    Object.entries(G.storePurchases).forEach(([pid, purchases]) => {
      if (!G.players[pid]) return;
      if (purchases.hint && G.question.hint) {
        io.to(pid).emit('game:hint', { hint: G.question.hint });
      }
      if (purchases.eliminate && G.question.correctAnswer !== undefined && G.question.type !== 'order' && G.question.type !== 'text') {
        const wrongs = [0,1,2,3].filter(i => i !== G.question.correctAnswer);
        const elim   = wrongs[Math.floor(Math.random() * wrongs.length)];
        io.to(pid).emit('game:eliminate-option', { eliminate: elim });
      }
    });
    G.storePurchases = {};

    Object.entries(G.effects).forEach(([pid, eff]) => {
      if (eff.cut)    io.to(pid).emit('game:notify', { type: 'cut-active',    msg: '✂️ أنت مقطوع! لا يمكنك الإجابة' });
      if (eff.frozen) io.to(pid).emit('game:notify', { type: 'frozen-active', msg: '❄️ أنت مجمد! لا يمكنك استخدام الخصائص' });
    });

    // ← أي reverse offer قديم معلق: أعطِ المدافع 5 ثوانٍ إضافية ثم طبّق الهجوم
    Object.entries(G.reverseOffers).forEach(([targetId, offer]) => {
      clearTimeout(offer.timeout);
      offer.timeout = setTimeout(() => {
        delete G.reverseOffers[targetId];
        applyAttack(offer.attackerId, offer.type, targetId, offer.immediate, true);
        checkPendingQuestionStart();
      }, 5000);
    });
  }

  if (preQRevCount > 0) {
    // Wait for reverse decisions before starting the question
    G.pendingQuestionStart = fireQuestion;
  } else {
    fireQuestion();
  }

  G.timerRef = setInterval(() => {
    G.timeLeft--;
    io.emit('game:timer', G.timeLeft);
    if (G.timeLeft <= 0) {
      clearInterval(G.timerRef);
      G.autoEndRef = setTimeout(() => endQuestion(), 3000);
    }
  }, 1000);
}

function checkAllPreQResponded() {
  if (!G.preQ) return;
  if (G.preQResponded.size >= G.preQEligible.size) {
    clearTimeout(G.preQTimeout);
    G.preQ = false;
    startActualQuestion();
  }
}

// ─────────────────────────────────────────────────────────────
// SOCKET.IO
// ─────────────────────────────────────────────────────────────
io.on('connection', socket => {
  socket.emit('game:state', {
    players:    publicPlayers(),
    active:     G.active,
    question:   G.active ? { text: G.question.text, options: G.question.options, number: G.qNum } : null,
    timeLeft:   G.timeLeft,
    leaderboard: leaderboard(),
    qNum:       G.qNum,
  });

  // ── HOST ───────────────────────────────────────────────────
  socket.on('host:start-question', qData => {
    if (G.active || G.preQ) return;
    clearInterval(G.timerRef);

    G.question     = qData;
    G.qNum++;
    G.isLastQuestion  = qData.isLastQuestion || false;
    G.questionTime    = [7,10,15,20,30].includes(qData.duration) ? qData.duration : DEFAULT_QUESTION_TIME;
    if (qData.isDramatic !== undefined) G.isDramatic = qData.isDramatic;

    Object.keys(G.players).forEach(pid => {
      if (!G.effects[pid]) G.effects[pid] = {};
    });

    socket.emit('host:question-confirmed', { question: qData, number: G.qNum });

    const preTypes = ['freeze','cut','immunity','ghost','blur'];
    const eligible = Object.values(G.players).filter(p => {
      return ['attack','defense'].some(cat => {
        const ab = p.abilities[cat];
        return ab && preTypes.includes(ab.type) && !ab.used;
      });
    });

    if (eligible.length === 0) {
      startActualQuestion();
      return;
    }

    G.preQ = true;
    G.preQEligible = new Set(eligible.map(p => p.id));
    G.preQResponded = new Set();

    eligible.forEach(p => {
      const abils = [];
      ['attack','defense'].forEach(cat => {
        const ab = p.abilities[cat];
        if (ab && preTypes.includes(ab.type) && !ab.used) {
          abils.push({ category: cat, type: ab.type });
        }
      });
      if (abils.length) io.to(p.id).emit('game:pre-question', { abilities: abils });
    });

    Object.keys(G.players).forEach(pid => {
      if (!G.preQEligible.has(pid)) {
        io.to(pid).emit('game:waiting-pre-question');
      }
    });

    G.preQTimeout = setTimeout(() => {
      if (G.preQ) {
        G.preQ = false;
        startActualQuestion();
      }
    }, 10000);
  });

  socket.on('host:end-question', () => endQuestion());

  socket.on('player:pre-question-decision', ({ use, category, type, targetId }) => {
    if (!G.preQ || !G.preQEligible.has(socket.id)) return;
    if (G.preQResponded.has(socket.id)) return;
    G.preQResponded.add(socket.id);

    if (use && category && type) {
      const p = G.players[socket.id];
      if (p) {
        const ab = p.abilities[category];
        const validTypes = ['freeze', 'cut', 'immunity', 'ghost', 'blur'];
        if (ab && !ab.used && ab.type === type && validTypes.includes(ab.type)) {
          if (ab.type !== 'ghost' && ab.type !== 'immunity' && (!targetId || !G.players[targetId] || targetId === socket.id)) {
            // attack without valid target — skip
          } else {
            ab.used = true;
            G.preQDecisions[socket.id] = { category, type, targetId };
            // Confirm selection (not activation) so the client marks it as used
            io.to(socket.id).emit('ability:result', { type: ab.type, status: 'selected' });
            io.emit('game:players-update', publicPlayers());
          }
        }
      }
    }

    checkAllPreQResponded();
  });

  socket.on('player:reverse-decision', ({ use }) => {
    const offer = G.reverseOffers[socket.id];
    if (!offer) return;
    clearTimeout(offer.timeout);
    delete G.reverseOffers[socket.id];

    const p = G.players[socket.id];
    if (use && p) {
      p.abilities.defense.used = true;
      if (offer.type === 'freeze') {
        if (offer.immediate) {
          G.effects[offer.attackerId] = { ...(G.effects[offer.attackerId] || {}), frozen: true };
          // ← إشعار بالتأثير على المهاجم
          io.to(offer.attackerId).emit('game:notify', { type: 'frozen-active', msg: `❄️ ${p.name} عكس هجومك! أنت مجمد الآن` });
        } else {
          G.nextEffects[offer.attackerId] = { ...(G.nextEffects[offer.attackerId] || {}), frozen: true };
        }
      } else if (offer.type === 'cut') {
        if (offer.immediate) {
          G.effects[offer.attackerId] = { ...(G.effects[offer.attackerId] || {}), cut: true };
          // ← إشعار بالتأثير على المهاجم
          io.to(offer.attackerId).emit('game:notify', { type: 'cut-active', msg: `✂️ ${p.name} عكس هجومك! أنت مقطوع الآن` });
        } else {
          G.nextEffects[offer.attackerId] = { ...(G.nextEffects[offer.attackerId] || {}), cut: true };
        }
      } else if (offer.type === 'hole') {
        G.effects[socket.id] = { ...(G.effects[socket.id] || {}), holeTarget: offer.attackerId };
      }
      notify(offer.attackerId, 'attack-reflected', `🔄 ${p.name} عكس هجومك عليك!`);
      notify(socket.id, 'reverse-fired', '🔄 درع الانعكاس انطلق!');
      io.to(socket.id).emit('ability:result', { type: 'reverse', status: 'active' });
      io.emit('game:players-update', publicPlayers());
    } else {
      applyAttack(offer.attackerId, offer.type, socket.id, offer.immediate, true);
    }
    checkPendingQuestionStart();
  });

  socket.on('host:end-game', () => {
    clearInterval(G.timerRef);
    G.active = false;
    G.preQ   = false;
    const lb = leaderboard();
    io.emit('game:final', { top3: lb.slice(0, 3), leaderboard: lb });
  });

  // ── إعلان السؤال الأخير ──────────────────────────────────
  socket.on('host:kick-player', ({ playerId }) => {
    const p = G.players[playerId];
    if (!p) return;
    // أبلغ اللاعب أنه طُرد
    io.to(playerId).emit('game:kicked', { name: p.name });
    // احذفه من كل الحالات
    delete G.players[playerId];
    delete G.effects[playerId];
    delete G.answers[playerId];
    delete G.retryPending[playerId];
    delete G.revivalPending[playerId];
    if (G.reverseOffers[playerId]) {
      clearTimeout(G.reverseOffers[playerId].timeout);
      delete G.reverseOffers[playerId];
    }
    io.emit('game:players-update', publicPlayers());
    io.emit('game:leaderboard', leaderboard());
    socket.emit('host:kick-confirmed', { name: p.name });
  });

  socket.on('host:announce-last-question', () => {
    G.isLastQuestion = true;
    io.emit('game:last-question-announcement');

    // أخبر اللاعب الأخير بميزة ×3
    const sorted = Object.values(G.players).sort((a, b) => a.points - b.points);
    if (sorted.length >= 1) {
      const lastPlayer = sorted[0];
      io.to(lastPlayer.id).emit('game:triple-boost', { name: lastPlayer.name });
    }

    socket.emit('host:announcement-sent');
  });

  socket.on('host:reset', () => {
    clearInterval(G.timerRef);
    if (G.storeTimer) clearTimeout(G.storeTimer);
    Object.values(G.reverseOffers).forEach(o => clearTimeout(o.timeout));
    Object.values(G.disconnectTimers).forEach(t => clearTimeout(t));
    G = newState();
    io.emit('game:reset');
  });

  // ── PLAYER ─────────────────────────────────────────────────
  socket.on('player:join', ({ name, avatar, abilities, persistentId }) => {
    const existing = persistentId ? findByPid(persistentId) : null;
    if (existing) {
      const oldId = existing.id;

      if (G.disconnectTimers[persistentId]) {
        clearTimeout(G.disconnectTimers[persistentId]);
        delete G.disconnectTimers[persistentId];
      }

      existing.id      = socket.id;
      existing.offline = false;
      G.players[socket.id] = existing;
      if (oldId !== socket.id) {
        delete G.players[oldId];
        G.effects[socket.id]      = G.effects[oldId]      || {};    delete G.effects[oldId];
        if (G.answers[oldId])        { G.answers[socket.id]        = G.answers[oldId];        delete G.answers[oldId]; }
        if (G.retryPending[oldId])   { G.retryPending[socket.id]   = true;                    delete G.retryPending[oldId]; }
        if (G.revivalPending[oldId]) { G.revivalPending[socket.id] = true;                    delete G.revivalPending[oldId]; }
        if (G.reverseOffers[oldId])  { G.reverseOffers[socket.id]  = G.reverseOffers[oldId]; delete G.reverseOffers[oldId]; }
      }

      socket.emit('player:rejoined', {
        id: socket.id, player: existing,
        active: G.active, preQ: G.preQ,
        question: G.active ? { text: G.question.text, options: G.question.type === 'order' ? (G.question.shuffledItems || G.question.items) : G.question.options, number: G.qNum, type: G.question.type || 'normal' } : null,
        timeLeft: G.timeLeft,
        questionTime: G.questionTime,
        storeVoteActive: G.storeVoteActive,
        storeVoteSecsLeft: G.storeVoteActive ? Math.max(0, Math.ceil((G.storeVoteEndTime - Date.now()) / 1000)) : 0,
        storeVoteTally: G.storeVoteActive ? { yes: G.storeVoteYes, no: G.storeVoteNo, total: Object.keys(G.players).length, voted: G.storeVoted.size } : null,
        alreadyVoted: G.storeVoteActive && G.storeVoted.has(socket.id),
      });

      if (G.active && G.escapedPlayers.has(existing.persistentId)) {
        G.effects[socket.id] = { ...(G.effects[socket.id] || {}), cut: true, frozen: true };
        io.to(socket.id).emit('game:notify', { type: 'escaped-active', msg: '🚫 غادرت الشاشة أثناء السؤال!' });
      }

      io.emit('game:players-update', publicPlayers());
      return;
    }

    if (G.players[socket.id]) return;

    G.players[socket.id] = {
      id:                socket.id,
      persistentId:      persistentId || socket.id,
      name:              String(name).trim().slice(0, 20),
      avatar,
      points:            0,
      streak:            0,
      lastStreak:        0,
      offline:           false,
      bonusAbility:      null,
      hasUsedLastSecond: false,
      abilities: {
        attack:  { type: abilities.attack,  used: false },
        defense: { type: abilities.defense, used: false },
        general: { type: abilities.general, used: false },
      },
    };
    G.effects[socket.id] = { cut: false, frozen: false };

    socket.emit('player:joined', { id: socket.id, player: G.players[socket.id] });
    io.emit('game:players-update', publicPlayers());
    io.emit('game:leaderboard', leaderboard());
  });

  socket.on('player:question-escape', () => {
    if (!G.active) return;
    const p = G.players[socket.id];
    if (!p) return;
    if (G.escapedPlayers.has(p.persistentId)) return;
    G.escapedPlayers.add(p.persistentId);
    if (!G.effects[socket.id]) G.effects[socket.id] = {};
    G.effects[socket.id].cut    = true;
    G.effects[socket.id].frozen = true;
    socket.emit('game:notify', { type: 'escaped-active', msg: '🚫 غادرت الشاشة أثناء السؤال!' });
  });

  socket.on('player:answer', ({ choice, orderAnswer, textAnswer }) => {
    if (!G.active) return;
    const eff = G.effects[socket.id] || {};
    if (eff.cut)    { socket.emit('game:notify', { type: 'cut-active',    msg: '✂️ لا يمكنك الإجابة!' }); return; }
    if (eff.frozen) { socket.emit('game:notify', { type: 'frozen-active', msg: '❄️ أنت مجمد! لا يمكنك الإجابة أو استخدام الخصائص' }); return; }

    const existing = G.answers[socket.id];

    // ← سؤال النص المفتوح
    if (G.question.type === 'text' && textAnswer !== undefined) {
      if (existing) return;
      const accepted = G.question.acceptedAnswers || [G.question.answer];
      const norm = normalizeArabic(textAnswer);
      const isTextCorrect = accepted.some(a => normalizeArabic(a) === norm) || normalizeArabic(G.question.answer) === norm;
      G.answers[socket.id] = { textAnswer, isTextCorrect, timeLeft: G.timeLeft };
      socket.emit('player:answer-accepted', { correct: isTextCorrect, isText: true });
      const answered = Object.keys(G.answers).length;
      const total    = Object.keys(G.players).length;
      io.emit('host:answer-stats', { answered, total });
      io.emit('game:answer-progress', { answered, total, lb: leaderboard() });
      return;
    }

    // ← سؤال الترتيب
    if (G.question.type === 'order' && orderAnswer) {
      if (existing) return;
      const originalOrder  = orderAnswer.map(si => G.question.itemMapping[si]);
      const correctOrder   = G.question.correctOrder || [0,1,2,3];
      const isOrderCorrect = JSON.stringify(originalOrder) === JSON.stringify(correctOrder);
      G.answers[socket.id] = { choice: isOrderCorrect ? 0 : 1, timeLeft: G.timeLeft, orderAnswer, isOrderCorrect };
      socket.emit('player:answer-accepted', { choice: 0, correct: isOrderCorrect, isOrder: true });
      const answered = Object.keys(G.answers).length;
      const total    = Object.keys(G.players).length;
      io.emit('host:answer-stats', { answered, total });
      io.emit('game:answer-progress', { answered, total, lb: leaderboard() });
      return;
    }

    if (existing) {
      if (G.retryPending[socket.id]) {
        G.answers[socket.id] = { choice, timeLeft: G.timeLeft, isRetry: true };
        delete G.retryPending[socket.id];
        const p = G.players[socket.id];
        if (p) p.abilities.defense.used = true;
        const correct = choice === G.question.correctAnswer;
        socket.emit('player:answer-accepted', { choice, correct, isRetry: true });
      }
      return;
    }

    G.answers[socket.id] = { choice, timeLeft: G.timeLeft };
    const correct = choice === G.question.correctAnswer;
    socket.emit('player:answer-accepted', { choice, correct });

    // إبلاغ الجواسيس
    Object.entries(G.effects).forEach(([spyId, spyEff]) => {
      if (spyEff.spyTarget === socket.id && spyId !== socket.id && G.players[spyId]) {
        io.to(spyId).emit('game:spy-result', {
          targetName: G.players[socket.id]?.name,
          choice,
          choiceText: G.question.options[choice],
          correct,
        });
      }
    });

    if (!correct) {
      const p = G.players[socket.id];
      if (p) {
        if (p.abilities.defense.type === 'retry' && !p.abilities.defense.used && !eff.frozen) {
          G.retryPending[socket.id] = true;
          socket.emit('game:retry-available');
        }
        if (p.abilities.general.type === 'revival' && !p.abilities.general.used && !eff.frozen) {
          G.revivalPending[socket.id] = true;
          socket.emit('game:revival-available');
        }
        // بونص الإعادة للأخير
        if (p.bonusAbility && p.bonusAbility.type === 'retry' && !p.bonusAbility.used && !eff.frozen) {
          G.retryPending[socket.id] = true;
          socket.emit('game:retry-available');
        }
      }
    }

    const answered = Object.keys(G.answers).length;
    const total    = Object.keys(G.players).length;
    io.emit('host:answer-stats', { answered, total });
    // ← جديد: إرسال التقدم لكل اللاعبين
    io.emit('game:answer-progress', { answered, total, lb: leaderboard() });
  });

  socket.on('player:break-ice', () => {
    if (!G.active) return;
    const eff = G.effects[socket.id];
    if (eff && eff.frozen) eff.frozen = false;
  });

  socket.on('player:change-answer', ({ choice }) => {
    if (!G.active || G.timeLeft <= 0) return;
    const p = G.players[socket.id];
    if (!p || p.hasUsedLastSecond) return;
    const eff = G.effects[socket.id] || {};
    if (eff.cut || eff.frozen) return;
    if (!G.answers[socket.id]) return;

    p.hasUsedLastSecond = true;
    G.answers[socket.id] = { choice, timeLeft: G.timeLeft, isLastSecond: true };
    const correct = choice === G.question.correctAnswer;
    socket.emit('player:answer-accepted', { choice, correct, isLastSecond: true });

    // إبلاغ الجواسيس بالتغيير
    Object.entries(G.effects).forEach(([spyId, spyEff]) => {
      if (spyEff.spyTarget === socket.id && spyId !== socket.id && G.players[spyId]) {
        io.to(spyId).emit('game:spy-result', {
          targetName: p.name,
          choice,
          choiceText: G.question.options[choice],
          correct,
          changed: true,
        });
      }
    });

    const answered = Object.keys(G.answers).length;
    const total    = Object.keys(G.players).length;
    io.emit('game:answer-progress', { answered, total, lb: leaderboard() });
  });

  socket.on('player:use-revival', () => {
    if (!G.revivalPending[socket.id]) return;
    const p = G.players[socket.id];
    if (!p || p.abilities.general.type !== 'revival' || p.abilities.general.used) return;
    p.abilities.general.used = true;
    G.effects[socket.id].revival = true;
    delete G.revivalPending[socket.id];
    socket.emit('ability:result', { type: 'revival', status: 'used' });
    notify(socket.id, 'revival-active', '✨ الإنعاش فعّال!');
  });

  socket.on('player:use-ability', ({ category, targetId }) => {
    if (!G.active) return;
    const p = G.players[socket.id];
    if (!p) return;

    // ← جديد: التحقق من الخاصية البونص
    let ability = p.abilities[category];
    let isBonusAbility = false;
    if (category === 'bonus' && p.bonusAbility && !p.bonusAbility.used) {
      ability = { type: p.bonusAbility.type, used: false };
      isBonusAbility = true;
    }

    if (!ability || ability.used) {
      socket.emit('game:notify', { type: 'error', msg: '⚠️ استخدمتها مسبقاً!' }); return;
    }

    const eff = G.effects[socket.id] || {};
    if (eff.frozen) {
      socket.emit('game:notify', { type: 'error', msg: '❄️ أنت مجمد!' }); return;
    }

    let used = false;

    switch (ability.type) {
      case 'hole': case 'freeze': case 'cut': case 'blur': {
        if (!targetId || !G.players[targetId] || targetId === socket.id) {
          socket.emit('game:notify', { type: 'error', msg: '⚠️ اختر لاعباً!' }); return;
        }
        const res = applyAttack(socket.id, ability.type, targetId);
        if (res.ok) {
          used = true;
          const st = res.reflected ? 'reflected' : res.blocked ? 'blocked' : 'success';
          socket.emit('ability:result', { type: ability.type, status: st, target: G.players[targetId]?.name });
        }
        break;
      }
      case 'reverse':
        G.effects[socket.id].reverse = true;
        used = true;
        socket.emit('ability:result', { type: 'reverse', status: 'active' });
        notify(socket.id, 'shield-active', '🔄 درع الانعكاس مفعّل!');
        break;
      case 'immunity':
        G.effects[socket.id].immunity = true;
        used = true;
        socket.emit('ability:result', { type: 'immunity', status: 'active' });
        notify(socket.id, 'shield-active', '🛡️ الحصانة مفعّلة!');
        break;
      case 'retry':
        G.effects[socket.id].retry = true;
        used = true;
        socket.emit('ability:result', { type: 'retry', status: 'active' });
        notify(socket.id, 'ability-active', '↩️ الإعادة جاهزة!');
        break;
      case 'doubleRisk':
        G.effects[socket.id].doubleRisk = true;
        used = true;
        socket.emit('ability:result', { type: 'doubleRisk', status: 'active' });
        notify(socket.id, 'ability-active', '⚡ مضاعف الخطر!');
        break;
      case 'hint':
        socket.emit('game:hint', { hint: G.question?.hint || 'لا يوجد تلميح' });
        used = true;
        socket.emit('ability:result', { type: 'hint', status: 'used' });
        break;
      case 'revival':
        G.effects[socket.id].revival = true;
        used = true;
        socket.emit('ability:result', { type: 'revival', status: 'active' });
        notify(socket.id, 'ability-active', '✨ الإنعاش جاهز!');
        break;
      case 'spy': {
        if (!targetId || !G.players[targetId] || targetId === socket.id) {
          socket.emit('game:notify', { type: 'error', msg: '⚠️ اختر لاعباً!' }); return;
        }
        G.effects[socket.id].spyTarget = targetId;
        used = true;
        socket.emit('ability:result', { type: 'spy', status: 'active' });
        notify(socket.id, 'ability-active', `🔍 تجسسك على ${G.players[targetId]?.name} مفعّل!`);
        break;
      }
    }

    if (used) {
      if (isBonusAbility) p.bonusAbility.used = true;
      else ability.used = true;
    }
    io.emit('game:players-update', publicPlayers());
  });

  // ── JOKER ──────────────────────────────────────────────────
  socket.on('player:use-joker', () => {
    if (!G.active) return;
    if (G.jokerUsed[socket.id]) { socket.emit('game:notify', { type: 'error', msg: '⚠️ استخدمت الجوكر مسبقاً!' }); return; }
    if (G.answers[socket.id])   { socket.emit('game:notify', { type: 'error', msg: '⚠️ أجبت بالفعل!' }); return; }
    if (G.question.type === 'order') { socket.emit('game:notify', { type: 'error', msg: '⚠️ الجوكر لا يعمل مع أسئلة الترتيب' }); return; }
    const correct = G.question.correctAnswer;
    const wrongs  = [0,1,2,3].filter(i => i !== correct);
    // احتفظ بخيار خاطئ واحد عشوائي
    const keepWrongIdx  = Math.floor(Math.random() * wrongs.length);
    const eliminated    = wrongs.filter((_, i) => i !== keepWrongIdx);
    G.jokerUsed[socket.id] = true;
    socket.emit('game:joker-result', { eliminated });
    notify(socket.id, 'ability-active', '🃏 الجوكر! حُذف خياران خاطئان');
  });

  // ── POINTS STORE ──────────────────────────────────────────
  socket.on('host:open-store', () => {
    if (G.storeTimer) clearTimeout(G.storeTimer);
    G.storeOpen = true;
    G.storePurchases = {};
    const storeItems = [
      { id: 'hint',       icon: '💡', name: 'تلميح تلقائي',    desc: 'يُكشف تلميح السؤال القادم تلقائياً',        cost: 200 },
      { id: 'eliminate',  icon: '🗑️', name: 'حذف خيار خاطئ',  desc: 'يُحذف خيار خاطئ في السؤال القادم',         cost: 300 },
      { id: 'multiplier', icon: '⚡', name: 'مضاعف النقاط ×1.5', desc: 'نقاطك في السؤال القادم ×1.5 إذا أجبت صح', cost: 250 },
    ];
    io.emit('game:store-open', { items: storeItems, duration: 30 });
    G.storeTimer = setTimeout(() => {
      G.storeOpen = false;
      io.emit('game:store-closed');
    }, 30000);
    socket.emit('host:store-opened', { duration: 30 });
  });

  socket.on('host:close-store', () => {
    if (!G.storeOpen) return;
    if (G.storeTimer) clearTimeout(G.storeTimer);
    G.storeOpen = false;
    io.emit('game:store-closed');
    socket.emit('host:store-closed-confirm');
  });

  socket.on('host:start-store-vote', () => {
    if (G.storeVoteActive || G.storeOpen) return;
    const total = Object.keys(G.players).length;
    if (total === 0) return;
    G.storeVoteActive       = true;
    G.storeVoted            = new Set();
    G.storeVoteYes          = 0;
    G.storeVoteNo           = 0;
    G._storeVoteHostSocket  = socket;
    const duration          = 15;
    G.storeVoteEndTime = Date.now() + duration * 1000;
    io.emit('game:store-vote-start', { duration });
    socket.emit('host:store-vote-started');

    function finalizeVote() {
      if (!G.storeVoteActive) return;
      G.storeVoteActive = false;
      clearTimeout(G.storeVoteTimer);
      const yes = G.storeVoteYes, no = G.storeVoteNo;
      const open = yes >= no;
      io.emit('game:store-vote-result', { yes, no, open });
      socket.emit('host:store-vote-result', { yes, no, open });
      if (open) {
        if (G.storeTimer) clearTimeout(G.storeTimer);
        G.storeOpen = true;
        G.storePurchases = {};
        const storeItems = [
          { id: 'hint',       icon: '💡', name: 'تلميح تلقائي',      desc: 'يُكشف تلميح السؤال القادم',        cost: 200 },
          { id: 'eliminate',  icon: '🗑️', name: 'حذف خيار خاطئ',    desc: 'يُحذف خيار خاطئ في السؤال القادم', cost: 300 },
          { id: 'multiplier', icon: '⚡', name: 'مضاعف النقاط ×1.5', desc: 'نقاطك ×1.5 إذا أجبت صح',           cost: 250 },
        ];
        io.emit('game:store-open', { items: storeItems, duration: 30 });
        G._storeVoteHostSocket?.emit('host:store-opened', { duration: 30 });
        G.storeTimer = setTimeout(() => { G.storeOpen = false; io.emit('game:store-closed'); G._storeVoteHostSocket?.emit('host:store-closed-confirm'); }, 30000);
      }
    }

    G.storeVoteTimer = setTimeout(finalizeVote, duration * 1000);
  });

  socket.on('player:store-vote', ({ vote }) => {
    if (!G.storeVoteActive) return;
    if (G.storeVoted.has(socket.id)) return;
    if (!G.players[socket.id]) return;
    G.storeVoted.add(socket.id);
    if (vote === 'yes') G.storeVoteYes++; else G.storeVoteNo++;
    const tally = { yes: G.storeVoteYes, no: G.storeVoteNo, total: Object.keys(G.players).length, voted: G.storeVoted.size };
    G._storeVoteHostSocket?.emit('host:store-vote-tally', tally);
    io.emit('game:store-vote-tally', tally);
  });

  socket.on('player:buy-store-item', ({ itemId }) => {
    if (!G.storeOpen) { socket.emit('game:notify', { type: 'error', msg: '⚠️ المتجر مغلق الآن' }); return; }
    const p = G.players[socket.id];
    if (!p) return;
    const costs = { hint: 200, eliminate: 300, multiplier: 250 };
    const cost  = costs[itemId];
    if (!cost) return;
    if (!G.storePurchases[socket.id]) G.storePurchases[socket.id] = {};
    if (G.storePurchases[socket.id][itemId]) { socket.emit('game:notify', { type: 'error', msg: '⚠️ اشتريت هذا بالفعل!' }); return; }
    if (p.points < cost) { socket.emit('game:notify', { type: 'error', msg: `⚠️ نقاطك (${p.points}) غير كافية! تحتاج ${cost}` }); return; }
    p.points -= cost;
    G.storePurchases[socket.id][itemId] = true;
    socket.emit('game:store-purchased', { itemId, newPoints: p.points, cost });
    const icons = { hint: '💡', eliminate: '🗑️', multiplier: '⚡' };
    G._storeVoteHostSocket?.emit('host:store-purchase', { playerName: p.name, itemId, icon: icons[itemId] || '🛒', cost });
    io.emit('game:leaderboard', leaderboard());
    io.emit('game:players-update', publicPlayers());
  });

  socket.on('disconnect', () => {
    const p = G.players[socket.id];
    if (!p) return;

    if (G.reverseOffers[socket.id]) {
      clearTimeout(G.reverseOffers[socket.id].timeout);
      delete G.reverseOffers[socket.id];
    }

    if (G.active) G.escapedPlayers.add(p.persistentId);

    p.offline = true;
    io.emit('game:players-update', publicPlayers());
    io.emit('game:leaderboard', leaderboard());

    G.disconnectTimers[p.persistentId] = setTimeout(() => {
      const player = findByPid(p.persistentId);
      if (player && player.offline) {
        delete G.players[player.id];
        delete G.effects[player.id];
        io.emit('game:players-update', publicPlayers());
        io.emit('game:leaderboard', leaderboard());
      }
      delete G.disconnectTimers[p.persistentId];
    }, 5 * 60 * 1000);
  });
});

// ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`\n🎮 Quiz Live — http://localhost:${PORT}`);
  console.log(`   🎛️  Host        → http://localhost:${PORT}/host`);
  console.log(`   🎮  Play        → http://localhost:${PORT}/play`);
  console.log(`   🏆  Leaderboard → http://localhost:${PORT}/leaderboard\n`);
});
