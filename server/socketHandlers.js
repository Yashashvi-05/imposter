const gm = require('./gameManager');
const { validateMessage } = require('./validation');

function registerHandlers(io, socket) {

  // ─── Create Room ─────────────────────────────────────────────────────────────
  socket.on('create-room', ({ name, avatar }) => {
    if (!name || !avatar) return;
    const { roomId, room } = gm.createRoom(socket.id, name, avatar);
    socket.join(roomId);
    socket.emit('room-created', {
      roomId,
      players: gm.getPublicPlayerList(room),
      host: room.host,
      roundDuration: room.roundDuration,
    });
  });

  // ─── Join Room ────────────────────────────────────────────────────────────────
  socket.on('join-room', ({ roomId, name, avatar }) => {
    if (!roomId || !name || !avatar) return;
    const result = gm.joinRoom(roomId.toUpperCase(), socket.id, name, avatar);
    if (result.error) { socket.emit('join-error', { message: result.error }); return; }

    socket.join(roomId.toUpperCase());
    const room = gm.getRoom(roomId.toUpperCase());
    const publicPlayers = gm.getPublicPlayerList(room);

    socket.emit('room-joined', {
      roomId: roomId.toUpperCase(),
      players: publicPlayers,
      host: room.host,
      roundDuration: room.roundDuration,
    });
    socket.to(roomId.toUpperCase()).emit('player-joined', {
      players: publicPlayers,
      newPlayer: { socketId: socket.id, name, avatar },
    });
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
    }
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

  // ─── Disconnect ───────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const result = gm.removePlayer(socket.id);
    if (!result) return;
    if (result.deleted) return;
    const room = gm.getRoom(result.roomId);
    if (!room) return;

    io.to(result.roomId).emit('player-left', {
      socketId: socket.id,
      players: gm.getPublicPlayerList(room),
      newHost: result.newHost,
    });

    // Broadcast the new turn if it changed due to disconnect
    if (room.phase === 'playing' && room.currentTurnSocketId) {
      io.to(result.roomId).emit('turn-changed', {
        currentTurnSocketId: room.currentTurnSocketId,
        currentTurnName: room.players.get(room.currentTurnSocketId)?.name,
      });
    }

    if (result.wasImposter && room.phase === 'playing') {
      gm.endRound(result.roomId, io, 'imposter-disconnected');
    }
  });
}

module.exports = { registerHandlers };
