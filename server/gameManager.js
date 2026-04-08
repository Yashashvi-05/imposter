const { getRandomPair } = require('./words');

// In-memory room storage: roomId → GameState
const rooms = new Map();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function generateMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createPlayerObject(socketId, name, avatar) {
  return {
    socketId,
    sessionId: null,
    name,
    avatar,
    disconnected: false,
    isSpectator: false,
    role: null,           // 'crewmate' | 'imposter'
    word: null,
    chancesLeft: 0,
    hasGuessedCorrectly: false,
    isEliminated: false,
    roundResult: null,    // 'win' | 'loss' | 'survival-win'
    score: 0,
    latestRoundScore: 0,
  };
}

function getPublicPlayerList(room) {
  return Array.from(room.players.values()).map(p => ({
    socketId: p.socketId,
    name: p.name,
    avatar: p.avatar,
    disconnected: p.disconnected,
    chancesLeft: p.chancesLeft,
    isEliminated: p.isEliminated,
    hasGuessedCorrectly: p.hasGuessedCorrectly,
    isHost: p.socketId === room.host,
    roundResult: p.roundResult,
    score: p.score ?? 0,
    latestRoundScore: p.latestRoundScore ?? 0,
  }));
}

// ─── Turn Management ──────────────────────────────────────────────────────────

/**
 * Returns the ordered list of players who are still active (not eliminated,
 * not already guessed correctly). Used to determine whose turn comes next.
 */
function getActivePlayers(room) {
  return Array.from(room.players.values()).filter(
    p => !p.isEliminated && !p.hasGuessedCorrectly
  );
}

/**
 * Advances the turn to the next active player in insertion order.
 * Skips players who are eliminated or have already guessed correctly.
 * Returns the new current turn socket ID, or null if no active players remain.
 */
function advanceTurn(room) {
  const allPlayerIds = Array.from(room.players.keys());
  const activeIds = getActivePlayers(room).map(p => p.socketId);

  if (activeIds.length === 0) {
    room.currentTurnSocketId = null;
    return null;
  }

  // If no current turn (first time), start with the first active player
  if (!room.currentTurnSocketId) {
    room.currentTurnSocketId = activeIds[0];
    return room.currentTurnSocketId;
  }

  // Find the current turn's position in the full player order (preserved insertion order)
  const currentIndex = allPlayerIds.indexOf(room.currentTurnSocketId);

  // Walk forward from there, wrapping around, until we hit an active player
  for (let i = 1; i <= allPlayerIds.length; i++) {
    const nextId = allPlayerIds[(currentIndex + i) % allPlayerIds.length];
    if (activeIds.includes(nextId)) {
      room.currentTurnSocketId = nextId;
      return nextId;
    }
  }

  // Fallback: just use first active player
  room.currentTurnSocketId = activeIds[0];
  return room.currentTurnSocketId;
}

// ─── Room Lifecycle ────────────────────────────────────────────────────────────

function createRoom(hostSocketId, hostName, hostAvatar, sessionId = null) {
  let roomId;
  do { roomId = generateRoomId(); } while (rooms.has(roomId));

  const hostPlayer = createPlayerObject(hostSocketId, hostName, hostAvatar);
  hostPlayer.sessionId = sessionId;

  const gameState = {
    roomId,
    host: hostSocketId,
    players: new Map([[hostSocketId, hostPlayer]]),
    phase: 'lobby',          // 'lobby' | 'word-flash' | 'playing' | 'round-over'
    roundDuration: 300,
    timerHandle: null,
    timeRemaining: 300,
    imposterSocketId: null,
    crewWord: null,
    imposterWord: null,
    currentWordPair: null,
    customWordPair: null,      // { crew, imposter } set by host, or null for random
    minPlayers: 4,             // host can lower for testing
    messages: [],
    wordFlashTimeout: null,
    currentTurnSocketId: null,
    turnDuration: 45,
    turnTimeRemaining: 45,
    turnTimerHandle: null,
    personalMessages: [],
  };

  rooms.set(roomId, gameState);
  return { roomId, room: gameState };
}

