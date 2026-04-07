import React, { useRef, useEffect, useState } from 'react';
import { AVATAR_COLORS } from '../store/useGameStore';
import './ChatFeed.css';

function getAvatarBg(avatarId) {
  return AVATAR_COLORS.find((a) => a.id === avatarId)?.bg ?? '#7c3aed';
}

function formatTime(ts) {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export default function ChatFeed({
  messages,
  mySocketId,
  rejectionToast,
  onSendMessage,
  myEliminated,
  isMyTurn,
  iHaveDescribed,
  disabled,
}) {
  const [inputText, setInputText] = useState('');
  const [localError, setLocalError] = useState('');
  const feedRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (rejectionToast) {
      setLocalError(rejectionToast.reason);
      const t = setTimeout(() => setLocalError(''), 3500);
      return () => clearTimeout(t);
    }
  }, [rejectionToast]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;
    if (text.length > 200) { setLocalError('Message too long (max 200 characters)'); return; }
    onSendMessage(text);
    setInputText('');
    setLocalError('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // Can only type on your turn AND you haven't described yet (one description per turn)
  const canSend = !disabled && !myEliminated && isMyTurn && inputText.trim().length > 0;

  // What to show in the input area
  let inputAreaContent;
  if (myEliminated) {
    inputAreaContent = (
      <div className="chat-locked-notice red">
        💀 You've been eliminated. Watch the game unfold…
      </div>
    );
  } else if (!isMyTurn) {
    inputAreaContent = (
      <div className="chat-locked-notice grey">
        ⏳ Waiting for other player to describe…
      </div>
    );
  } else if (iHaveDescribed) {
    inputAreaContent = (
      <div className="chat-locked-notice green">
        ✅ Description sent! Now accuse someone on the right, or pass your turn.
      </div>
    );
  } else {
    inputAreaContent = (
      <>
        <div className="chat-input-wrap">
          <textarea
            id="chat-message-input"
            ref={inputRef}
            className="chat-input"
            placeholder="Describe your word… (Enter to send)"
            value={inputText}
            onChange={(e) => { setInputText(e.target.value); if (localError) setLocalError(''); }}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            maxLength={200}
            rows={2}
          />
          <div className="char-count">{inputText.length}/200</div>
        </div>
        <button
          id="send-message-btn"
          className="btn btn-primary send-btn"
          onClick={handleSend}
          disabled={!canSend}
        >
          Send ↵
        </button>
      </>
    );
  }

  return (
    <div className="chat-feed-wrap">
      <div className="chat-header">
        <span className="chat-title">💬 Descriptions</span>
        <span className="chat-subtitle">Describe your word subtly</span>
      </div>

      {/* Message Feed */}
      <div className="chat-messages" ref={feedRef}>
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty-icon">💭</div>
            <p>No messages yet.<br />Be the first to describe your word!</p>
          </div>
        )}

        {messages.map((msg, i) => {
          const isMe = msg.senderSocketId === mySocketId;
          return (
            <div
              key={msg.id}
              className={`chat-message ${isMe ? 'mine' : 'theirs'} animate-slide-up`}
              style={{ animationDelay: `${Math.min(i * 20, 200)}ms` }}
            >
              {!isMe && (
                <div
                  className="msg-avatar avatar avatar-sm"
                  style={{ background: getAvatarBg(msg.senderAvatar) }}
                  title={msg.senderName}
                >
                  {msg.senderName[0].toUpperCase()}
                </div>
              )}
              <div className="msg-bubble-wrap">
                {!isMe && (
                  <div className="msg-sender">{msg.senderName}</div>
                )}
                <div className="msg-bubble">
                  <span className="msg-text">{msg.text}</span>
                </div>
                <div className="msg-time">{formatTime(msg.timestamp)}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Error / Rejection */}
      {localError && (
        <div className="chat-error animate-slide-up" role="alert">
          {localError}
        </div>
      )}

      {/* Input */}
      <div className="chat-input-area">
        {inputAreaContent}
      </div>
    </div>
  );
}
