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
let G = newState();

function newState() {
  return {
    players: {},       // id → {id,name,emoji,points,streak,lastStreak,abilities}
    question: null,    // {text, options:[4], correctAnswer:0-3, hint?}
    qNum: 0,
    active: false,
    timeLeft: 30,
    timerRef: null,
    answers: {},       // id → {choice, timeLeft, isRetry?}
    effects: {},       // id → {cut,frozen,immunity,reverse,doubleRisk,revival,retry,holeTarget}
    nextEffects: {},   // id → {cut?,frozen?}
    retryPending: {},  // id → true
    revivalPending: {},// id → true
  };
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function leaderboard() {
  return Object.values(G.players)
    .sort((a, b) => b.points - a.points)
    .map((p, i) => ({ rank: i + 1, id: p.id, name: p.name, emoji: p.emoji, points: p.points, streak: p.streak }));
}

function publicPlayers() {
  return Object.values(G.players).map(p => ({
    id: p.id, name: p.name, emoji: p.emoji, points: p.points, streak: p.streak,
  }));
}

function notify(targetId, type, msg) {
  io.to(targetId).emit('game:notify', { type, msg });
}

// ─────────────────────────────────────────────────────────────
// APPLY ATTACK (with reverse/immunity checks)
// ─────────────────────────────────────────────────────────────
function applyAttack(attackerId, type, targetId) {
  const attacker = G.players[attackerId];
  const target   = G.players[targetId];
  if (!target || !attacker) return { ok: false };

  const tEff = G.effects[targetId] || {};

  if (tEff.reverse) {
    tEff.reverse = false;
    if (type === 'freeze') G.nextEffects[attackerId] = { ...(G.nextEffects[attackerId] || {}), frozen: true };
    if (type === 'cut')    G.nextEffects[attackerId] = { ...(G.nextEffects[attackerId] || {}), cut: true };
    if (type === 'hole')   G.effects[targetId] = { ...(G.effects[targetId] || {}), holeTarget: attackerId };
    notify(attackerId, 'attack-reflected', `${target.emoji} ${target.name} عكس هجومك!`);
    notify(targetId,   'reverse-fired',    '🔄 درع الانعكاس انطلق!');
    return { ok: true, reflected: true };
  }

  if (tEff.immunity) {
    tEff.immunity = false;
    notify(attackerId, 'attack-blocked', `${target.emoji} ${target.name} محصن!`);
    notify(targetId,   'immunity-saved',  '🛡️ الحصانة أنقذتك!');
    return { ok: true, blocked: true };
  }

  if (type === 'hole') {
    G.effects[attackerId] = { ...(G.effects[attackerId] || {}), holeTarget: targetId };
    notify(targetId, 'hole-incoming', `⚠️ ${attacker.emoji} ${attacker.name} فتح ثقباً! سيسرق نقاطك`);
  } else if (type === 'freeze') {
    G.nextEffects[targetId] = { ...(G.nextEffects[targetId] || {}), frozen: true };
    notify(targetId, 'frozen-incoming', `❄️ ${attacker.emoji} ${attacker.name} جمّدك! لا خصائص في السؤال القادم`);
  } else if (type === 'cut') {
    G.nextEffects[targetId] = { ...(G.nextEffects[targetId] || {}), cut: true };
    notify(targetId, 'cut-incoming', `✂️ ${attacker.emoji} ${attacker.name} قطعك! لا إجابة في السؤال القادم`);
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

  // Phase 1 – calculate per-player deltas
  Object.values(G.players).forEach(p => {
    const ans  = G.answers[p.id];
    const eff  = G.effects[p.id] || {};
    const correct = ans && ans.choice === q.correctAnswer;
    let delta = 0;

    if (correct) {
      const base  = 100;
      const speed = ans ? Math.floor((ans.timeLeft / 30) * 50) : 0;
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

    results[p.id] = { isCorrect: correct, delta, choice: ans?.choice ?? null, streak: p.streak };
  });

  // Phase 2 – process hole attacks
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
      notify(attackerId, 'attack-reflected', `${target.emoji} ${target.name} عكس الثقب!`);
      notify(tid,        'reverse-fired',    '🔄 درع الانعكاس انطلق!');
    } else if (tEff.immunity) {
      tEff.immunity = false;
      notify(attackerId, 'attack-blocked', `${target.emoji} ${target.name} محصن!`);
      notify(tid,        'immunity-saved',  '🛡️ الحصانة أنقذتك!');
    } else {
      const stolen = Math.max(0, tResult.delta);
      if (stolen > 0) {
        results[tid] = { ...tResult, delta: -stolen, holed: true };
        notify(tid, 'holed', `💀 ${attacker.emoji} ${attacker.name} سرق نقاطك!`);
      }
    }
  });

  // Phase 3 – apply deltas
  Object.values(G.players).forEach(p => {
    const r = results[p.id] || { delta: 0 };
    p.points = Math.max(0, p.points + r.delta);
  });

  // Phase 4 – set next-question effects
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
  });
  io.emit('game:leaderboard', leaderboard());
}