function joinRoom(roomId, socketId, name, avatar, sessionId = null) {
  const room = rooms.get(roomId);
  if (!room) return { error: 'Room not found. Check the code and try again.' };
  if (room.players.size >= 12) return { error: 'Room is full (max 12 players).' };
  if (Array.from(room.players.values()).some(p => p.name.toLowerCase() === name.toLowerCase())) {
    return { error: `Name "${name}" is already taken in this room.` };
  }

  const player = createPlayerObject(socketId, name, avatar);
  player.sessionId = sessionId;
  if (room.phase !== 'lobby') {
    // Mid-game joins enter as spectators and participate from next round.
    player.isSpectator = true;
    player.isEliminated = true;
    player.chancesLeft = 0;
  }
  room.players.set(socketId, player);
  return { success: true, room };
}

function removePlayer(socketId) {
  for (const [roomId, room] of rooms.entries()) {
    if (!room.players.has(socketId)) continue;

    const wasHost = room.host === socketId;
    room.players.delete(socketId);

    if (room.players.size === 0) {
      if (room.timerHandle) clearInterval(room.timerHandle);
      if (room.wordFlashTimeout) clearTimeout(room.wordFlashTimeout);
      if (room.turnTimerHandle) clearInterval(room.turnTimerHandle);
      rooms.delete(roomId);
      return { roomId, deleted: true, wasImposter: false };
    }

    if (wasHost) {
      room.host = room.players.keys().next().value;
    }

    // If it was this player's turn during a game, advance turn
    if (room.phase === 'playing' && room.currentTurnSocketId === socketId) {
      advanceTurn(room);
    }

    const wasImposter = room.imposterSocketId === socketId;
    return { roomId, deleted: false, room, wasImposter, newHost: room.host };
  }
  return null;
}

function getRoom(roomId) {
  return rooms.get(roomId);
}

function findRoomBySocketId(socketId) {
  for (const [roomId, room] of rooms.entries()) {
    if (room.players.has(socketId)) return { roomId, room };
  }
  return null;
}

// ─── Game Logic ────────────────────────────────────────────────────────────────

function startGame(roomId) {
  const room = rooms.get(roomId);
  if (!room) return { error: 'Room not found.' };
  if (room.players.size < room.minPlayers) return { error: `Need at least ${room.minPlayers} players to start.` };
  if (room.phase !== 'lobby' && room.phase !== 'round-over') return { error: 'Game has already started.' };

  const wordPair = getRandomPair(room.customWordPair);
  room.crewWord = wordPair.crew;
  room.imposterWord = wordPair.imposter;
  room.currentWordPair = wordPair;
  room.customWordPair = null; // reset after use — next round is random unless host sets again

  const playerIds = Array.from(room.players.keys());
  room.imposterSocketId = playerIds[Math.floor(Math.random() * playerIds.length)];

  const chances = 1;

  for (const [socketId, player] of room.players.entries()) {
    player.isSpectator = false;
    player.disconnected = false;
    player.role = socketId === room.imposterSocketId ? 'imposter' : 'crewmate';
    player.word = socketId === room.imposterSocketId ? room.imposterWord : room.crewWord;
    player.chancesLeft = chances;
    player.hasGuessedCorrectly = false;
    player.isEliminated = false;
    player.roundResult = null;
    player.latestRoundScore = 0;
  }

  room.phase = 'word-flash';
  room.messages = [];
  room.timeRemaining = room.roundDuration;
  room.currentTurnSocketId = null; // will be set when 'playing' starts

  return { success: true, room };
}

function startPlaying(roomId, io) {
  const room = rooms.get(roomId);
  if (!room || room.phase !== 'word-flash') return;

  room.phase = 'playing';

  // Set the first player's turn (insertion order)
  advanceTurn(room);

  io.to(roomId).emit('phase-changed', { phase: 'playing' });
  // Broadcast who goes first
  io.to(roomId).emit('turn-changed', {
    currentTurnSocketId: room.currentTurnSocketId,
    currentTurnName: room.players.get(room.currentTurnSocketId)?.name,
  });

  room.timerHandle = setInterval(() => {
    room.timeRemaining = Math.max(0, room.timeRemaining - 1);
    io.to(roomId).emit('timer-tick', { timeRemaining: room.timeRemaining });

    if (room.timeRemaining <= 0) {
      clearInterval(room.timerHandle);
      room.timerHandle = null;
      endRound(roomId, io, 'timer');
    }
  }, 1000);

  startTurnTimer(roomId, io);
}

