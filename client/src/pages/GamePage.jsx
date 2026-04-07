import React, { useEffect } from 'react';
import useGameStore, { AVATAR_COLORS } from '../store/useGameStore';
import { useSocket } from '../hooks/useSocket';
import WordFlash from '../components/WordFlash';
import PlayerGrid from '../components/PlayerGrid';
import ChatFeed from '../components/ChatFeed';
import TimerBar from '../components/TimerBar';
import RoundOverScreen from '../components/RoundOverScreen';
import './GamePage.css';

function getAvatarBg(avatarId) {
  return AVATAR_COLORS.find((a) => a.id === avatarId)?.bg ?? '#7c3aed';
}

export default function GamePage() {
  const {
    phase, players, mySocketId, myRole, myWord, wordVisible,
    timeRemaining, roundDuration, messages, rejectionToast,
    guessResult, guessResultVisible, roundOverData, isHost, roomId,
    currentTurnSocketId, currentTurnName, describedPlayerIds,
    clearRejection, clearGuessResult,
  } = useGameStore();

  const { sendMessage, submitGuess, passTurn, requestRematch } = useSocket();

  const me = players.find((p) => p.socketId === mySocketId);
  const myEliminated    = me?.isEliminated ?? false;
  const myGuessedCorrectly = me?.hasGuessedCorrectly ?? false;
  const myChancesLeft   = me?.chancesLeft ?? 0;
  const maxChances      = players.length === 4 ? 2 : 3;

  const isMyTurn        = currentTurnSocketId === mySocketId;
  const iHaveDescribed  = describedPlayerIds.has(mySocketId);

  const handleSendMessage = (text) => sendMessage(roomId, text);
  const handleGuess       = (guessedSocketId) => submitGuess(roomId, guessedSocketId);
  const handlePassTurn    = () => passTurn(roomId);
  const handleRematch     = () => requestRematch(roomId);

  useEffect(() => {
    if (rejectionToast) {
      const t = setTimeout(clearRejection, 4000);
      return () => clearTimeout(t);
    }
  }, [rejectionToast]);

  return (
    <div className="game-page">

      {/* ── Word Flash Overlay ──────────────────────────────────── */}
      {phase === 'word-flash' && (
        <WordFlash word={myWord} role={myRole} visible={wordVisible} />
      )}

      {/* ── Round Over Overlay ──────────────────────────────────── */}
      {phase === 'round-over' && roundOverData && (
        <RoundOverScreen
          data={roundOverData}
          mySocketId={mySocketId}
          isHost={isHost}
          onRematch={handleRematch}
        />
      )}

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="game-header">
        <div className="header-left">
          <span className="game-logo">🕵️</span>
          <span className="game-title-sm">IMPOSTER</span>
          <span className="room-code-sm">#{roomId}</span>
        </div>

        <div className="header-center">
          {phase === 'playing' && (
            <TimerBar timeRemaining={timeRemaining} totalDuration={roundDuration} />
          )}
          {phase === 'word-flash' && (
            <span className="badge badge-purple">Memorize your word!</span>
          )}
        </div>

        <div className="header-right">
          {phase === 'playing' && me && (
            <div className="header-chances">
              <span className="chances-label">Chances</span>
              <div className="chance-dots">
                {Array.from({ length: maxChances }).map((_, i) => (
                  <div key={i} className={`chance-dot ${i < myChancesLeft ? '' : 'used'}`} />
                ))}
              </div>
              {myEliminated      && <span className="badge badge-red">Eliminated</span>}
              {myGuessedCorrectly && <span className="badge badge-green">Found ✓</span>}
            </div>
          )}
          {me && (
            <div className="header-avatar">
              <div className="avatar" style={{ background: getAvatarBg(me.avatar) }}>
                {me.name[0].toUpperCase()}
              </div>
              <span className="header-name">{me.name}</span>
            </div>
          )}
        </div>
      </header>

      {/* ── Turn Status Banner ──────────────────────────────────── */}
      {phase === 'playing' && (
        <div className={`turn-banner ${isMyTurn ? 'my-turn' : 'their-turn'}`}>
          {isMyTurn ? (
            <>
              <span className="turn-icon">🎯</span>
              <span className="turn-text">
                <strong>Your turn!</strong>
                {!iHaveDescribed
                  ? ' Describe your word in chat, then accuse someone below.'
                  : ' Accuse someone — or pass your turn.'}
              </span>
              {iHaveDescribed && (
                <button
                  id="pass-turn-btn"
                  className="btn btn-outline btn-sm"
                  onClick={handlePassTurn}
                  disabled={myEliminated || myGuessedCorrectly}
                >
                  Pass Turn →
                </button>
              )}
            </>
          ) : (
            <>
              <span className="turn-icon">⏳</span>
              <span className="turn-text">
                <strong>{currentTurnName}</strong> is describing their word…
              </span>
            </>
          )}
        </div>
      )}

      {/* ── Private Guess Result Toast ──────────────────────────── */}
      {guessResultVisible && guessResult && (
        <div
          className={`guess-result-toast fade-in ${guessResult.correct ? 'correct' : 'wrong'}`}
          role="alert"
        >
          {guessResult.correct ? (
            <>
              <span className="gr-icon">🎯</span>
              <div>
                <div className="gr-title">Correct! {guessResult.guessedName} is the Imposter!</div>
                <div className="gr-sub">
                  Their word was "{guessResult.imposterWord}" vs everyone's "{guessResult.crewWord}"
                </div>
              </div>
            </>
          ) : (
            <>
              <span className="gr-icon">❌</span>
              <div>
                <div className="gr-title">Wrong! {guessResult.guessedName} is innocent.</div>
                <div className="gr-sub">
                  {guessResult.eliminated
                    ? "You've been eliminated."
                    : `${guessResult.chancesLeft} chance${guessResult.chancesLeft !== 1 ? 's' : ''} left`}
                </div>
              </div>
            </>
          )}
          <button className="gr-close" onClick={clearGuessResult}>✕</button>
        </div>
      )}

      {/* ── Main Game Layout ────────────────────────────────────── */}
      {(phase === 'playing' || phase === 'word-flash') && (
        <main className="game-main">
          <section className="game-chat-panel">
            <ChatFeed
              messages={messages}
              mySocketId={mySocketId}
              rejectionToast={rejectionToast}
              onSendMessage={handleSendMessage}
              myEliminated={myEliminated}
              isMyTurn={isMyTurn}
              iHaveDescribed={iHaveDescribed}
              disabled={phase !== 'playing'}
            />
          </section>

          <section className="game-players-panel">
            <PlayerGrid
              players={players}
              mySocketId={mySocketId}
              myRole={myRole}
              myEliminated={myEliminated}
              myGuessedCorrectly={myGuessedCorrectly}
              totalPlayers={players.length}
              isMyTurn={isMyTurn}
              iHaveDescribed={iHaveDescribed}
              onGuess={handleGuess}
            />
          </section>
        </main>
      )}
    </div>
  );
}
