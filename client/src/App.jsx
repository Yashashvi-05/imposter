import React from 'react';
import useGameStore from './store/useGameStore';
import { useSocket } from './hooks/useSocket';
import LandingPage from './pages/LandingPage';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';

export default function App() {
  const phase = useGameStore((s) => s.phase);
  useSocket(); // Mount singleton socket & event listeners

  return (
    <>
      {phase === 'landing' && <LandingPage />}
      {phase === 'lobby'   && <LobbyPage />}
      {(phase === 'word-flash' || phase === 'playing' || phase === 'round-over') && <GamePage />}
    </>
  );
}