function processGuess(roomId, guesserSocketId, guessedSocketId, io) {
  const room = rooms.get(roomId);
  if (!room || room.phase !== 'playing') return { error: 'Guessing is not active right now.' };

  const guesser = room.players.get(guesserSocketId);
  const guessed = room.players.get(guessedSocketId);

  if (!guesser || !guessed) return { error: 'Player not found.' };
  if (guesser.isEliminated) return { error: 'You are eliminated.' };
  if (guesser.hasGuessedCorrectly) return { error: 'You already found the imposter!' };

  const isCorrect   = guessedSocketId === room.imposterSocketId;
  const isSelfAccuse = guesserSocketId === guessedSocketId;
  const displayName = isSelfAccuse ? 'yourself' : guessed.name;

  if (isCorrect) {
    guesser.hasGuessedCorrectly = true;
    guesser.roundResult = isSelfAccuse ? 'self-identify-win' : 'win';
    const points = isSelfAccuse ? 3 : 2;
    guesser.score += points;
    guesser.latestRoundScore += points;

    io.to(guesserSocketId).emit('guess-result', {
      correct: true,
      guessedName: displayName,
      imposterWord: room.imposterWord,
      crewWord: room.crewWord,
    });
  } else {
    guesser.chancesLeft = Math.max(0, guesser.chancesLeft - 1);
    if (guesser.chancesLeft === 0) {
      guesser.isEliminated = true;
      guesser.roundResult = 'loss';
      io.to(roomId).emit('player-eliminated', { socketId: guesserSocketId, name: guesser.name });
    }
    io.to(guesserSocketId).emit('guess-result', {
      correct: false,
      guessedName: displayName,
      chancesLeft: guesser.chancesLeft,
      eliminated: guesser.isEliminated,
    });
  }

  io.to(roomId).emit('players-updated', { players: getPublicPlayerList(room) });

  // Check if round should end — turn is NOT advanced here; it advances via description
  checkAndTriggerRoundEnd(roomId, io);

  return { success: true };
}

function checkAndTriggerRoundEnd(roomId, io) {
  const room = rooms.get(roomId);
  if (!room || room.phase !== 'playing') return false;

  const allPlayers = Array.from(room.players.values());
  const crewmates = allPlayers.filter(p => p.role === 'crewmate');

  // End immediately only when every crewmate has correctly found the imposter.
  const allCrewmatesFoundImposter = crewmates.length > 0 &&
    crewmates.every(p => p.hasGuessedCorrectly);

  if (allCrewmatesFoundImposter) {
    endRound(roomId, io, 'all-crewmates-found-imposter');
    return true;
  }
  return false;
}

function endRound(roomId, io, reason = 'timer') {
  const room = rooms.get(roomId);
  if (!room || room.phase === 'round-over') return;

  if (room.timerHandle) { clearInterval(room.timerHandle); room.timerHandle = null; }
  if (room.wordFlashTimeout) { clearTimeout(room.wordFlashTimeout); room.wordFlashTimeout = null; }
  if (room.turnTimerHandle) { clearInterval(room.turnTimerHandle); room.turnTimerHandle = null; }

  room.phase = 'round-over';
  room.currentTurnSocketId = null;

  const allPlayers = Array.from(room.players.values());
  const imposter = room.players.get(room.imposterSocketId);
  const crewmates = allPlayers.filter(p => p.role === 'crewmate');

  if (imposter && !imposter.roundResult) {
    const correctGuessCount = crewmates.filter(p => p.hasGuessedCorrectly).length;
    const majority = Math.ceil(crewmates.length / 2);
    if (correctGuessCount >= majority) {
      imposter.roundResult = 'loss';
    } else {
      imposter.roundResult = 'survival-win';
      imposter.score += 2;
      imposter.latestRoundScore += 2;
    }
  }

  for (const player of allPlayers) {
    if (!player.roundResult) player.roundResult = 'loss';
  }

  const roundOverPayload = {
    reason,
    imposterSocketId: room.imposterSocketId,
    crewWord: room.crewWord,
    imposterWord: room.imposterWord,
    players: allPlayers.map(p => ({
      socketId: p.socketId,
      name: p.name,
      avatar: p.avatar,
      role: p.role,
      word: p.word,
      result: p.roundResult,
      chancesLeft: p.chancesLeft,
      score: p.score,
      latestRoundScore: p.latestRoundScore ?? 0,
    })),
  };

  // Reset room-wide group chat after each round so next round starts clean.
  room.personalMessages = [];
  io.to(roomId).emit('personal-chat-cleared');
  io.to(roomId).emit('round-over', roundOverPayload);
}

function resetRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return null;

  if (room.timerHandle) { clearInterval(room.timerHandle); room.timerHandle = null; }
  if (room.wordFlashTimeout) { clearTimeout(room.wordFlashTimeout); room.wordFlashTimeout = null; }
  if (room.turnTimerHandle) { clearInterval(room.turnTimerHandle); room.turnTimerHandle = null; }

  for (const player of room.players.values()) {
    player.isSpectator = false;
    player.disconnected = false;
    player.role = null;
    player.word = null;
    player.chancesLeft = 0;
    player.hasGuessedCorrectly = false;
    player.isEliminated = false;
    player.roundResult = null;
  }

  room.phase = 'lobby';
  room.imposterSocketId = null;
  room.crewWord = null;
  room.imposterWord = null;
  room.currentWordPair = null;
  room.messages = [];
  room.personalMessages = [];
  room.timeRemaining = room.roundDuration;
  room.currentTurnSocketId = null;
  room.turnTimeRemaining = room.turnDuration;

  return room;
}

// ─── New Utility Functions ─────────────────────────────────────────────────────

function resetScores(roomId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  for (const player of room.players.values()) {
    player.score = 0;
  }
  return room;
}

function setCustomWord(roomId, crewWord, imposterWord) {
  const room = rooms.get(roomId);
  if (!room) return null;
  room.customWordPair = { crew: crewWord.trim(), imposter: imposterWord.trim() };
  return room;
}

function setMinPlayers(roomId, min) {
  const room = rooms.get(roomId);
  if (!room) return null;
  room.minPlayers = Math.max(2, Math.min(12, min));
  return room;
}

function findRoomBySessionId(sessionId) {
  if (!sessionId) return null;
  for (const [roomId, room] of rooms.entries()) {
    for (const player of room.players.values()) {
      if (player.sessionId === sessionId) {
        return { roomId, room, player };
      }
    }
  }
  return null;
}

function reconnectPlayer(sessionId, newSocketId) {
  const found = findRoomBySessionId(sessionId);
  if (!found) return { error: 'No existing player session found.' };

  const { roomId, room, player } = found;
  const oldSocketId = player.socketId;
  if (oldSocketId === newSocketId) {
    return { success: true, roomId, room, player };
  }

  room.players.delete(oldSocketId);
  player.socketId = newSocketId;
  player.disconnected = false;
  room.players.set(newSocketId, player);

  if (room.host === oldSocketId) room.host = newSocketId;
  if (room.imposterSocketId === oldSocketId) room.imposterSocketId = newSocketId;
  if (room.currentTurnSocketId === oldSocketId) room.currentTurnSocketId = newSocketId;

  return { success: true, roomId, room, player };
}

function startTurnTimer(roomId, io) {
  const room = rooms.get(roomId);
  if (!room || room.phase !== 'playing') return;

  if (room.turnTimerHandle) clearInterval(room.turnTimerHandle);
  room.turnTimeRemaining = room.turnDuration;
  io.to(roomId).emit('turn-tick', {
    currentTurnSocketId: room.currentTurnSocketId,
    turnTimeRemaining: room.turnTimeRemaining,
    turnDuration: room.turnDuration,
  });

  room.turnTimerHandle = setInterval(() => {
    room.turnTimeRemaining = Math.max(0, room.turnTimeRemaining - 1);
    io.to(roomId).emit('turn-tick', {
      currentTurnSocketId: room.currentTurnSocketId,
      turnTimeRemaining: room.turnTimeRemaining,
      turnDuration: room.turnDuration,
    });

    if (room.turnTimeRemaining <= 0) {
      const timedOutSocketId = room.currentTurnSocketId;
      const timedOutName = room.players.get(timedOutSocketId)?.name;
      const nextTurnId = advanceTurn(room);

      io.to(roomId).emit('turn-timed-out', {
        timedOutSocketId,
        timedOutName,
      });
      io.to(roomId).emit('turn-changed', {
        currentTurnSocketId: nextTurnId,
        currentTurnName: room.players.get(nextTurnId)?.name,
      });
      startTurnTimer(roomId, io);
    }
  }, 1000);
}

module.exports = {
  createRoom,
  joinRoom,
  removePlayer,
  getRoom,
  findRoomBySocketId,
  startGame,
  startPlaying,
  processGuess,
  endRound,
  resetRoom,
  resetScores,
  setCustomWord,
  setMinPlayers,
  getPublicPlayerList,
  generateMessageId,
  advanceTurn,
  startTurnTimer,
  reconnectPlayer,
};
