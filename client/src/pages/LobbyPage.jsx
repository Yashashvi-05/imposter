import React, { useState, useEffect } from 'react';
import useGameStore, { AVATAR_COLORS } from '../store/useGameStore';
import { useSocket } from '../hooks/useSocket';
import './LobbyPage.css';

const DURATION_OPTIONS = [
  { value: 180, label: '3 min', desc: 'Quick' },
  { value: 300, label: '5 min', desc: 'Standard' },
  { value: 480, label: '8 min', desc: 'Extended' },
];

function getAvatarBg(avatarId) {
  return AVATAR_COLORS.find((a) => a.id === avatarId)?.bg ?? '#7c3aed';
}

export default function LobbyPage() {
  const {
    roomId, players, isHost, mySocketId,
    roundDuration, errorMessage, clearError,
  } = useGameStore();
  const { startGame, setRoundDuration } = useSocket();
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);

  const canStart = players.length >= 4;

  useEffect(() => { clearError?.(); }, []);

  const handleCopy = () => {
    const text = roomId;
    // navigator.clipboard requires HTTPS — use textarea fallback for LAN/HTTP
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    } else {
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.focus();
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleStart = () => {
    if (!canStart || !isHost) return;
    setStarting(true);
    startGame(roomId);
    setTimeout(() => setStarting(false), 5000);
  };

  return (
    <div className="lobby-page">
      {/* Header */}
      <div className="lobby-header animate-slide-up">
        <div className="lobby-brand">
          <span className="lobby-emoji">🕵️</span>
          <span className="lobby-title shimmer-text">IMPOSTER</span>
        </div>
        <span className="badge badge-violet">Lobby</span>
      </div>

      <div className="lobby-layout">
        {/* Left: Room Info + Settings */}
        <div className="lobby-left animate-slide-up" style={{ animationDelay: '80ms' }}>
          {/* Room Code */}
          <div className="glass room-code-card">
            <p className="section-label">Room Code</p>
            <div className="room-code-display">
              <span className="room-code-text">{roomId}</span>
              <button
                id="copy-room-code-btn"
                className="btn btn-secondary btn-sm"
                onClick={handleCopy}
              >
                {copied ? '✓ Copied!' : '📋 Copy'}
              </button>
            </div>
            <p className="room-code-hint">Share this code with your friends</p>
          </div>

          {/* Timer Settings (host only) */}
          {isHost && (
            <div className="glass settings-card">
              <p className="section-label">Round Duration</p>
              <div className="duration-options">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    id={`duration-${opt.value}`}
                    className={`duration-btn ${roundDuration === opt.value ? 'active' : ''}`}
                    onClick={() => setRoundDuration(roomId, opt.value)}
                  >
                    <span className="duration-label">{opt.label}</span>
                    <span className="duration-desc">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!isHost && (
            <div className="glass settings-card">
              <p className="section-label">Round Duration</p>
              <div className="duration-display">
                <span className="duration-value">
                  {DURATION_OPTIONS.find(d => d.value === roundDuration)?.label ?? '5 min'}
                </span>
                <span className="duration-desc-static">Set by host</span>
              </div>
            </div>
          )}

          {/* Game Rules Quick Ref */}
          <div className="glass rules-card">
            <p className="section-label">Quick Rules</p>
            <ul className="rules-list">
              <li><span className="rules-icon">🎯</span> Min 4 players needed</li>
              <li><span className="rules-icon">🤫</span> 1 random player gets a different word</li>
              <li><span className="rules-icon">💬</span> Describe your word — don't say it!</li>
              <li><span className="rules-icon">🔍</span> {players.length === 4 ? '2 chances' : '3 chances'} to find the imposter</li>
              <li><span className="rules-icon">⚡</span> Word visible for only 4-5 seconds!</li>
            </ul>
          </div>
        </div>

        {/* Right: Player List */}
        <div className="lobby-right animate-slide-up" style={{ animationDelay: '160ms' }}>
          <div className="glass players-panel">
            <div className="players-header">
              <p className="section-label">Players</p>
              <span className="badge badge-grey">{players.length} / 12</span>
            </div>

            <div className="players-list">
              {players.map((p, i) => (
                <div
                  key={p.socketId}
                  className="player-row animate-slide-up"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div
                    className="avatar"
                    style={{ background: getAvatarBg(p.avatar) }}
                  >
                    {p.name[0].toUpperCase()}
                  </div>
                  <div className="player-info">
                    <span className="player-name">
                      {p.name}
                      {p.socketId === mySocketId && (
                        <span className="you-tag">You</span>
                      )}
                    </span>
                    {p.isHost && <span className="host-tag">👑 Host</span>}
                  </div>
                  <div className="player-status">
                    <span className="ready-dot" />
                  </div>
                </div>
              ))}

              {/* Empty slots */}
              {Array.from({ length: Math.max(0, 4 - players.length) }).map((_, i) => (
                <div key={`empty-${i}`} className="player-row empty">
                  <div className="avatar empty-avatar">?</div>
                  <span className="empty-label">Waiting for player...</span>
                </div>
              ))}
            </div>

            {/* Player count status */}
            <div className="player-count-status">
              {canStart ? (
                <div className="status-ready">
                  ✅ Ready to start!
                </div>
              ) : (
                <div className="status-waiting">
                  ⏳ Need {4 - players.length} more player{4 - players.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>

          {/* Start / Wait CTA */}
          {isHost ? (
            <button
              id="start-game-btn"
              className={`btn btn-primary btn-full btn-lg start-btn ${!canStart ? '' : 'pulse-glow'}`}
              onClick={handleStart}
              disabled={!canStart || starting}
            >
              {starting ? (
                <><span className="spinner" /> Starting...</>
              ) : (
                <>{canStart ? '🚀 Start Game' : `⏳ Waiting for players (${players.length}/4)`}</>
              )}
            </button>
          ) : (
            <div className="glass waiting-card">
              <div className="waiting-animation">
                <span>⏳</span>
              </div>
              <p className="waiting-text">Waiting for host to start the game...</p>
            </div>
          )}

          {errorMessage && (
            <div className="error-banner animate-shake" role="alert">
              ⚠️ {errorMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
