const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.static(path.join(__dirname, 'public')));
app.get('/host', (_, res) => res.sendFile(path.join(__dirname, 'public', 'host.html')));
app.get('/play', (_, res) => res.sendFile(path.join(__dirname, 'public', 'play.html')));
app.get('/leaderboard', (_, res) => res.sendFile(path.join(__dirname, 'public', 'leaderboard.html')));

// ─────────────────────────────────────────────────────────────
// GAME STATE
// ─────────────────────────────────────────────────────────────
const QUESTION_TIME = 20; // ← تم تغييره من 30 إلى 20

let G = newState();

function newState() {
  return {
    players: {},
    question: null,
    qNum: 0,
    active: false,
    timeLeft: QUESTION_TIME,
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
    isLastQuestion: false, // ← جديد: السؤال الأخير
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
  }));
}

function notify(targetId, type, msg) {
  io.to(targetId).emit('game:notify', { type, msg });
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

  if (type === 'hole') {
    G.effects[attackerId] = { ...(G.effects[attackerId] || {}), holeTarget: targetId };
    notify(targetId, 'hole-incoming', `⚠️ ${attacker.name} فتح ثقباً! سيسرق نقاطك`);
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
  }

  return { ok: true, success: true };
}

// ─────────────────────────────────────────────────────────────
// END QUESTION
// ─────────────────────────────────────────────────────────────
function endQuestion() {
  if (!G.active) return;
  clearInterval(G.timerRef);
  G.active = false;
  G.retryPending  = {};
  G.revivalPending = {};

  const q = G.question;
  const results = {};

  // Phase 1 – حساب النقاط لكل لاعب
  Object.values(G.players).forEach(p => {
    const ans  = G.answers[p.id];
    const eff  = G.effects[p.id] || {};
    const correct = ans && ans.choice === q.correctAnswer;
    let delta = 0;

    if (correct) {
      const base  = 100;
      const speed = ans ? Math.floor((ans.timeLeft / QUESTION_TIME) * 50) : 0;
      let pts = base + speed;
      if (p.streak >= 5)      pts = Math.floor(pts * 2);
      else if (p.streak >= 3) pts = Math.floor(pts * 1.5);
      if (eff.doubleRisk)     pts *= 2;
      delta = pts;
      p.lastStreak = p.streak;
      p.streak++;
    } else {
      if (eff.doubleRisk && ans) delta = -100;
      p.lastStreak = p.streak;
      if (!eff.revival) p.streak = 0;
    }

    results[p.id] = { isCorrect: correct, delta, choice: ans?.choice ?? null, streak: p.streak, timeTaken: ans ? (QUESTION_TIME - ans.timeLeft) : null };
  });

  // Phase 2 – معالجة هجمات الثقب
  Object.entries(G.effects).forEach(([attackerId, eff]) => {
    if (!eff.holeTarget) return;
    const tid     = eff.holeTarget;
    const target  = G.players[tid];
    const attacker= G.players[attackerId];
    if (!target || !attacker) return;

    const tEff   = G.effects[tid]   || {};
    const aResult = results[attackerId] || { delta: 0 };
    const tResult = results[tid]        || { delta: 0 };

    if (tEff.reverse) {
      tEff.reverse = false;
      const lost = Math.max(0, aResult.delta);
      results[attackerId] = { ...aResult, delta: -lost, reflected: true };
      notify(attackerId, 'attack-reflected', `${target.name} عكس الثقب!`);
      notify(tid,        'reverse-fired',    '🔄 درع الانعكاس انطلق!');
    } else if (tEff.immunity) {
      tEff.immunity = false;
      notify(attackerId, 'attack-blocked', `${target.name} محصن!`);
      notify(tid,        'immunity-saved',  '🛡️ الحصانة أنقذتك!');
    } else {
      const stolen = Math.max(0, tResult.delta);
      if (stolen > 0) {
        results[tid] = { ...tResult, delta: -stolen, holed: true };
        notify(tid, 'holed', `💀 ${attacker.name} سرق نقاطك!`);
      }
    }
  });

  // Phase 2.5 – مضاعفة النقاط للسؤال الأخير ×2
  if (G.isLastQuestion) {
    Object.keys(results).forEach(pid => {
      if (results[pid].delta > 0) {
        results[pid].delta *= 2;
        results[pid].doubled = true;
      }
    });
  }

  // Phase 3 – تطبيق النقاط
  Object.values(G.players).forEach(p => {
    const r = results[p.id] || { delta: 0 };
    p.points = Math.max(0, p.points + r.delta);
  });

  // Phase 4 – تحضير تأثيرات السؤال القادم
  const newEff = {};
  Object.keys(G.players).forEach(pid => {
    newEff[pid] = { cut: G.nextEffects[pid]?.cut || false, frozen: G.nextEffects[pid]?.frozen || false };
  });
  G.effects      = newEff;
  G.nextEffects  = {};

  io.emit('game:question-end', {
    correctAnswer: q.correctAnswer,
    results,
    leaderboard: leaderboard(),
    qNum: G.qNum,
    wasLastQuestion: G.isLastQuestion,
  });
  io.emit('game:leaderboard', leaderboard());

  // Phase 5 – الفرصة الأخيرة: كل سؤالين يحصل الأخير على خاصية مجانية
  if (G.qNum % 2 === 0 && !G.isLastQuestion) {
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
  G.timeLeft  = QUESTION_TIME;
  G.answers   = {};
  G.retryPending   = {};
  G.revivalPending = {};

  Object.keys(G.players).forEach(pid => {
    G.effects[pid] = {
      cut:       G.effects[pid]?.cut    || false,
      frozen:    G.effects[pid]?.frozen || false,
      immunity:  G.effects[pid]?.immunity || false,
      reverse:   G.effects[pid]?.reverse  || false,
      doubleRisk:false,
      revival:   false,
      retry:     false,
      holeTarget:null,
    };
  });

  const playerQ = { text: G.question.text, options: G.question.options, number: G.qNum };
  io.emit('game:question-start', {
    question: playerQ,
    timeLeft: QUESTION_TIME,
    isLastQuestion: G.isLastQuestion,
  });

  Object.entries(G.effects).forEach(([pid, eff]) => {
    if (eff.cut)    io.to(pid).emit('game:notify', { type: 'cut-active',    msg: '✂️ أنت مقطوع! لا يمكنك الإجابة' });
    if (eff.frozen) io.to(pid).emit('game:notify', { type: 'frozen-active', msg: '❄️ أنت مجمد! لا يمكنك استخدام الخصائص' });
  });

  // ← أي reverse offer معلق لم يُردّ عليه: أعطِ المدافع ثانيتين إضافيتين ثم طبّق الهجوم
  Object.entries(G.reverseOffers).forEach(([targetId, offer]) => {
    clearTimeout(offer.timeout);
    offer.timeout = setTimeout(() => {
      delete G.reverseOffers[targetId];
      applyAttack(offer.attackerId, offer.type, targetId, offer.immediate, true);
    }, 2000);
  });

  G.timerRef = setInterval(() => {
    G.timeLeft--;
    io.emit('game:timer', G.timeLeft);
    if (G.timeLeft <= 0) endQuestion();
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

    G.question = qData;
    G.qNum++;
    G.isLastQuestion = qData.isLastQuestion || false;

    Object.keys(G.players).forEach(pid => {
      if (!G.effects[pid]) G.effects[pid] = {};
    });

    socket.emit('host:question-confirmed', { question: qData, number: G.qNum });

    const preTypes = ['freeze','cut','immunity'];
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
    }, 4000);
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
        if (ab && !ab.used && ab.type === type && ['freeze','cut','immunity'].includes(ab.type)) {
          if (ab.type === 'immunity') {
            ab.used = true;
            if (!G.effects[socket.id]) G.effects[socket.id] = {};
            G.effects[socket.id].immunity = true;
            io.to(socket.id).emit('ability:result', { type: 'immunity', status: 'active' });
            notify(socket.id, 'shield-active', '🛡️ الحصانة مفعّلة!');
          } else if (targetId && G.players[targetId] && targetId !== socket.id) {
            const res = applyAttack(socket.id, ab.type, targetId, true);
            if (res.ok) {
              ab.used = true;
              const st = res.reflected ? 'reflected' : res.blocked ? 'blocked' : 'success';
              io.to(socket.id).emit('ability:result', { type: ab.type, status: st, target: G.players[targetId]?.name });
            }
          }
          io.emit('game:players-update', publicPlayers());
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
  });

  socket.on('host:end-game', () => {
    clearInterval(G.timerRef);
    G.active = false;
    G.preQ   = false;
    const lb = leaderboard();
    io.emit('game:final', { top3: lb.slice(0, 3), leaderboard: lb });
  });

  // ── إعلان السؤال الأخير ──────────────────────────────────
  socket.on('host:announce-last-question', () => {
    G.isLastQuestion = true;
    io.emit('game:last-question-announcement');
    socket.emit('host:announcement-sent');
  });

  socket.on('host:reset', () => {
    clearInterval(G.timerRef);
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
        question: G.active ? { text: G.question.text, options: G.question.options, number: G.qNum } : null,
        timeLeft: G.timeLeft,
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
      id:           socket.id,
      persistentId: persistentId || socket.id,
      name:         String(name).trim().slice(0, 20),
      avatar,
      points:       0,
      streak:       0,
      lastStreak:   0,
      offline:      false,
      bonusAbility: null,
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

  socket.on('player:answer', ({ choice }) => {
    if (!G.active) return;
    const eff = G.effects[socket.id] || {};
    if (eff.cut)    { socket.emit('game:notify', { type: 'cut-active',    msg: '✂️ لا يمكنك الإجابة!' }); return; }
    if (eff.frozen) { socket.emit('game:notify', { type: 'frozen-active', msg: '❄️ أنت مجمد! لا يمكنك الإجابة أو استخدام الخصائص' }); return; }

    const existing = G.answers[socket.id];

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
      case 'hole': case 'freeze': case 'cut': {
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
    }

    if (used) {
      if (isBonusAbility) p.bonusAbility.used = true;
      else ability.used = true;
    }
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
