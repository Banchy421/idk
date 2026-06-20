'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameState, GameMode, Player } from '@/lib/types';
import { Sound } from '@/lib/sounds';
import { PlayerCard } from './PlayerCard';
import { cn } from '@/lib/utils';

interface LobbyScreenProps {
  state: GameState;
  self: Player | null;
  isHost: boolean;
  roomCode: string;
  onStart: (mode: GameMode) => void;
  onLeave: () => void;
  soloMode?: boolean;
}

export function LobbyScreen({ state, self, isHost, roomCode, onStart, onLeave, soloMode = false }: LobbyScreenProps) {
  const [mode, setMode] = useState<GameMode>('standard');
  const [copied, setCopied] = useState(false);

  const playerList = Object.values(state.players).sort((a, b) => a.joinedAt - b.joinedAt);
  const canStart = soloMode || playerList.length >= 2;

  const copyCode = () => {
    navigator.clipboard?.writeText(roomCode).then(() => {
      setCopied(true);
      Sound.cashRegister();
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const shareLink = () => {
    const url = `${window.location.origin}/?room=${roomCode}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      Sound.cashRegister();
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-6"
      >
        <h2 className="font-display text-3xl md:text-4xl font-bold text-gold mb-1">
          {soloMode ? 'Solo Lobby' : 'Room Lobby'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {soloMode ? 'Pick a mode and start your solo session' : 'Share the code with your friends'}
        </p>
      </motion.div>

      {!soloMode && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="panel p-6 mb-6 w-full max-w-md text-center pulse-gold"
        >
          <p className="text-xs text-muted-foreground mb-2 uppercase tracking-widest">Room Code</p>
          <button
            onClick={copyCode}
            className="font-mono text-5xl md:text-6xl font-bold tracking-[0.3em] text-gold hover:scale-105 transition-transform"
            title="Click to copy"
          >
            {roomCode}
          </button>
          <div className="mt-3 flex gap-2 justify-center">
            <button
              onClick={copyCode}
              onMouseEnter={() => Sound.hover()}
              className="text-xs px-3 py-1.5 bg-[#0a0a0a] border border-[#2a2a2a] hover:border-gold rounded text-muted-foreground hover:text-white transition-all"
            >
              {copied ? '✓ Copied!' : 'Copy Code'}
            </button>
            <button
              onClick={shareLink}
              onMouseEnter={() => Sound.hover()}
              className="text-xs px-3 py-1.5 bg-[#0a0a0a] border border-[#2a2a2a] hover:border-gold rounded text-muted-foreground hover:text-white transition-all"
            >
              Copy Invite Link
            </button>
          </div>
        </motion.div>
      )}

      {soloMode && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="panel p-6 mb-6 w-full max-w-md text-center"
        >
          <div className="text-5xl mb-2">🤖</div>
          <p className="text-sm text-muted-foreground">
            You'll play against 2 AI bots. They make random bets.
          </p>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="panel p-5 w-full max-w-md mb-6"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-lg text-gold">Players</h3>
          <span className="text-sm text-muted-foreground">{playerList.length}/10</span>
        </div>
        <div className="space-y-2 max-h-72 overflow-y-auto casino-scroll">
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
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="w-full max-w-md"
        >
          <div className="panel p-4 mb-3">
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-widest">Game Mode</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { setMode('standard'); Sound.click(); }}
                onMouseEnter={() => Sound.hover()}
                className={cn(
                  'p-3 rounded-md border text-left transition-all',
                  mode === 'standard' ? 'border-gold bg-gold bg-opacity-10' : 'border-[#2a2a2a] hover:border-gold'
                )}
              >
                <div className="font-bold text-gold">Standard</div>
                <div className="text-xs text-muted-foreground mt-0.5">3 rounds · 60–90s</div>
              </button>
              <button
                onClick={() => { setMode('extended'); Sound.click(); }}
                onMouseEnter={() => Sound.hover()}
                className={cn(
                  'p-3 rounded-md border text-left transition-all',
                  mode === 'extended' ? 'border-gold bg-gold bg-opacity-10' : 'border-[#2a2a2a] hover:border-gold'
                )}
              >
                <div className="font-bold text-gold">Extended</div>
                <div className="text-xs text-muted-foreground mt-0.5">6 rounds · 120–180s</div>
              </button>
            </div>
          </div>

          <button
            onClick={() => { if (canStart) onStart(mode); else Sound.error(); }}
            disabled={!canStart}
            onMouseEnter={() => canStart && Sound.hover()}
            className={cn(
              'w-full py-3.5 rounded-md font-bold transition-all',
              canStart
                ? 'bg-gold hover:bg-gold-dark text-black glow-gold-strong'
                : 'bg-[#2a2a2a] text-muted-foreground cursor-not-allowed'
            )}
          >
            {canStart ? (soloMode ? 'Start Solo Game' : 'Start Game') : 'Waiting for 2+ players...'}
          </button>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="w-full max-w-md text-center"
        >
          <div className="panel p-4 mb-3 text-muted-foreground">
            Waiting for host to start the game...
          </div>
        </motion.div>
      )}

      <button
        onClick={onLeave}
        onMouseEnter={() => Sound.hover()}
        className="mt-6 text-sm text-muted-foreground hover:text-lose transition-colors"
      >
        ← Leave Room
      </button>
    </div>
  );
}
