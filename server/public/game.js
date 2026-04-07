// IMPOSTER — game.js  (Vanilla JS + Socket.io, lightweight)

const COLORS = [
  '#7c3aed','#06b6d4','#f43f5e','#f59e0b',
  '#10b981','#0ea5e9','#ec4899','#84cc16','#f97316','#14b8a6',
];

const S = {
  mySocketId: null, myName: '', roomId: null, isHost: false,
  players: [], roundDuration: 300, timeRemaining: 300,
  myWord: null, myRole: null, messages: [],
  currentTurnSocketId: null, currentTurnName: null,
  confirming: null,
  scores: {},          // { socketId: totalScore } — persists across rounds
  roundsPlayed: 0,     // how many rounds have finished
};

// ── Helpers ────────────────────────────────────────
const $ = id => document.getElementById(id);
const colorFor = i => COLORS[i % COLORS.length];
const me = () => S.players.find(p => p.socketId === S.mySocketId);
const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

function showScreen(name) {
  ['landing','lobby','wordflash','playing','roundover'].forEach(n => {
    const el = $('screen-' + n);
    if (el) el.style.display = n === name ? '' : 'none';
  });
}

function fmt(secs) {
  return `${Math.floor(secs/60)}:${String(secs%60).padStart(2,'0')}`;
}

function av(color, initial, size) {
  const s = size === 'sm' ? 'width:30px;height:30px;font-size:.78rem'
          : size === 'lg' ? 'width:50px;height:50px;font-size:1.2rem'
          : 'width:40px;height:40px;font-size:1rem';
  return `<div style="${s};background:${color};border-radius:50%;display:inline-flex;
    align-items:center;justify-content:center;font-weight:900;color:#fff;flex-shrink:0">${initial}</div>`;
}

function showErr(id, msg, ms = 4000) {
  const el = $(id); if (!el) return;
  el.textContent = msg; el.style.display = 'block';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.display = 'none'; }, ms);
}

function copyText(t) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(t).catch(() => fallCopy(t));
  } else { fallCopy(t); }
}
function fallCopy(t) {
  const el = Object.assign(document.createElement('textarea'),
    {value:t, style:'position:fixed;opacity:0'});
  document.body.appendChild(el); el.select();
  document.execCommand('copy'); el.remove();
}

// ── Socket ─────────────────────────────────────────
const socket = io();
socket.on('connect', () => { S.mySocketId = socket.id; });

// ══════════════════════════════════════════════════
// LANDING
// ══════════════════════════════════════════════════
function initLanding() {
  $('create-btn').onclick = () => {
    const name = $('name-input').value.trim();
    if (!name) { showErr('landing-error','Enter your name.'); return; }
    S.myName = name;
    socket.emit('create-room', { name, avatar: 'auto' });
  };
  $('join-btn').onclick = () => {
    const name = $('name-input').value.trim();
    const code = $('code-input').value.trim().toUpperCase();
    if (!name) { showErr('landing-error','Enter your name.'); return; }
    if (!code) { showErr('landing-error','Enter a room code.'); return; }
    S.myName = name;
    socket.emit('join-room', { roomId: code, name, avatar: 'auto' });
  };
  $('code-input').onkeydown = e => { if (e.key==='Enter') $('join-btn').click(); };
  $('name-input').onkeydown = e => { if (e.key==='Enter') $('create-btn').click(); };
}

// ══════════════════════════════════════════════════
// LOBBY
// ══════════════════════════════════════════════════
function renderLobby() {
  $('room-code-display').textContent = S.roomId;
  renderDurationCard();
  renderLobbyPlayers();
  $('copy-btn').onclick = () => {
    copyText(S.roomId);
    $('copy-btn').textContent = '✓ Copied!';
    setTimeout(() => $('copy-btn').textContent = '📋 Copy', 2000);
  };
  $('start-btn').onclick = () => socket.emit('start-game', { roomId: S.roomId });
  updateStartBtn();
}

function renderDurationCard() {
  const OPTS = [{v:180,l:'3 min',d:'Quick'},{v:300,l:'5 min',d:'Standard'},{v:480,l:'8 min',d:'Extended'}];
  $('duration-card').innerHTML = `
    <p class="section-label">ROUND DURATION</p>
    <div class="duration-options">
      ${OPTS.map(o=>`
        <div class="dur-btn ${S.roundDuration===o.v?'active':''}" onclick="setDur(${o.v})">
          <span class="dlabel">${o.l}</span><span class="ddesc">${o.d}</span>
        </div>`).join('')}
    </div>`;
}
window.setDur = dur => {
  if (!S.isHost) return;
  socket.emit('set-round-duration', { roomId: S.roomId, duration: dur });
};

