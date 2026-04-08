const gm = require('./gameManager');
const { validateMessage } = require('./validation');
const os = require('os');

const DISCONNECT_GRACE_MS = 60000;
const disconnectTimers = new Map();

function getLanBaseUrl() {
  const nets = os.networkInterfaces();
  const entries = [];
  const blockedName = /(virtual|vmware|hyper-v|vEthernet|loopback|tailscale|zerotier|docker)/i;
  const preferredName = /(wi-?fi|wlan|wireless|ethernet)/i;

  function isPrivateIPv4(ip) {
    if (!ip) return false;
    if (ip.startsWith('10.')) return true;
    if (ip.startsWith('192.168.')) return true;
    const m = ip.match(/^172\.(\d+)\./);
    if (m) {
      const second = Number(m[1]);
      return second >= 16 && second <= 31;
    }
    return false;
  }

  for (const [ifaceName, list] of Object.entries(nets)) {
    for (const net of list || []) {
      if (net.family !== 'IPv4' || net.internal) continue;
      if (!isPrivateIPv4(net.address)) continue;
      if (net.address.startsWith('169.254.')) continue;
      if (blockedName.test(ifaceName)) continue;

      let score = 0;
      if (net.address.startsWith('192.168.')) score += 4;
      if (net.address.startsWith('10.')) score += 3;
      if (/^172\.(1[6-9]|2\d|3[01])\./.test(net.address)) score += 2;
      if (preferredName.test(ifaceName)) score += 5;

      entries.push({ ifaceName, address: net.address, score });
    }
  }

  entries.sort((a, b) => b.score - a.score);
  if (entries.length > 0) {
    const port = process.env.PORT || 3001;
    return `http://${entries[0].address}:${port}`;
  }

  // Last-resort fallback: any external IPv4
  for (const list of Object.values(nets)) {
    for (const net of list || []) {
      if (net.family === 'IPv4' && !net.internal) {
        const port = process.env.PORT || 3001;
        return `http://${net.address}:${port}`;
      }
    }
  }
  return null;
}

