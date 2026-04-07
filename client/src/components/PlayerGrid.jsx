import React, { useState } from 'react';
import { AVATAR_COLORS } from '../store/useGameStore';
import './PlayerGrid.css';

function getAvatarBg(avatarId) {
  return AVATAR_COLORS.find((a) => a.id === avatarId)?.bg ?? '#7c3aed';
}

function ChanceDots({ total, remaining }) {
  return (
    <div className="chance-dots">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`chance-dot ${i < remaining ? '' : 'used'}`} />
      ))}
    </div>
  );
}

/**
 * Player grid — click any card to accuse.
 * Self-click allowed only for the imposter (self-identification).
 */
export default function PlayerGrid({
  players,
  mySocketId,
  myRole,
  myEliminated,
  myGuessedCorrectly,
  totalPlayers,
  isMyTurn,
  iHaveDescribed,
  onGuess,
}) {
  const [confirming, setConfirming] = useState(null);

  // Can accuse only on your turn, after you've described, and you're still active
  const canIAccuse = isMyTurn && iHaveDescribed && !myEliminated && !myGuessedCorrectly;
  const maxChances = totalPlayers === 4 ? 2 : 3;

  const handleCardClick = (player) => {
    if (!canIAccuse) return;
    setConfirming(player.socketId);
  };

  const handleConfirm = (player) => {
    setConfirming(null);
    onGuess(player.socketId);
  };

  const handleCancel = () => setConfirming(null);

  // Status line shown in header
  let headerStatus = null;
  if (myEliminated)        headerStatus = <span className="grid-status">💀 Eliminated</span>;
  else if (myGuessedCorrectly) headerStatus = <span className="grid-status">✅ Found imposter!</span>;
  else if (!isMyTurn)      headerStatus = <span className="grid-hint">⏳ Wait for your turn</span>;
  else if (!iHaveDescribed) headerStatus = <span className="grid-hint">💬 Describe first, then accuse</span>;
  else                     headerStatus = <span className="grid-hint">👆 Click to accuse</span>;

  return (
    <div className="player-grid-wrap">
      <div className="player-grid-header">
        <span className="grid-title">Players</span>
        {headerStatus}
      </div>

      <div className="player-grid">
        {players.map((p) => {
          const isSelf = p.socketId === mySocketId;
          // Self-card is clickable for imposter on their turn (self-identify)
          // Other cards clickable when canIAccuse AND target is not eliminated
          const isClickable = canIAccuse && !p.isEliminated &&
            (!isSelf || myRole === 'imposter');
          const isConfirming = confirming === p.socketId;
          const playerMaxChances = totalPlayers === 4 ? 2 : 3;

          return (
            <div
              key={p.socketId}
              id={`player-card-${p.socketId}`}
              className={[
                'player-card glass',
                isClickable ? 'clickable' : '',
                p.isEliminated ? 'eliminated' : '',
                // Only highlight YOUR OWN card green when you've found the imposter
                (isSelf && p.hasGuessedCorrectly) ? 'guessed-correctly' : '',
                isSelf ? 'self' : '',
                isConfirming ? 'confirming' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => !isConfirming && handleCardClick(p)}
              role={isClickable ? 'button' : undefined}
              tabIndex={isClickable ? 0 : undefined}
              aria-label={isClickable ? `Accuse ${p.name}` : undefined}
              onKeyDown={(e) => e.key === 'Enter' && isClickable && handleCardClick(p)}
            >
              {/* Avatar */}
              <div className="card-avatar-wrap">
                <div
                  className={`avatar avatar-lg ${p.isEliminated ? 'faded' : ''}`}
                  style={{ background: getAvatarBg(p.avatar) }}
                >
                  {p.name[0].toUpperCase()}
                </div>
                {isSelf && <div className="self-ring" />}
                {/* Only show the ✓ badge on the player's own card */}
                {isSelf && p.hasGuessedCorrectly && (
                  <div className="correct-badge">✓</div>
                )}
                {p.isEliminated && (
                  <div className="elim-badge">✕</div>
                )}
              </div>

              {/* Info */}
              <div className="card-body">
                <div className="card-name">
                  {p.name}
                  {isSelf && <span className="you-chip">You</span>}
                  {p.isHost && <span className="host-chip">👑</span>}
                </div>

                {/* Status row — never reveal another player's guess result */}
                {p.isEliminated ? (
                  <span className="status-text eliminated-text">💀 Eliminated</span>
                ) : (isSelf && p.hasGuessedCorrectly) ? (
                  <span className="status-text correct-text">✅ Found imposter</span>
                ) : (
                  <ChanceDots
                    total={playerMaxChances}
                    remaining={p.chancesLeft}
                  />
                )}
              </div>

              {/* Confirm overlay */}
              {isConfirming && (
                <div className="confirm-overlay animate-scale-in">
                  <p className="confirm-text">
                    {isSelf ? '🤔 You think YOU are the Imposter?' : `Accuse ${p.name}?`}
                  </p>
                  <div className="confirm-actions">
                    <button
                      id={`confirm-accuse-${p.socketId}`}
                      className="btn btn-danger btn-sm"
                      onClick={(e) => { e.stopPropagation(); handleConfirm(p); }}
                    >
                      {isSelf ? 'Yes, I\'m the Imposter!' : '⚡ Accuse!'}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={(e) => { e.stopPropagation(); handleCancel(); }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Imposter self-identify hint */}
      {myRole === 'imposter' && canIGuess && (
        <div className="imposter-hint-bar">
          🤫 Think you're the Imposter? Click your own card to self-identify!
        </div>
      )}
    </div>
  );
}
