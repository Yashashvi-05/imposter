import React, { useEffect, useRef, useState } from 'react';
import './WordFlash.css';

/**
 * Word Flash Overlay — shown for 4-5 seconds at round start.
 * Slides in, displays word prominently, animated countdown ring, then fades out.
 */
export default function WordFlash({ word, role, visible }) {
  const TOTAL_DURATION = 5; // seconds for display (server drives real timing, this is visual)
  const [timeLeft, setTimeLeft] = useState(TOTAL_DURATION);
  const intervalRef = useRef(null);

  const CIRCUMFERENCE = 2 * Math.PI * 45; // r=45

  useEffect(() => {
    if (!visible) return;
    setTimeLeft(TOTAL_DURATION);
    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(intervalRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [visible]);

  const progress = ((TOTAL_DURATION - timeLeft) / TOTAL_DURATION) * CIRCUMFERENCE;

  if (!visible) return null;

  const isImposter = role === 'imposter';

  return (
    <div className={`word-flash-overlay ${visible ? 'visible' : ''}`} role="dialog" aria-live="polite">
      <div className="word-flash-bg" />

      <div className="word-flash-content animate-scale-in">
        {/* Role label */}
        <div className={`role-badge-flash ${isImposter ? 'imposter' : 'crewmate'}`}>
          {isImposter ? '🕵️ You are the IMPOSTER' : '🧑‍🚀 You are a CREWMATE'}
        </div>

        {/* Word display */}
        <div className="word-container">
          <p className="your-word-label">Your word is</p>
          <div className={`word-display ${isImposter ? 'imposter-word' : 'crew-word'}`}>
            {word}
          </div>
          {isImposter && (
            <p className="imposter-hint">
              ⚠️ Your word is slightly different from everyone else's.<br />
              You don't know what theirs is!
            </p>
          )}
        </div>

        {/* Countdown ring */}
        <div className="countdown-ring">
          <svg viewBox="0 0 100 100" width="110" height="110">
            <circle className="ring-bg" cx="50" cy="50" r="45" />
            <circle
              className="ring-fill"
              cx="50" cy="50" r="45"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={progress}
              style={{ stroke: isImposter ? '#ef4444' : '#7c3aed' }}
            />
          </svg>
          <div className="countdown-number">{timeLeft}</div>
        </div>

        <p className="memorize-hint">Memorize your word — it disappears in {timeLeft}s!</p>
      </div>
    </div>
  );
}