function registerHandlers(io, socket) {

  // ─── Create Room ─────────────────────────────────────────────────────────────
  socket.on('create-room', ({ name, avatar, sessionId }) => {
    if (!name || !avatar) {
      socket.emit('join-error', { message: 'Name and avatar are required.' });
      return;
    }
    const { roomId, room } = gm.createRoom(socket.id, name, avatar, sessionId);
    socket.join(roomId);
    socket.emit('room-created', {
      roomId,
      players: gm.getPublicPlayerList(room),
      host: room.host,
      roundDuration: room.roundDuration,
      sessionId,
      inviteBaseUrl: getLanBaseUrl(),
    });
  });

  // ─── Join Room ────────────────────────────────────────────────────────────────
  socket.on('join-room', ({ roomId, name, avatar, sessionId }) => {
    if (!roomId || !name || !avatar) {
      socket.emit('join-error', { message: 'Room code, name and avatar are required.' });
      return;
    }
    const result = gm.joinRoom(roomId.toUpperCase(), socket.id, name, avatar, sessionId);
    if (result.error) { socket.emit('join-error', { message: result.error }); return; }

    socket.join(roomId.toUpperCase());
    const room = gm.getRoom(roomId.toUpperCase());
    const publicPlayers = gm.getPublicPlayerList(room);

    socket.emit('room-joined', {
      roomId: roomId.toUpperCase(),
      players: publicPlayers,
      host: room.host,
      roundDuration: room.roundDuration,
      sessionId,
      inviteBaseUrl: getLanBaseUrl(),
      phase: room.phase,
      timeRemaining: room.timeRemaining,
      currentTurnSocketId: room.currentTurnSocketId,
      currentTurnName: room.players.get(room.currentTurnSocketId)?.name,
      turnTimeRemaining: room.turnTimeRemaining,
      turnDuration: room.turnDuration,
      messages: room.messages,
      personalMessages: room.personalMessages,
    });
    socket.to(roomId.toUpperCase()).emit('player-joined', {
      players: publicPlayers,
      newPlayer: { socketId: socket.id, name, avatar },
    });
  });

  socket.on('reconnect-room', ({ sessionId, roomId }) => {
    if (!sessionId) return;
    const result = gm.reconnectPlayer(sessionId, socket.id);
    if (result?.error) return;

    const { room, roomId: resolvedRoomId, player } = result;
    const finalRoomId = roomId || resolvedRoomId;
    socket.join(finalRoomId);
    const pendingTimeout = disconnectTimers.get(sessionId);
    if (pendingTimeout) clearTimeout(pendingTimeout);
    disconnectTimers.delete(sessionId);

    socket.emit('reconnected', {
      roomId: finalRoomId,
      players: gm.getPublicPlayerList(room),
      host: room.host,
      roundDuration: room.roundDuration,
      inviteBaseUrl: getLanBaseUrl(),
      phase: room.phase,
      timeRemaining: room.timeRemaining,
      currentTurnSocketId: room.currentTurnSocketId,
      currentTurnName: room.players.get(room.currentTurnSocketId)?.name,
      turnTimeRemaining: room.turnTimeRemaining,
      turnDuration: room.turnDuration,
      word: player.word,
      role: player.role,
      messages: room.messages,
      personalMessages: room.personalMessages,
    });

    io.to(finalRoomId).emit('players-updated', { players: gm.getPublicPlayerList(room) });
  });

  // ─── Set Round Duration (host only) ──────────────────────────────────────────
  socket.on('set-round-duration', ({ roomId, duration }) => {
    const room = gm.getRoom(roomId);
    if (!room || room.host !== socket.id) return;
    if (![180, 300, 480].includes(duration)) return;
    room.roundDuration = duration;
    room.timeRemaining = duration;
    io.to(roomId).emit('round-duration-updated', { duration });
  });

  // ─── Start Game (host only) ───────────────────────────────────────────────────
  socket.on('start-game', ({ roomId }) => {
    const room = gm.getRoom(roomId);
    if (!room || room.host !== socket.id) return;

    const result = gm.startGame(roomId);
    if (result.error) { socket.emit('start-error', { message: result.error }); return; }

    io.to(roomId).emit('game-started', { players: gm.getPublicPlayerList(result.room) });

    for (const [sid, player] of result.room.players.entries()) {
      io.to(sid).emit('your-word', { word: player.word, role: player.role });
    }

    const flashDuration = Math.floor(Math.random() * 1000) + 4000;
    result.room.wordFlashTimeout = setTimeout(() => {
      io.to(roomId).emit('word-hidden');
      gm.startPlaying(roomId, io);
    }, flashDuration);
  });

  // ─── Send Description Message ─────────────────────────────────────────────────
  // Only the current-turn player can chat
  socket.on('send-message', ({ roomId, text }) => {
    const room = gm.getRoom(roomId);
    if (!room || room.phase !== 'playing') return;

    const player = room.players.get(socket.id);
    if (!player) return;

    if (player.isEliminated) {
      socket.emit('message-rejected', { reason: 'You are eliminated and cannot send messages.' });
      return;
    }

    // Turn enforcement for chat — only current turn player describes
    if (room.currentTurnSocketId !== socket.id) {
      socket.emit('message-rejected', {
        reason: `It's ${room.players.get(room.currentTurnSocketId)?.name ?? 'someone else'}'s turn to describe.`,
      });
      return;
    }

    // Validate message content
    const validation = validateMessage(text, room.crewWord, room.imposterWord, room.currentWordPair);
    if (!validation.valid) {
      socket.emit('message-rejected', { reason: validation.reason, text });
      return;
    }

    // Duplicate description check
    const normalizedText = text.trim().toLowerCase();
    const isDuplicate = room.messages.some(m => m.text.trim().toLowerCase() === normalizedText);
    if (isDuplicate) {
      socket.emit('message-rejected', {
        reason: '❌ That description has already been used this round — be more creative!',
        text,
      });
      return;
    }

    const message = {
      id: gm.generateMessageId(),
      senderSocketId: socket.id,
      senderName: player.name,
      senderAvatar: player.avatar,
      text: text.trim(),
      timestamp: Date.now(),
    };

    room.messages.push(message);
    io.to(roomId).emit('new-message', message);

    // Auto-advance turn after player describes
    const nextTurnId = gm.advanceTurn(room);
    if (nextTurnId) {
      io.to(roomId).emit('turn-changed', {
        currentTurnSocketId: nextTurnId,
        currentTurnName: room.players.get(nextTurnId)?.name,
      });
      gm.startTurnTimer(roomId, io);
    }
  });

  // ─── Group Chat (anyone in room, including eliminated/spectators) ───────────
  socket.on('send-personal-chat', ({ roomId, text }) => {
    const room = gm.getRoom(roomId);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (!player) return;
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    if (trimmed.length > 250) {
      socket.emit('message-rejected', { reason: 'Group chat message too long (max 250 chars).' });
      return;
    }

    const msg = {
      id: gm.generateMessageId(),
      senderSocketId: socket.id,
      senderName: player.name,
      senderAvatar: player.avatar,
      text: trimmed,
      timestamp: Date.now(),
    };
    room.personalMessages.push(msg);
    if (room.personalMessages.length > 200) room.personalMessages.shift();
    io.to(roomId).emit('new-personal-chat', msg);
  });

  // ─── Submit Guess (accuse) ────────────────────────────────────────────────────
  socket.on('submit-guess', ({ roomId, guessedSocketId }) => {
    const result = gm.processGuess(roomId, socket.id, guessedSocketId, io);
    if (result?.error) {
      socket.emit('guess-error', { message: result.error });
    }
  });

  // ─── Request Rematch (host only) ──────────────────────────────────────────────
  socket.on('request-rematch', ({ roomId }) => {
    const room = gm.getRoom(roomId);
    if (!room || room.host !== socket.id) return;
    const resetRoom = gm.resetRoom(roomId);
    if (!resetRoom) return;
    io.to(roomId).emit('rematch-started', {
      players: gm.getPublicPlayerList(resetRoom),
      host: resetRoom.host,
      roundDuration: resetRoom.roundDuration,
    });
  });

  socket.on('leave-room', ({ roomId }) => {
    if (!roomId) return;
    const room = gm.getRoom(roomId);
    if (!room) return;

    // Voluntary leave should remove immediately (no grace timer).
    const player = room.players.get(socket.id);
    if (player?.sessionId) {
      const t = disconnectTimers.get(player.sessionId);
      if (t) clearTimeout(t);
      disconnectTimers.delete(player.sessionId);
    }

    const result = gm.removePlayer(socket.id);
    if (!result || result.deleted) return;
    const updatedRoom = gm.getRoom(result.roomId);
    if (!updatedRoom) return;

    socket.leave(result.roomId);
    io.to(result.roomId).emit('player-left', {
      socketId: socket.id,
      players: gm.getPublicPlayerList(updatedRoom),
      newHost: result.newHost,
    });

    if (updatedRoom.phase === 'playing' && updatedRoom.currentTurnSocketId) {
      io.to(result.roomId).emit('turn-changed', {
        currentTurnSocketId: updatedRoom.currentTurnSocketId,
        currentTurnName: updatedRoom.players.get(updatedRoom.currentTurnSocketId)?.name,
      });
      gm.startTurnTimer(result.roomId, io);
    }

    if (result.wasImposter && updatedRoom.phase === 'playing') {
      gm.endRound(result.roomId, io, 'imposter-disconnected');
    }
  });

  // ─── Reset Scores (host only) ─────────────────────────────────────────────────
  socket.on('reset-scores', ({ roomId }) => {
    const room = gm.getRoom(roomId);
    if (!room || room.host !== socket.id || room.phase !== 'lobby') return;
    const updated = gm.resetScores(roomId);
    if (!updated) return;
    io.to(roomId).emit('scores-reset', { players: gm.getPublicPlayerList(updated) });
  });

  // ─── Set Custom Word Pair (host only) ─────────────────────────────────────────
  socket.on('set-custom-word', ({ roomId, crewWord, imposterWord }) => {
    const room = gm.getRoom(roomId);
    if (!room || room.host !== socket.id || room.phase !== 'lobby') return;
    if (!crewWord || !imposterWord) return;
    gm.setCustomWord(roomId, crewWord, imposterWord);
    socket.emit('custom-word-set', { crewWord: crewWord.trim(), imposterWord: imposterWord.trim() });
  });

  // ─── Set Min Players (host only) ──────────────────────────────────────────────
  socket.on('set-min-players', ({ roomId, min }) => {
    const room = gm.getRoom(roomId);
    if (!room || room.host !== socket.id || room.phase !== 'lobby') return;
    gm.setMinPlayers(roomId, min);
    const updated = gm.getRoom(roomId);
    io.to(roomId).emit('min-players-updated', { minPlayers: updated.minPlayers });
  });

  // ─── Disconnect ───────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const found = gm.findRoomBySocketId(socket.id);
    if (!found) return;
    const { roomId, room } = found;
    const player = room.players.get(socket.id);
    if (!player) return;

    player.disconnected = true;
    io.to(roomId).emit('players-updated', { players: gm.getPublicPlayerList(room) });

    if (room.phase === 'playing' && room.currentTurnSocketId === socket.id) {
      const nextTurnId = gm.advanceTurn(room);
      io.to(roomId).emit('turn-changed', {
        currentTurnSocketId: nextTurnId,
        currentTurnName: room.players.get(nextTurnId)?.name,
      });
      gm.startTurnTimer(roomId, io);
    }

    if (!player.sessionId) return;
    const existingTimer = disconnectTimers.get(player.sessionId);
    if (existingTimer) clearTimeout(existingTimer);

    const timeout = setTimeout(() => {
      disconnectTimers.delete(player.sessionId);
      const result = gm.removePlayer(socket.id);
      if (!result || result.deleted) return;
      const updatedRoom = gm.getRoom(result.roomId);
      if (!updatedRoom) return;

      io.to(result.roomId).emit('player-left', {
        socketId: socket.id,
        players: gm.getPublicPlayerList(updatedRoom),
        newHost: result.newHost,
      });

      if (updatedRoom.phase === 'playing' && updatedRoom.currentTurnSocketId) {
        io.to(result.roomId).emit('turn-changed', {
          currentTurnSocketId: updatedRoom.currentTurnSocketId,
          currentTurnName: updatedRoom.players.get(updatedRoom.currentTurnSocketId)?.name,
        });
        gm.startTurnTimer(result.roomId, io);
      }

      if (result.wasImposter && updatedRoom.phase === 'playing') {
        gm.endRound(result.roomId, io, 'imposter-disconnected');
      }
    }, DISCONNECT_GRACE_MS);

    disconnectTimers.set(player.sessionId, timeout);
  });
}

module.exports = { registerHandlers };