// ─────────────────────────────────────────────────────────────
// SOCKET.IO
// ─────────────────────────────────────────────────────────────
io.on('connection', socket => {
  // Send snapshot to newcomer
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
    if (G.active) return;
    clearInterval(G.timerRef);

    G.question = qData;
    G.qNum++;
    G.active   = true;
    G.timeLeft = 30;
    G.answers  = {};
    G.retryPending   = {};
    G.revivalPending = {};

    // Reset per-question transient effects (keep cut/frozen from previous)
    Object.keys(G.players).forEach(pid => {
      G.effects[pid] = {
        cut:       G.effects[pid]?.cut    || false,
        frozen:    G.effects[pid]?.frozen || false,
        immunity:  false,
        reverse:   false,
        doubleRisk:false,
        revival:   false,
        retry:     false,
        holeTarget:null,
      };
    });

    const playerQ = { text: qData.text, options: qData.options, number: G.qNum };
    io.emit('game:question-start', { question: playerQ, timeLeft: 30 });

    // Notify restricted players
    Object.entries(G.effects).forEach(([pid, eff]) => {
      if (eff.cut)    io.to(pid).emit('game:notify', { type: 'cut-active',    msg: '✂️ أنت مقطوع! لا يمكنك الإجابة على هذا السؤال' });
      if (eff.frozen) io.to(pid).emit('game:notify', { type: 'frozen-active', msg: '❄️ أنت مجمد! لا يمكنك استخدام الخصائص' });
    });

    socket.emit('host:question-confirmed', { question: qData, number: G.qNum });

    G.timerRef = setInterval(() => {
      G.timeLeft--;
      io.emit('game:timer', G.timeLeft);
      if (G.timeLeft <= 0) endQuestion();
    }, 1000);
  });

  socket.on('host:end-question', () => endQuestion());

  socket.on('host:reset', () => {
    clearInterval(G.timerRef);
    G = newState();
    io.emit('game:reset');
  });

  // ── PLAYER ─────────────────────────────────────────────────
  socket.on('player:join', ({ name, emoji, abilities }) => {
    if (G.players[socket.id]) return;

    G.players[socket.id] = {
      id:         socket.id,
      name:       String(name).trim().slice(0, 20),
      emoji,
      points:     0,
      streak:     0,
      lastStreak: 0,
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

  socket.on('player:answer', ({ choice }) => {
    if (!G.active) return;
    const eff = G.effects[socket.id] || {};
    if (eff.cut) { socket.emit('game:notify', { type: 'cut-active', msg: '✂️ لا يمكنك الإجابة!' }); return; }

    const existing = G.answers[socket.id];

    // Retry flow
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

    // Offer retry / revival if wrong
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
      }
    }

    const answered = Object.keys(G.answers).length;
    const total    = Object.keys(G.players).length;
    io.emit('host:answer-stats', { answered, total });
  });

  socket.on('player:use-revival', () => {
    if (!G.revivalPending[socket.id]) return;
    const p = G.players[socket.id];
    if (!p || p.abilities.general.type !== 'revival' || p.abilities.general.used) return;
    p.abilities.general.used = true;
    G.effects[socket.id].revival = true;
    delete G.revivalPending[socket.id];
    socket.emit('ability:result', { type: 'revival', status: 'used' });
    notify(socket.id, 'revival-active', '✨ الإنعاش فعّال! ستحتفظ بستريكك');
  });

  socket.on('player:use-ability', ({ category, targetId }) => {
    if (!G.active) return;
    const p = G.players[socket.id];
    if (!p) return;

    const ability = p.abilities[category];
    if (!ability || ability.used) {
      socket.emit('game:notify', { type: 'error', msg: '⚠️ لقد استخدمت هذه الخاصية مسبقاً!' }); return;
    }

    const eff = G.effects[socket.id] || {};
    if (eff.frozen) {
      socket.emit('game:notify', { type: 'error', msg: '❄️ أنت مجمد! لا يمكنك استخدام الخصائص' }); return;
    }

    let used = false;

    switch (ability.type) {
      case 'hole': case 'freeze': case 'cut': {
        if (!targetId || !G.players[targetId] || targetId === socket.id) {
          socket.emit('game:notify', { type: 'error', msg: '⚠️ اختر لاعباً هدفاً!' }); return;
        }
        const res = applyAttack(socket.id, ability.type, targetId);
        if (res.ok) {
          used = true;
          if (res.reflected) socket.emit('ability:result', { type: ability.type, status: 'reflected' });
          else if (res.blocked) socket.emit('ability:result', { type: ability.type, status: 'blocked' });
          else socket.emit('ability:result', { type: ability.type, status: 'success', target: G.players[targetId]?.name });
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
        notify(socket.id, 'ability-active', '↩️ الإعادة جاهزة! ستحصل على فرصة ثانية إذا أخطأت');
        break;
      case 'doubleRisk':
        G.effects[socket.id].doubleRisk = true;
        used = true;
        socket.emit('ability:result', { type: 'doubleRisk', status: 'active' });
        notify(socket.id, 'ability-active', '⚡ مضاعف الخطر! صح = ضعف، غلط = خسارة');
        break;
      case 'hint':
        socket.emit('game:hint', { hint: G.question?.hint || 'لا يوجد تلميح لهذا السؤال' });
        used = true;
        socket.emit('ability:result', { type: 'hint', status: 'used' });
        break;
      case 'revival':
        G.effects[socket.id].revival = true;
        used = true;
        socket.emit('ability:result', { type: 'revival', status: 'active' });
        notify(socket.id, 'ability-active', '✨ الإنعاش جاهز! ستحتفظ بستريكك إذا أخطأت');
        break;
    }

    if (used) ability.used = true;
    io.emit('game:players-update', publicPlayers());
  });

  socket.on('disconnect', () => {
    if (G.players[socket.id]) {
      delete G.players[socket.id];
      delete G.effects[socket.id];
      io.emit('game:players-update', publicPlayers());
      io.emit('game:leaderboard', leaderboard());
    }
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
