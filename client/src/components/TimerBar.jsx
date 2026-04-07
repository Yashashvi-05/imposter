import React from 'react';
import './TimerBar.css';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function TimerBar({ timeRemaining, totalDuration }) {
  const pct = totalDuration > 0 ? (timeRemaining / totalDuration) * 100 : 100;
  const isUrgent = timeRemaining <= 30;

  let barColor = 'var(--violet)';
  if (timeRemaining <= 30) barColor = 'var(--red)';
  else if (timeRemaining <= 60) barColor = 'var(--amber)';

  return (
    <div className={`timer-wrap ${isUrgent ? 'urgent' : ''}`}>
      <div className="timer-display">
        <span className="timer-label">⏱ TIME</span>
        <span className={`timer-value ${isUrgent ? 'timer-urgent' : ''}`}>
          {formatTime(timeRemaining)}
        </span>
      </div>
      <div className="timer-track">
        <div
          className="timer-fill"
          style={{
            width: `${pct}%`,
            background: barColor,
            boxShadow: `0 0 12px ${barColor}80`,
          }}
        />
      </div>
    </div>
  );
}
