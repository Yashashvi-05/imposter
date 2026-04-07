const { WORD_PAIRS } = require('./words');

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
    name,
    avatar,
    role: null,           // 'crewmate' | 'imposter'
    word: null,
    chancesLeft: 0,
    hasGuessedCorrectly: false,
    isEliminated: false,
    roundResult: null,    // 'win' | 'loss' | 'survival-win'
    score: 0,
  };
}

function getPublicPlayerList(room) {
  return Array.from(room.players.values()).map(p => ({
    socketId: p.socketId,
    name: p.name,
    avatar: p.avatar,
    chancesLeft: p.chancesLeft,
    isEliminated: p.isEliminated,
    hasGuessedCorrectly: p.hasGuessedCorrectly,
    isHost: p.socketId === room.host,
    roundResult: p.roundResult,
    score: p.score ?? 0,
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

function createRoom(hostSocketId, hostName, hostAvatar) {
  let roomId;
  do { roomId = generateRoomId(); } while (rooms.has(roomId));

  const hostPlayer = createPlayerObject(hostSocketId, hostName, hostAvatar);

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
    messages: [],
    wordFlashTimeout: null,
    currentTurnSocketId: null,  // whose turn it is to guess
  };

  rooms.set(roomId, gameState);
  return { roomId, room: gameState };
}

function joinRoom(roomId, socketId, name, avatar) {
  const room = rooms.get(roomId);
  if (!room) return { error: 'Room not found. Check the code and try again.' };
  if (room.phase !== 'lobby') return { error: 'A game is already in progress in this room.' };
  if (room.players.size >= 12) return { error: 'Room is full (max 12 players).' };
  if (Array.from(room.players.values()).some(p => p.name.toLowerCase() === name.toLowerCase())) {
    return { error: `Name "${name}" is already taken in this room.` };
  }

  const player = createPlayerObject(socketId, name, avatar);
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

// ─── Game Logic ────────────────────────────────────────────────────────────────

function startGame(roomId) {
  const room = rooms.get(roomId);
  if (!room) return { error: 'Room not found.' };
  if (room.players.size < 4) return { error: 'Need at least 4 players to start.' };
  if (room.phase !== 'lobby' && room.phase !== 'round-over') return { error: 'Game has already started.' };

  const wordPair = WORD_PAIRS[Math.floor(Math.random() * WORD_PAIRS.length)];
  room.crewWord = wordPair.crew;
  room.imposterWord = wordPair.imposter;
  room.currentWordPair = wordPair;

  const playerIds = Array.from(room.players.keys());
  room.imposterSocketId = playerIds[Math.floor(Math.random() * playerIds.length)];

  const chances = room.players.size === 4 ? 2 : 3;

  for (const [socketId, player] of room.players.entries()) {
    player.role = socketId === room.imposterSocketId ? 'imposter' : 'crewmate';
    player.word = socketId === room.imposterSocketId ? room.imposterWord : room.crewWord;
    player.chancesLeft = chances;
    player.hasGuessedCorrectly = false;
    player.isEliminated = false;
    player.roundResult = null;
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
    guesser.score += isSelfAccuse ? 3 : 2;

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

  const allCrewmatesDone = crewmates.length > 0 &&
    crewmates.every(p => p.hasGuessedCorrectly || p.isEliminated);

  if (allCrewmatesDone) {
    endRound(roomId, io, 'all-crewmates-done');
    return true;
  }
  return false;
}

function endRound(roomId, io, reason = 'timer') {
  const room = rooms.get(roomId);
  if (!room || room.phase === 'round-over') return;

  if (room.timerHandle) { clearInterval(room.timerHandle); room.timerHandle = null; }
  if (room.wordFlashTimeout) { clearTimeout(room.wordFlashTimeout); room.wordFlashTimeout = null; }

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
    })),
  };

  io.to(roomId).emit('round-over', roundOverPayload);
}

function resetRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return null;

  if (room.timerHandle) { clearInterval(room.timerHandle); room.timerHandle = null; }
  if (room.wordFlashTimeout) { clearTimeout(room.wordFlashTimeout); room.wordFlashTimeout = null; }

  for (const player of room.players.values()) {
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
  room.timeRemaining = room.roundDuration;
  room.currentTurnSocketId = null;

  return room;
}

module.exports = {
  createRoom,
  joinRoom,
  removePlayer,
  getRoom,
  startGame,
  startPlaying,
  processGuess,
  endRound,
  resetRoom,
  getPublicPlayerList,
  generateMessageId,
  advanceTurn,
};
