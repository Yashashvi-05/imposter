import { create } from 'zustand';

const AVATAR_COLORS = [
  { id: 'violet', bg: '#7c3aed', label: 'Violet' },
  { id: 'cyan',   bg: '#06b6d4', label: 'Cyan'   },
  { id: 'rose',   bg: '#f43f5e', label: 'Rose'   },
  { id: 'amber',  bg: '#f59e0b', label: 'Amber'  },
  { id: 'emerald',bg: '#10b981', label: 'Emerald' },
  { id: 'sky',    bg: '#0ea5e9', label: 'Sky'     },
  { id: 'pink',   bg: '#ec4899', label: 'Pink'    },
  { id: 'lime',   bg: '#84cc16', label: 'Lime'    },
  { id: 'orange', bg: '#f97316', label: 'Orange'  },
  { id: 'teal',   bg: '#14b8a6', label: 'Teal'    },
];

const useGameStore = create((set, get) => ({
  // ─── Identity ────────────────────────────────────────────────
  mySocketId: null,
  myName: '',
  myAvatar: AVATAR_COLORS[0],

  // ─── Room ─────────────────────────────────────────────────────
  roomId: null,
  isHost: false,
  roundDuration: 300,

  // ─── Players ──────────────────────────────────────────────────
  players: [],   // public player list (from server)

  // ─── Game Phase ───────────────────────────────────────────────
  phase: 'landing',  // 'landing'|'lobby'|'word-flash'|'playing'|'round-over'

  // ─── My Private Word ──────────────────────────────────────────
  myWord: null,
  myRole: null,          // 'crewmate'|'imposter'
  wordVisible: true,     // true during flash, then false

  // ─── Timer ────────────────────────────────────────────────────
  timeRemaining: 300,

  // ─── Chat ─────────────────────────────────────────────────────
  messages: [],
  rejectionToast: null,  // { reason, text }

  // ─── Guess ────────────────────────────────────────────────────
  guessResult: null,     // { correct, guessedName, imposterWord?, crewWord?, chancesLeft?, eliminated? }
  guessResultVisible: false,

  // ─── Round Over ───────────────────────────────────────────────
  roundOverData: null,

  // ─── Turn ─────────────────────────────────────────────────────
  currentTurnSocketId: null,
  currentTurnName: null,
  describedPlayerIds: new Set(), // tracks who has typed a description this round

  // ─── UI Flags ─────────────────────────────────────────────────
  errorMessage: null,

  // ──────────────────────────────────────────────────────────────
  // SETTERS
  // ──────────────────────────────────────────────────────────────

  setMySocketId: (id) => set({ mySocketId: id }),
  setMyName: (name) => set({ myName: name }),
  setMyAvatar: (avatar) => set({ myAvatar: avatar }),
  setErrorMessage: (msg) => set({ errorMessage: msg }),
  clearError: () => set({ errorMessage: null }),

  setRoundDuration: (d) => set({ roundDuration: d }),
  setTimeRemaining: (t) => set({ timeRemaining: t }),

  setPlayerDescribed: (socketId) =>
    set((state) => ({ describedPlayerIds: new Set([...state.describedPlayerIds, socketId]) })),

  // Called when room is created or joined
  initRoom: ({ roomId, players, host, roundDuration }) => {
    const { mySocketId } = get();
    set({
      roomId,
      players,
      isHost: host === mySocketId,
      roundDuration: roundDuration ?? 300,
      timeRemaining: roundDuration ?? 300,
      phase: 'lobby',
      messages: [],
      roundOverData: null,
      guessResult: null,
      guessResultVisible: false,
      myWord: null,
      myRole: null,
      wordVisible: true,
    });
  },

  updatePlayers: (players) => set({ players }),

  updateHost: (newHostId) => {
    const { mySocketId } = get();
    set({ isHost: newHostId === mySocketId });
  },

  // Game started → move to word-flash
  onGameStarted: ({ players }) => {
    set({
      players,
      phase: 'word-flash',
      wordVisible: true,
      messages: [],
      guessResult: null,
      guessResultVisible: false,
      roundOverData: null,
    });
  },

  // Private word received
  onYourWord: ({ word, role }) => set({ myWord: word, myRole: role }),

  // Word flash ends
  onWordHidden: () => set({ wordVisible: false, phase: 'playing' }),

  // Chat
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  showRejection: (rejection) => set({ rejectionToast: rejection }),
  clearRejection: () => set({ rejectionToast: null }),

  // Guess result (shown privately)
  onGuessResult: (result) => {
    set({ guessResult: result, guessResultVisible: true });
    // Auto-hide after 4s (let user read it)
    setTimeout(() => set({ guessResultVisible: false }), 4000);
  },
  clearGuessResult: () => set({ guessResultVisible: false }),

  // Turn changed
  onTurnChanged: ({ currentTurnSocketId, currentTurnName }) =>
    set({ currentTurnSocketId, currentTurnName }),

  // Round over
  onRoundOver: (data) => set({ roundOverData: data, phase: 'round-over', currentTurnSocketId: null, currentTurnName: null }),

  // Rematch — resets to lobby
  onRematch: ({ players, host, roundDuration }) => {
    const { mySocketId } = get();
    set({
      players,
      isHost: host === mySocketId,
      roundDuration,
      timeRemaining: roundDuration,
      phase: 'lobby',
      messages: [],
      roundOverData: null,
      guessResult: null,
      guessResultVisible: false,
      myWord: null,
      myRole: null,
      wordVisible: true,
      rejectionToast: null,
    });
  },

  // Full reset (go back to landing)
  reset: () => set({
    mySocketId: null,
    roomId: null,
    isHost: false,
    players: [],
    phase: 'landing',
    myWord: null,
    myRole: null,
    wordVisible: true,
    timeRemaining: 300,
    roundDuration: 300,
    messages: [],
    rejectionToast: null,
    guessResult: null,
    guessResultVisible: false,
    roundOverData: null,
    errorMessage: null,
    currentTurnSocketId: null,
    currentTurnName: null,
  }),
}));

export { AVATAR_COLORS };
export default useGameStore;