function renderLobbyPlayers() {
  const hasScores = Object.values(S.scores).some(s => s > 0);
  const slots = Math.max(0, 4 - S.players.length);

  $('player-list').innerHTML =
    S.players.map((p, i) => {
      const isMe = p.socketId === S.mySocketId;
      const sc = S.scores[p.socketId] ?? 0;
      return `
        <div class="player-row">
          ${av(colorFor(i), p.name[0].toUpperCase(), 'sm')}
          <div class="player-info">
            <div class="player-name-row">
              ${esc(p.name)}
              ${isMe ? '<span class="you-tag">You</span>' : ''}
            </div>
            ${p.isHost ? '<span class="host-tag">👑 Host</span>' : ''}
          </div>
          ${hasScores ? `<span class="score-chip">${sc} pt${sc!==1?'s':''}</span>` : ''}
        </div>`;
    }).join('') +
    Array.from({length: slots}, () =>
      `<div class="player-row empty">
        <div class="empty-q">?</div>
        <span style="color:var(--muted);font-size:.83rem">Waiting…</span>
      </div>`).join('');

  // Leaderboard banner — shows after at least 1 round
  const sbEl = $('scoreboard-banner');
  if (sbEl) {
    if (hasScores) {
      const ranked = [...S.players].sort((a, b) =>
        (S.scores[b.socketId] ?? 0) - (S.scores[a.socketId] ?? 0));
      sbEl.style.display = '';
      sbEl.innerHTML = `
        <div class="sb-title">🏆 Leaderboard — After Round ${S.roundsPlayed}</div>
        <div class="sb-rows">
          ${ranked.map((p, i) => {
            const sc = S.scores[p.socketId] ?? 0;
            const isMe = p.socketId === S.mySocketId;
            const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}.`;
            const idx = S.players.findIndex(x => x.socketId === p.socketId);
            return `<div class="sb-row ${isMe ? 'sb-me' : ''}">
              <span class="sb-rank">${medal}</span>
              ${av(colorFor(idx), p.name[0].toUpperCase(), 'sm')}
              <span class="sb-name">${esc(p.name)}${isMe?' <span class="you-tag">You</span>':''}</span>
              <span class="sb-score">${sc} pts</span>
            </div>`;
          }).join('')}
        </div>`;
    } else {
      sbEl.style.display = 'none';
    }
  }

  $('player-count-badge').textContent = `${S.players.length}/12`;
  const need = 4 - S.players.length;
  const ok = S.players.length >= 4;
  $('count-status').className = 'count-status ' + (ok ? 'ready' : 'waiting');
  $('count-status').textContent = ok ? '✅ Ready to start!'
    : `⏳ Need ${need} more player${need !== 1 ? 's' : ''}`;
}

function updateStartBtn() {
  const ok = S.players.length >= 4;
  $('start-btn').disabled = !ok || !S.isHost;
  $('start-btn').textContent = ok ? '🚀 Start Game' : `⏳ Waiting (${S.players.length}/4)`;
}

// ══════════════════════════════════════════════════
// WORD FLASH — same neutral style for everyone
// ══════════════════════════════════════════════════
let flashTimer = null;
function showWordFlash(word, role) {
  S.myWord = word; S.myRole = role;
  // Role badge: same neutral styling for both crewmate and imposter
  const badge = $('role-badge');
  badge.className = 'role-badge neutral';
  badge.textContent = role === 'imposter' ? '🎭 You are the Imposter' : '👤 You are a Crewmate';
  // Word: same neutral styling for everyone — only the text differs
  const wordEl = $('flash-word');
  wordEl.textContent = word;
  wordEl.className = 'flash-word';  // no imp/crew class — same look for all

  let n = 5; const circ = 188.5;
  $('countdown-num').textContent = n;
  $('ring-fill').style.strokeDashoffset = 0;
  clearInterval(flashTimer);
  flashTimer = setInterval(() => {
    n--; if (n < 0) { clearInterval(flashTimer); return; }
    $('countdown-num').textContent = n;
    $('ring-fill').style.strokeDashoffset = circ * (1 - n / 5);
  }, 1000);
}

// ══════════════════════════════════════════════════
// PLAYING
// ══════════════════════════════════════════════════
function renderPlaying() {
  renderGameHeader();
  renderTimer();
  renderTurnBanner();
  renderChatInput();
  renderPlayerGrid();
}

function renderGameHeader() {
  const p = me(); if (!p) return;
  const idx = S.players.findIndex(pl => pl.socketId === S.mySocketId);
  const maxC = S.players.length === 4 ? 2 : 3;
  $('hdr-code').textContent = '#' + S.roomId;
  $('hdr-chances').innerHTML = Array.from({length:maxC},(_,i)=>
    `<div class="cdot ${i<(p.chancesLeft??0)?'':'used'}"></div>`).join('');
  $('hdr-me').innerHTML = `${av(colorFor(idx), p.name[0].toUpperCase(), 'sm')}
    <span>${esc(p.name)}</span>
    ${p.isEliminated ? '<span class="badge badge-red" style="margin-left:6px">Out</span>' : ''}
    ${p.hasGuessedCorrectly ? '<span class="badge badge-green" style="margin-left:6px">Found ✓</span>' : ''}`;
}

function renderTimer() {
  const pct = S.roundDuration > 0 ? (S.timeRemaining / S.roundDuration) * 100 : 0;
  const urgent = S.timeRemaining <= 30;
  $('timer-fill').style.cssText = `width:${pct}%;background:${urgent?'var(--red)':'var(--violet)'}`;
  const val = $('timer-val');
  val.textContent = fmt(S.timeRemaining);
  val.className = 'timer-val' + (urgent ? ' urgent' : '');
}

function renderTurnBanner() {
  const isMyTurn = S.currentTurnSocketId === S.mySocketId;
  const p = me();
  const inactive = p?.isEliminated || p?.hasGuessedCorrectly;
  $('turn-banner').className = 'turn-banner ' + (isMyTurn ? 'my-turn' : 'their-turn');
  $('turn-icon').textContent = isMyTurn ? '🎯' : '⏳';
  if (inactive) {
    $('turn-text').innerHTML = p.isEliminated
      ? '<strong>💀 Eliminated</strong>'
      : '<strong>✅ You found the imposter!</strong>';
  } else if (isMyTurn) {
    $('turn-text').innerHTML = '<strong>Your turn!</strong> Describe your word in chat.';
  } else {
    $('turn-text').innerHTML = `Waiting for <strong>${esc(S.currentTurnName??'…')}</strong> to describe…`;
  }
}

// Chat — only current turn player can type
function renderChatInput() {
  const isMyTurn = S.currentTurnSocketId === S.mySocketId;
  const p = me();
  const area = $('chat-input-area');

  if (p?.isEliminated) {
    area.innerHTML = '<div class="chat-locked red">💀 You are eliminated.</div>';
    return;
  }
  if (!isMyTurn) {
    area.innerHTML = '<div class="chat-locked grey">⏳ Wait for your turn to describe…</div>';
    return;
  }

  area.innerHTML = `
    <textarea id="chat-input" class="chat-input" rows="2"
      placeholder="Describe your word… (Enter to send)" maxlength="200"></textarea>
    <button id="send-btn" class="btn btn-primary btn-sm">Send ↵</button>`;

  function doSend() {
    const t = $('chat-input').value.trim();
    if (!t) return;
    socket.emit('send-message', { roomId: S.roomId, text: t });
    $('chat-input').value = '';
  }
  $('chat-input').onkeydown = e => { if (e.key==='Enter'&&!e.shiftKey){e.preventDefault();doSend();} };
  $('send-btn').onclick = doSend;
  $('chat-input').focus();
}

function addMessage(msg) {
  const feed = $('chat-messages');
  if (feed.querySelector('.chat-empty')) feed.innerHTML = '';
  const isMine = msg.senderSocketId === S.mySocketId;
  const idx = S.players.findIndex(p => p.socketId === msg.senderSocketId);
  const col = colorFor(idx >= 0 ? idx : 0);
  const time = new Date(msg.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  const row = document.createElement('div');
  row.className = 'msg-row ' + (isMine?'mine':'theirs');
  row.innerHTML = `
    ${!isMine ? `<div class="msg-avatar">${av(col, msg.senderName[0].toUpperCase(),'sm')}</div>` : ''}
    <div class="msg-col">
      ${!isMine ? `<span class="msg-sender">${esc(msg.senderName)}</span>` : ''}
      <div class="msg-bubble">${esc(msg.text)}</div>
      <span class="msg-time">${time}</span>
    </div>
    ${isMine ? `<div class="msg-avatar">${av(col, msg.senderName[0].toUpperCase(),'sm')}</div>` : ''}`;
  feed.appendChild(row);
  feed.scrollTop = feed.scrollHeight;
}

// Player grid — ANY active player can accuse at any time (no turn lock)
function renderPlayerGrid() {
  const grid = $('game-grid');
  const p = me();
  const canAccuse = !p?.isEliminated && !p?.hasGuessedCorrectly;
  const maxC = S.players.length === 4 ? 2 : 3;

  grid.innerHTML = S.players.map((pl,i) => {
    const isSelf = pl.socketId === S.mySocketId;
    const clickable = canAccuse && !pl.isEliminated;
    const isConf = S.confirming === pl.socketId;

    const cls = ['pcard',
      clickable ? 'clickable' : '',
      pl.isEliminated ? 'elim' : '',
      (isSelf && pl.hasGuessedCorrectly) ? 'found' : '',
      isSelf ? 'self' : '',
    ].filter(Boolean).join(' ');

    let status = '';
    if (pl.isEliminated) {
      status = '<span class="pstatus elim-txt">💀 Out</span>';
    } else if (isSelf && pl.hasGuessedCorrectly) {
      status = '<span class="pstatus found-txt">✅ Found!</span>';
    } else {
      status = `<div style="display:flex;gap:4px;justify-content:center">
        ${Array.from({length:maxC},(_,j)=>`<div class="cdot ${j<pl.chancesLeft?'':'used'}"></div>`).join('')}
      </div>`;
    }

    // Self-accuse label: available to all players (imposter wins, crewmate wrong guess)
    const accuseLabel = isSelf ? "I'm the Imposter!" : `Accuse ${esc(pl.name)}?`;
    const confirmLabel = isSelf ? '✋ Yes, I am!' : '⚡ Accuse!';

    return `
      <div class="${cls}" data-sid="${pl.socketId}" onclick="onCard(event,this)">
        ${av(colorFor(i), pl.name[0].toUpperCase(), 'lg')}
        <div class="pname">
          ${esc(pl.name)}
          ${isSelf?'<span class="you-tag" style="font-size:.6rem">You</span>':''}
          ${pl.isHost?'👑':''}
        </div>
        ${status}
        ${isConf ? `
          <div class="confirm-overlay">
            <p>${accuseLabel}</p>
            <div class="confirm-actions">
              <button class="btn btn-danger btn-sm" onclick="doAccuse(event,'${pl.socketId}')">${confirmLabel}</button>
              <button class="btn btn-secondary btn-sm" onclick="cancelAccuse(event)">Cancel</button>
            </div>
          </div>` : ''}
      </div>`;
  }).join('');
}

window.onCard = function(e, card) {
  if (e.target.closest('.confirm-overlay')) return;
  const sid = card.dataset.sid;
  const p = me();
  if (!p || p.isEliminated || p.hasGuessedCorrectly) return;
  const pl = S.players.find(x => x.socketId === sid);
  if (!pl || pl.isEliminated) return;
  S.confirming = sid; renderPlayerGrid();
};
window.doAccuse = function(e, sid) {
  e.stopPropagation(); S.confirming = null;
  socket.emit('submit-guess', { roomId: S.roomId, guessedSocketId: sid });
  renderPlayerGrid();
};
window.cancelAccuse = function(e) {
  e.stopPropagation(); S.confirming = null; renderPlayerGrid();
};

function showGuessToast(result) {
  const toast = $('guess-toast');
  toast.className = 'guess-toast ' + (result.correct ? 'correct' : 'wrong');
  toast.innerHTML = `
    <span class="gt-icon">${result.correct?'🎯':'❌'}</span>
    <div class="gt-body">
      <div class="gt-title">${result.correct
        ? `Correct! ${esc(result.guessedName)} is the Imposter!`
        : `Wrong! ${esc(result.guessedName)} is innocent.`}</div>
      <div class="gt-sub">${result.correct
        ? `Their word: "${esc(result.imposterWord)}" vs everyone's "${esc(result.crewWord)}"`
        : (result.eliminated ? "You've been eliminated."
          : `${result.chancesLeft} chance${result.chancesLeft!==1?'s':''} left`)}</div>
    </div>
    <button class="gt-close" onclick="this.parentElement.style.display='none'">✕</button>`;
  toast.style.display = 'flex';
  setTimeout(() => { if(toast) toast.style.display='none'; }, 5000);
}

// ══════════════════════════════════════════════════
// ROUND OVER
// ══════════════════════════════════════════════════
function renderRoundOver(data) {
  S.roundsPlayed++;
  // Update persistent score cache from this round's data
  data.players.forEach(p => {
    S.scores[p.socketId] = p.score ?? 0;
  });

  const myP = data.players.find(p => p.socketId === S.mySocketId);
  const WHY = {
    'timer':'⏰ Time ran out!', 'all-crewmates-done':'🏁 All players have guessed.',
    'imposter-self-identified':'🎭 The Imposter revealed themselves!',
    'imposter-disconnected':'🔌 Imposter disconnected.',
  };
  $('ro-header').innerHTML = `<h1>Round ${S.roundsPlayed} Over</h1><p>${WHY[data.reason]??'Round ended.'}</p>`;
  $('ro-words').innerHTML = `
    <div class="ro-word-item"><span class="ro-word-lbl">Crewmate Word</span>
      <span class="ro-word-val crew">${esc(data.crewWord)}</span></div>
    <span class="ro-vs">VS</span>
    <div class="ro-word-item"><span class="ro-word-lbl">Imposter Word</span>
      <span class="ro-word-val imp">${esc(data.imposterWord)}</span></div>`;

  const RMAP = {
    win:{cls:'win',v:'🎉 You Won!',d:'You identified the Imposter.'},
    'self-identify-win':{cls:'survival',v:'🎭 Imposter Wins!',d:'You revealed yourself!'},
    'survival-win':{cls:'survival',v:'😈 Imposter Survived!',d:'You fooled everyone!'},
    loss:{cls:'loss',v:'😔 Missed.',d:'Better luck next time!'},
  };
  const r = RMAP[myP?.result] || RMAP.loss;
  $('ro-mine').className = 'ro-mine ' + r.cls;
  $('ro-mine').innerHTML = `
    <div class="ro-mine-lbl">YOUR RESULT</div>
    <div class="ro-mine-val">${r.v}</div>
    <div class="ro-mine-desc">${r.d}</div>`;

  // Full scoreboard sorted by total score
  const ranked = [...data.players].sort((a,b) => (b.score??0)-(a.score??0));
  const CHIP={win:'win','self-identify-win':'self-win','survival-win':'survival',loss:'loss'};
  const CLBL={win:'✅ Found','self-identify-win':'🎭 Self-ID','survival-win':'😈 Survived',loss:'❌ Missed'};
  const PTS={win:'+2 pts','self-identify-win':'+3 pts','survival-win':'+2 pts',loss:'+0'};

  $('ro-players').innerHTML = ranked.map((p, rank) => {
    const isImp = p.socketId === data.imposterSocketId;
    const isMe  = p.socketId === S.mySocketId;
    const idx   = S.players.findIndex(x => x.socketId === p.socketId);
    const medal = rank===0?'🥇':rank===1?'🥈':rank===2?'🥉':'';
    return `<div class="ro-pcard ${isImp?'is-imp':''}">
      <span style="font-size:1.3rem;width:24px;text-align:center">${medal}</span>
      ${av(colorFor(idx >= 0 ? idx : rank), p.name[0].toUpperCase())}
      <div class="ro-pinfo">
        <div class="ro-pname">${esc(p.name)}${isMe?'<span class="you-tag">You</span>':''}${isImp?'🎭':''}</div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:2px">
          <span class="ro-prole ${isImp?'imp':'crew'}">${isImp?'Imposter':'Crewmate'}</span>
          <span class="ro-chip ${CHIP[p.result]||'loss'}">${CLBL[p.result]||'❌'} ${PTS[p.result]||'+0'}</span>
        </div>
        <div class="ro-pword">"${esc(p.word)}"</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:1.1rem;font-weight:900;color:var(--violet)">${p.score??0}</div>
        <div style="font-size:.68rem;color:var(--muted)">total pts</div>
      </div>
    </div>`;
  }).join('');

  $('ro-actions').innerHTML = S.isHost
    ? '<button class="btn btn-primary btn-lg" onclick="doRematch()">🔄 Play Again</button>'
    : '<div class="waiting-host">⏳ Waiting for host to start again…</div>';
  showScreen('roundover');
}

window.doRematch = function() {
  socket.emit('request-rematch', { roomId: S.roomId });
};

// ══════════════════════════════════════════════════
// SOCKET EVENTS
// ══════════════════════════════════════════════════
function setPlayers(players, host) {
  S.players = players.map(p => ({
    ...p,
    isHost: host ? p.socketId === host : p.isHost,
  }));
  // Keep score cache current
  S.players.forEach(p => {
    if ((p.score ?? 0) > 0) S.scores[p.socketId] = p.score;
  });
}

socket.on('room-created', d => {
  S.roomId = d.roomId; S.isHost = true; S.roundDuration = d.roundDuration ?? 300;
  setPlayers(d.players, d.host); showScreen('lobby'); renderLobby();
});
socket.on('room-joined', d => {
  S.roomId = d.roomId; S.isHost = false; S.roundDuration = d.roundDuration ?? 300;
  setPlayers(d.players, d.host); showScreen('lobby'); renderLobby();
});
socket.on('join-error',  ({message}) => showErr('landing-error', message));
socket.on('start-error', ({message}) => showErr('lobby-error', message));
socket.on('guess-error', ({message}) => showErr('chat-error', message));
socket.on('message-rejected', ({reason}) => showErr('chat-error', reason));

socket.on('player-joined', ({players}) => {
  setPlayers(players, null); renderLobbyPlayers(); updateStartBtn();
});
socket.on('player-left', ({players, newHost}) => {
  if (newHost) S.isHost = newHost === S.mySocketId;
  setPlayers(players, newHost); renderLobbyPlayers(); updateStartBtn();
});
socket.on('round-duration-updated', ({duration}) => {
  S.roundDuration = duration; renderDurationCard();
});

socket.on('game-started', ({players}) => {
  setPlayers(players, null);
  S.messages = []; S.confirming = null; S.currentTurnSocketId = null;
  // Clear old chat
  const feed = $('chat-messages');
  if (feed) feed.innerHTML = '<div class="chat-empty"><div class="chat-empty-icon">💬</div><p>Descriptions will appear here.</p></div>';
  showScreen('wordflash');
});
socket.on('your-word', ({word, role}) => showWordFlash(word, role));
socket.on('word-hidden', () => { clearInterval(flashTimer); showScreen('playing'); renderPlaying(); });
socket.on('phase-changed', ({phase}) => { if (phase==='playing'){showScreen('playing');renderPlaying();} });
socket.on('timer-tick', ({timeRemaining}) => { S.timeRemaining = timeRemaining; renderTimer(); });

socket.on('players-updated', ({players}) => {
  setPlayers(players, null); renderGameHeader(); renderPlayerGrid();
});
socket.on('new-message', msg => { S.messages.push(msg); addMessage(msg); });

socket.on('turn-changed', ({currentTurnSocketId, currentTurnName}) => {
  S.currentTurnSocketId = currentTurnSocketId;
  S.currentTurnName = currentTurnName;
  renderTurnBanner(); renderChatInput(); renderPlayerGrid();
});

socket.on('guess-result', result => {
  S.players = S.players.map(p => p.socketId !== S.mySocketId ? p : {
    ...p,
    chancesLeft: result.chancesLeft ?? p.chancesLeft,
    isEliminated: result.eliminated ?? p.isEliminated,
    hasGuessedCorrectly: result.correct ? true : p.hasGuessedCorrectly,
  });
  showGuessToast(result);
  renderGameHeader(); renderPlayerGrid(); renderTurnBanner(); renderChatInput();
});

socket.on('round-over', renderRoundOver);

socket.on('rematch-started', ({players, host, roundDuration}) => {
  S.roundDuration = roundDuration; S.isHost = host === S.mySocketId;
  setPlayers(players, host);
  S.messages = []; S.myWord = null; S.myRole = null; S.currentTurnSocketId = null;
  showScreen('lobby'); renderLobby();
});

// ── Boot ─────────────────────────────────────────
showScreen('landing');
initLanding();
