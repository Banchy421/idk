'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameState, GameMode } from '@/lib/types';
import { Sound } from '@/lib/sounds';
import { PlayerCard } from './PlayerCard';
import { cn } from '@/lib/utils';
import { ThemePicker } from '@/components/theme/ThemePicker';

interface LobbyScreenProps {
  state: GameState;
  self: import('@/lib/types').Player | null;
  isHost: boolean;
  roomCode: string;
  onStart: (mode: GameMode, powersEnabled: boolean) => void;
  onLeave: () => void;
  soloMode?: boolean;
}

export function LobbyScreen({ state, self, isHost, roomCode, onStart, onLeave, soloMode = false }: LobbyScreenProps) {
  const [mode, setMode] = useState<GameMode>('standard');
  const [powersEnabled, setPowersEnabled] = useState(false);
  const [copied, setCopied] = useState(false);

  const playerList = Object.values(state.players).sort((a, b) => a.joinedAt - b.joinedAt);
  const canStart = soloMode || playerList.length >= 2;

  const copyCode = () => {
    navigator.clipboard?.writeText(roomCode).then(() => {
      setCopied(true);
      Sound.click();
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const shareLink = () => {
    const url = `${window.location.origin}/?room=${roomCode}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      Sound.click();
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 py-10 relative">
      <div className="absolute top-5 right-5">
        <ThemePicker />
      </div>

      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h2 className="font-display text-3xl mb-1" style={{ fontWeight: 500, color: 'var(--sf-text)' }}>
          {soloMode ? 'Solo lobby' : 'Room lobby'}
        </h2>
        <p className="text-sm" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
          {soloMode ? 'Pick a mode and start your solo session' : 'Share the code with your friends'}
        </p>
      </motion.div>

      {!soloMode && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="panel p-6 mb-6 w-full max-w-md text-center"
        >
          <p className="text-xs mb-2.5" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>Room code</p>
          <button
            onClick={copyCode}
            className="font-mono text-4xl tracking-[0.25em] transition-opacity hover:opacity-70"
            style={{ color: 'var(--sf-text)', fontWeight: 500 }}
            title="Click to copy"
          >
            {roomCode}
          </button>
          <div className="mt-3.5 flex gap-2 justify-center">
            <button
              onClick={copyCode}
              className="text-xs px-3 py-1.5 rounded-md border transition-colors"
              style={{
                backgroundColor: 'var(--sf-bg)',
                borderColor: 'var(--sf-border)',
                color: 'var(--sf-text-muted)',
                fontWeight: 400,
              }}
            >
              {copied ? 'Copied' : 'Copy code'}
            </button>
            <button
              onClick={shareLink}
              className="text-xs px-3 py-1.5 rounded-md border transition-colors"
              style={{
                backgroundColor: 'var(--sf-bg)',
                borderColor: 'var(--sf-border)',
                color: 'var(--sf-text-muted)',
                fontWeight: 400,
              }}
            >
              Copy invite link
            </button>
          </div>
        </motion.div>
      )}

      {soloMode && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="panel p-6 mb-6 w-full max-w-md text-center"
        >
          <p className="text-sm" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
            You'll play against 2 AI bots. They make random bets.
          </p>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="panel p-5 w-full max-w-md mb-6"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-base" style={{ fontWeight: 500, color: 'var(--sf-text)' }}>Players</h3>
          <span className="text-xs" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>{playerList.length}/10</span>
        </div>
        <div className="space-y-1.5 max-h-72 overflow-y-auto casino-scroll">
          <AnimatePresence>
            {playerList.map((p) => (
              <PlayerCard
                key={p.id}
                player={p}
                isSelf={p.id === self?.id}
                showBalance={false}
              />
            ))}
          </AnimatePresence>
        </div>
      </motion.div>

      {isHost ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="w-full max-w-md"
        >
          <div className="panel p-4 mb-3">
            <p className="text-xs mb-2.5" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>Game mode</p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => { setMode('standard'); Sound.click(); }}
                className={cn('p-3 rounded-md border text-left transition-colors')}
                style={{
                  borderColor: mode === 'standard' ? 'var(--sf-accent)' : 'var(--sf-border)',
                  backgroundColor: mode === 'standard' ? 'var(--sf-border)' : 'var(--sf-bg)',
                }}
              >
                <div style={{ color: 'var(--sf-text)', fontWeight: 500 }}>Standard</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>3 rounds · 60–90s</div>
              </button>
              <button
                onClick={() => { setMode('extended'); Sound.click(); }}
                className={cn('p-3 rounded-md border text-left transition-colors')}
                style={{
                  borderColor: mode === 'extended' ? 'var(--sf-accent)' : 'var(--sf-border)',
                  backgroundColor: mode === 'extended' ? 'var(--sf-border)' : 'var(--sf-bg)',
                }}
              >
                <div style={{ color: 'var(--sf-text)', fontWeight: 500 }}>Extended</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>6 rounds · 120–180s</div>
              </button>
            </div>
          </div>

          {/* Powers toggle */}
          <div className="panel p-3 mb-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm" style={{ color: 'var(--sf-text)', fontWeight: 500 }}>Powers mode</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
                  Each player gets a random power to use once
                </div>
              </div>
              <button
                onClick={() => { setPowersEnabled(!powersEnabled); Sound.click(); }}
                className="relative w-11 h-6 rounded-full transition-colors"
                style={{
                  backgroundColor: powersEnabled ? 'var(--sf-accent)' : 'var(--sf-border)',
                }}
              >
                <div
                  className="absolute top-0.5 w-5 h-5 rounded-full transition-transform"
                  style={{
                    backgroundColor: 'var(--sf-bg)',
                    transform: powersEnabled ? 'translateX(22px)' : 'translateX(2px)',
                  }}
                />
              </button>
            </div>
          </div>

          <button
            onClick={() => { if (canStart) onStart(mode, powersEnabled); else Sound.error(); }}
            disabled={!canStart}
            className={cn(
              'w-full py-3 rounded-md transition-colors',
            )}
            style={{
              backgroundColor: canStart ? 'var(--sf-accent)' : 'var(--sf-border)',
              color: 'var(--sf-text)',
              fontWeight: 400,
              cursor: canStart ? 'pointer' : 'not-allowed',
            }}
          >
            {canStart ? (soloMode ? 'Start solo game' : 'Start game') : 'Waiting for 2+ players...'}
          </button>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="w-full max-w-md text-center"
        >
          <div className="panel p-4 mb-3" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
            Waiting for host to start the game...
          </div>
        </motion.div>
      )}

      <button
        onClick={onLeave}
        className="mt-6 text-sm transition-colors"
        style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}
      >
        ← Leave room
      </button>
    </div>
  );
}
