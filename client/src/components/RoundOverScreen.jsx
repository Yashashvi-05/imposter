import React, { useState, useEffect } from 'react';
import { AVATAR_COLORS } from '../store/useGameStore';
import './RoundOverScreen.css';

function getAvatarBg(avatarId) {
  return AVATAR_COLORS.find((a) => a.id === avatarId)?.bg ?? '#7c3aed';
}

const RESULT_CONFIG = {
  'win':              { label: '🏆 Found Imposter!',   cls: 'win',      desc: 'Correctly identified the imposter' },
  'self-identify-win':{ label: '🎭 Self-Identified!',  cls: 'self-win', desc: 'Deduced their own imposter role' },
  'survival-win':     { label: '🕵️ Survived!',         cls: 'survival', desc: 'The imposter evaded detection' },
  'loss':             { label: '❌ Eliminated',         cls: 'loss',     desc: 'Failed to find the imposter' },
};

const REASON_TEXT = {
  'timer':               'Time ran out!',
  'all-crewmates-done':  'All players have finished guessing.',
  'imposter-self-identified': 'The Imposter self-identified!',
  'imposter-disconnected': 'The Imposter disconnected.',
};

export default function RoundOverScreen({ data, mySocketId, isHost, onRematch }) {
  const [revealed, setRevealed] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    // Staggered reveal
    const t1 = setTimeout(() => setRevealed(true), 300);
    const t2 = setTimeout(() => setShowConfetti(true), 600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (!data) return null;

  const { players, crewWord, imposterWord, imposterSocketId, reason } = data;
  const imposter = players.find((p) => p.socketId === imposterSocketId);
  const myResult = players.find((p) => p.socketId === mySocketId);

  const winners = players.filter((p) =>
    p.result === 'win' || p.result === 'self-identify-win' || p.result === 'survival-win'
  );

  return (
    <div className="round-over-screen">
      {/* Confetti particles */}
      {showConfetti && (
        <div className="confetti-wrap" aria-hidden="true">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="confetti-piece"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                background: ['#7c3aed','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899'][i % 6],
              }}
            />
          ))}
        </div>
      )}

      <div className="round-over-content animate-slide-up">
        {/* Header */}
        <div className="ro-header">
          <div className="ro-title">
            <span className="ro-emoji">🔍</span>
            <h1>Round Over</h1>
          </div>
          <div className="ro-reason">{REASON_TEXT[reason] ?? reason}</div>
        </div>

        {/* Word Reveal */}
        <div className="word-reveal-banner animate-scale-in" style={{ animationDelay: '150ms' }}>
          <div className="word-reveal-item crew">
            <span className="wr-label">Crewmate Word</span>
            <span className="wr-word">{crewWord}</span>
          </div>
          <div className="wr-vs">vs</div>
          <div className="word-reveal-item imposter">
            <span className="wr-label">Imposter Word</span>
            <span className="wr-word">{imposterWord}</span>
          </div>
        </div>

        {/* My Result */}
        {myResult && (
          <div className={`my-result-card animate-bounce-in ${RESULT_CONFIG[myResult.result]?.cls}`}
            style={{ animationDelay: '200ms' }}>
            <span className="my-result-label">YOUR RESULT</span>
            <span className="my-result-value">{RESULT_CONFIG[myResult.result]?.label}</span>
            <span className="my-result-desc">{RESULT_CONFIG[myResult.result]?.desc}</span>
          </div>
        )}

        {/* All Players */}
        <div className="players-reveal">
          <h3 className="section-label-lg">All Players</h3>
          <div className="reveal-grid">
            {players.map((p, i) => {
              const cfg = RESULT_CONFIG[p.result] ?? { label: p.result, cls: 'loss', desc: '' };
              const isImposterPlayer = p.socketId === imposterSocketId;
              return (
                <div
                  key={p.socketId}
                  className={`reveal-card glass animate-slide-up ${isImposterPlayer ? 'is-imposter' : 'is-crew'}`}
                  style={{ animationDelay: revealed ? `${i * 80}ms` : '9999s' }}
                >
                  <div className="reveal-avatar-wrap">
                    <div
                      className="avatar avatar-lg"
                      style={{ background: getAvatarBg(p.avatar) }}
                    >
                      {p.name[0].toUpperCase()}
                    </div>
                    <div className={`role-pip ${isImposterPlayer ? 'imposter-pip' : 'crew-pip'}`}>
                      {isImposterPlayer ? '🕵️' : '🧑‍🚀'}
                    </div>
                  </div>

                  <div className="reveal-info">
                    <div className="reveal-name">
                      {p.name}
                      {p.socketId === mySocketId && <span className="you-chip">You</span>}
                    </div>
                    <div className={`reveal-role ${isImposterPlayer ? 'role-imp' : 'role-crew'}`}>
                      {isImposterPlayer ? 'Imposter' : 'Crewmate'}
                    </div>
                    <div className="reveal-word">"{p.word}"</div>
                  </div>

                  <div className={`reveal-result ${cfg.cls}`}>
                    {cfg.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Winner Summary */}
        {winners.length > 0 && (
          <div className="winner-summary animate-fade-in" style={{ animationDelay: '600ms' }}>
            🏆 {winners.map(w => w.name).join(', ')} {winners.length === 1 ? 'wins' : 'win'} this round!
          </div>
        )}

        {/* Actions */}
        <div className="ro-actions animate-fade-in" style={{ animationDelay: '700ms' }}>
          {isHost ? (
            <button id="play-again-btn" className="btn btn-primary btn-lg" onClick={onRematch}>
              🔄 Play Again
            </button>
          ) : (
            <div className="glass waiting-for-host">
              ⏳ Waiting for host to start a new round...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
