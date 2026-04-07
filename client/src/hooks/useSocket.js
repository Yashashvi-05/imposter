import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import useGameStore from '../store/useGameStore';

let socketInstance = null;

function getSocket() {
  if (!socketInstance) {
    // Connect directly to backend port 3001 using whatever host the page is served from.
    // This makes it work on localhost AND on the local network IP (e.g. 192.168.x.x:5173).
    const serverUrl = `${window.location.protocol}//${window.location.hostname}:3001`;
    socketInstance = io(serverUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
  }
  return socketInstance;
}

export function useSocket() {
  const store = useGameStore();
  const storeRef = useRef(store);
  storeRef.current = store;

  useEffect(() => {
    const socket = getSocket();

    // ── Identity ────────────────────────────────────────────────
    if (socket.id) storeRef.current.setMySocketId(socket.id);
    socket.on('connect', () => {
      storeRef.current.setMySocketId(socket.id);
    });

    // ── Room Events ─────────────────────────────────────────────
    socket.on('room-created', (data) => {
      storeRef.current.initRoom(data);
    });

    socket.on('room-joined', (data) => {
      storeRef.current.initRoom(data);
    });

    socket.on('join-error', ({ message }) => {
      storeRef.current.setErrorMessage(message);
    });

    socket.on('start-error', ({ message }) => {
      storeRef.current.setErrorMessage(message);
    });

    socket.on('guess-error', ({ message }) => {
      storeRef.current.showRejection({ reason: message });
    });

    socket.on('player-joined', ({ players }) => {
      storeRef.current.updatePlayers(players);
    });

    socket.on('player-left', ({ players, newHost }) => {
      storeRef.current.updatePlayers(players);
      if (newHost) storeRef.current.updateHost(newHost);
    });

    socket.on('round-duration-updated', ({ duration }) => {
      storeRef.current.setRoundDuration(duration);
      storeRef.current.setTimeRemaining(duration);
    });

    // ── Game Events ─────────────────────────────────────────────
    socket.on('game-started', (data) => {
      storeRef.current.onGameStarted(data);
    });

    socket.on('your-word', (data) => {
      storeRef.current.onYourWord(data);
    });

    socket.on('word-hidden', () => {
      storeRef.current.onWordHidden();
    });

    socket.on('phase-changed', ({ phase }) => {
      if (phase === 'playing') storeRef.current.onWordHidden();
    });

    socket.on('timer-tick', ({ timeRemaining }) => {
      storeRef.current.setTimeRemaining(timeRemaining);
    });

    socket.on('players-updated', ({ players }) => {
      storeRef.current.updatePlayers(players);
    });

    socket.on('player-eliminated', () => {
      // Player list is updated via players-updated; no extra action needed here
    });

    // ── Chat Events ─────────────────────────────────────────────
    socket.on('new-message', (msg) => {
      storeRef.current.addMessage(msg);
    });

    socket.on('message-rejected', (data) => {
      storeRef.current.showRejection(data);
    });

    // ── Guess Events ────────────────────────────────────────────
    socket.on('guess-result', (data) => {
      storeRef.current.onGuessResult(data);
    });

    // ── Turn Events ──────────────────────────────────────────────
    socket.on('turn-changed', (data) => {
      storeRef.current.onTurnChanged(data);
    });

    socket.on('player-described', ({ socketId }) => {
      storeRef.current.setPlayerDescribed(socketId);
    });

    // ── Round Over ───────────────────────────────────────────────
    socket.on('round-over', (data) => {
      storeRef.current.onRoundOver(data);
    });

    // ── Rematch ──────────────────────────────────────────────────
    socket.on('rematch-started', (data) => {
      storeRef.current.onRematch(data);
    });

    return () => {
      socket.off('connect');
      socket.off('room-created');
      socket.off('room-joined');
      socket.off('join-error');
      socket.off('start-error');
      socket.off('guess-error');
      socket.off('player-joined');
      socket.off('player-left');
      socket.off('round-duration-updated');
      socket.off('game-started');
      socket.off('your-word');
      socket.off('word-hidden');
      socket.off('phase-changed');
      socket.off('timer-tick');
      socket.off('players-updated');
      socket.off('player-eliminated');
      socket.off('turn-changed');
      socket.off('player-described');
      socket.off('new-message');
      socket.off('message-rejected');
      socket.off('guess-result');
      socket.off('round-over');
      socket.off('rematch-started');
    };
  }, []);

  // ── Emit helpers ───────────────────────────────────────────────
  const emit = (event, data) => getSocket().emit(event, data);

  const createRoom = (name, avatar) => emit('create-room', { name, avatar });
  const joinRoom   = (roomId, name, avatar) => emit('join-room', { roomId, name, avatar });
  const startGame  = (roomId) => emit('start-game', { roomId });
  const setRoundDuration = (roomId, duration) => emit('set-round-duration', { roomId, duration });
  const sendMessage    = (roomId, text) => emit('send-message', { roomId, text });
  const submitGuess    = (roomId, guessedSocketId) => emit('submit-guess', { roomId, guessedSocketId });
  const passTurn       = (roomId) => emit('pass-turn', { roomId });
  const requestRematch = (roomId) => emit('request-rematch', { roomId });

  return { createRoom, joinRoom, startGame, setRoundDuration, sendMessage, submitGuess, passTurn, requestRematch };
}

export default useSocket;
