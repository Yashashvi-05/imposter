import React, { useState, useEffect } from 'react';
import useGameStore, { AVATAR_COLORS } from '../store/useGameStore';
import { useSocket } from '../hooks/useSocket';
import './LandingPage.css';

export default function LandingPage() {
  const [name, setName]           = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_COLORS[0]);
  const [mode, setMode]           = useState('home');  // 'home' | 'create' | 'join'
  const [roomCode, setRoomCode]   = useState('');
  const [joining, setJoining]     = useState(false);
  const [creating, setCreating]   = useState(false);

  const { createRoom, joinRoom } = useSocket();
  const errorMessage = useGameStore((s) => s.errorMessage);
  const clearError   = useGameStore((s) => s.clearError);
  const setMyName    = useGameStore((s) => s.setMyName);
  const setMyAvatar  = useGameStore((s) => s.setMyAvatar);

  // Clear errors on mode change
  useEffect(() => { clearError(); }, [mode]);

  // Auto-clear error after 3s
  useEffect(() => {
    if (errorMessage) {
      const t = setTimeout(clearError, 3500);
      return () => clearTimeout(t);
    }
  }, [errorMessage]);

  const nameValid = name.trim().length >= 2 && name.trim().length <= 16;

  const handleCreate = () => {
    if (!nameValid) return;
    setCreating(true);
    setMyName(name.trim());
    setMyAvatar(selectedAvatar);
    createRoom(name.trim(), selectedAvatar.id);
    setTimeout(() => setCreating(false), 3000);
  };

  const handleJoin = () => {
    if (!nameValid || roomCode.trim().length < 4) return;
    setJoining(true);
    setMyName(name.trim());
    setMyAvatar(selectedAvatar);
    joinRoom(roomCode.trim().toUpperCase(), name.trim(), selectedAvatar.id);
    setTimeout(() => setJoining(false), 3000);
  };

  return (
    <div className="landing-page">
      {/* Hero */}
      <div className="landing-hero animate-slide-up">
        <div className="hero-icon animate-float">🕵️</div>
        <h1 className="hero-title">
          <span className="shimmer-text">IMPOSTER</span>
        </h1>
        <p className="hero-subtitle">
          One word separates you.<br />Trust no one. Find the odd one out.
        </p>

        <div className="hero-stats">
          <div className="stat-chip">🎮 4–12 Players</div>
          <div className="stat-chip">⚡ Real-time</div>
          <div className="stat-chip">🧠 Mind Games</div>
        </div>
      </div>

      {/* Main Card */}
      <div className="landing-card glass animate-slide-up" style={{ animationDelay: '100ms' }}>

        {/* Name + Avatar */}
        <div className="form-section">
          <label className="form-label">Your Display Name</label>
          <input
            id="player-name-input"
            className="input"
            type="text"
            placeholder="Enter your name..."
            value={name}
            maxLength={16}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (mode === 'create') handleCreate();
                if (mode === 'join') handleJoin();
                if (mode === 'home') setMode('create');
              }
            }}
          />
          {name.length > 0 && !nameValid && (
            <span className="form-hint error">Name must be 2–16 characters</span>
          )}
        </div>

        <div className="form-section">
          <label className="form-label">Pick your color</label>
          <div className="avatar-grid">
            {AVATAR_COLORS.map((av) => (
              <button
                key={av.id}
                id={`avatar-${av.id}`}
                className={`avatar-picker ${selectedAvatar.id === av.id ? 'selected' : ''}`}
                style={{ background: av.bg }}
                onClick={() => setSelectedAvatar(av)}
                title={av.label}
                aria-label={`Select ${av.label} color`}
              >
                {selectedAvatar.id === av.id && <span className="check">✓</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        {name.trim() && (
          <div className="player-preview animate-scale-in">
            <div className="avatar" style={{ background: selectedAvatar.bg }}>
              {name.trim()[0].toUpperCase()}
            </div>
            <span>{name.trim()}</span>
          </div>
        )}

        <div className="divider" />

        {/* Actions */}
        {mode === 'home' && (
          <div className="action-group animate-scale-in">
            <button
              id="create-room-btn"
              className="btn btn-primary btn-full btn-lg"
              onClick={() => setMode('create')}
              disabled={!nameValid}
            >
              🛋️ Create a Room
            </button>
            <button
              id="join-room-btn"
              className="btn btn-secondary btn-full btn-lg"
              onClick={() => setMode('join')}
              disabled={!nameValid}
            >
              🔗 Join a Room
            </button>
            {!nameValid && (
              <p className="action-hint">Enter a name first to continue</p>
            )}
          </div>
        )}

        {mode === 'create' && (
          <div className="action-group animate-scale-in">
            <button
              id="confirm-create-btn"
              className="btn btn-primary btn-full btn-lg"
              onClick={handleCreate}
              disabled={!nameValid || creating}
            >
              {creating ? <span className="spinner" /> : '🚀'} Create Room
            </button>
            <button className="btn btn-secondary btn-full" onClick={() => setMode('home')}>
              ← Back
            </button>
          </div>
        )}

        {mode === 'join' && (
          <div className="action-group animate-scale-in">
            <input
              id="room-code-input"
              className="input code-input"
              type="text"
              placeholder="ROOM CODE"
              value={roomCode}
              maxLength={6}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            />
            <button
              id="confirm-join-btn"
              className="btn btn-primary btn-full btn-lg"
              onClick={handleJoin}
              disabled={!nameValid || roomCode.trim().length < 4 || joining}
            >
              {joining ? <span className="spinner" /> : '🔗'} Join Room
            </button>
            <button className="btn btn-secondary btn-full" onClick={() => setMode('home')}>
              ← Back
            </button>
          </div>
        )}

        {/* Error */}
        {errorMessage && (
          <div className="error-banner animate-shake" role="alert">
            ⚠️ {errorMessage}
          </div>
        )}
      </div>

      {/* How to play */}
      <div className="how-to-play glass animate-slide-up" style={{ animationDelay: '200ms' }}>
        <h3>How to Play</h3>
        <div className="rules-grid">
          <div className="rule-item">
            <span className="rule-icon">🎯</span>
            <div>
              <strong>Get a Word</strong>
              <p>Everyone gets the same word — except the Imposter, who gets a similar but different word.</p>
            </div>
          </div>
          <div className="rule-item">
            <span className="rule-icon">💬</span>
            <div>
              <strong>Describe It</strong>
              <p>Type descriptions of your word in real-time. Don't be too obvious — or too vague!</p>
            </div>
          </div>
          <div className="rule-item">
            <span className="rule-icon">🔍</span>
            <div>
              <strong>Find the Imposter</strong>
              <p>Click on any player to accuse them. Guess wisely — you only get 2–3 chances.</p>
            </div>
          </div>
          <div className="rule-item">
            <span className="rule-icon">🤫</span>
            <div>
              <strong>The Twist</strong>
              <p>The Imposter doesn't know they're the Imposter! They must figure it out from context.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
