'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import type { GameState, Player, GameName } from '@/lib/types';
import { GAME_META } from '@/lib/games-meta';
import { Sound } from '@/lib/sounds';
import { cn } from '@/lib/utils';

interface FinalCoinflipScreenProps {
  state: GameState;
  self: Player | null;
  isHost: boolean;
  onResolve: () => void;
  onLeave: () => void;
}

export function FinalCoinflipScreen({ state, self, isHost, onResolve, onLeave }: FinalCoinflipScreenProps) {
  const [flipping, setFlipping] = useState(true);
  const [landed, setLanded] = useState(false);
  const resolvedRef = useRef(false);

  const winner = state.coinflipResult;
  const loser = state.finalVoteOptions.find((g) => g !== winner);
  const winnerMeta = winner ? GAME_META[winner] : null;
  const loserMeta = loser ? GAME_META[loser] : null;

  useEffect(() => {
    Sound.coinSpin();
  }, []);

  useEffect(() => {
    const landTimer = setTimeout(() => {
      setFlipping(false);
      setLanded(true);
      Sound.coinLand();
    }, 3000);

    const resolveTimer = setTimeout(() => {
      if (!resolvedRef.current && isHost) {
        resolvedRef.current = true;
        onResolve();
      }
    }, 4500);

    return () => {
      clearTimeout(landTimer);
      clearTimeout(resolveTimer);
    };
  }, [isHost, onResolve]);

  if (!winner || !winnerMeta || !loserMeta) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
          Resolving coinflip...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col p-4">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-2xl mb-1" style={{ fontWeight: 500, color: 'var(--sf-text)' }}>
            Tie-breaker coinflip
          </h2>
          <p className="text-xs" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
            50/50 vote — let the coin decide
          </p>
        </div>
        <button
          onClick={onLeave}
          className="text-xs transition-colors"
          style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}
        >
          Leave
        </button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center gap-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          {flipping ? (
            <p className="text-base" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
              The vote is tied. Flipping the coin...
            </p>
          ) : (
            <motion.p
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-xl"
              style={{ color: 'var(--sf-text)', fontWeight: 500 }}
            >
              The coin has decided
            </motion.p>
          )}
        </motion.div>

        <div style={{ perspective: '1200px' }}>
          <motion.div
            animate={flipping ? { rotateY: 360 * 12 } : { rotateY: winner === state.finalVoteOptions[0] ? 0 : 180 }}
            transition={{ duration: flipping ? 3 : 0.5, ease: flipping ? 'easeOut' : 'easeInOut' }}
            className="coin-3d"
            style={{ width: '180px', height: '180px' }}
          >
            <div
              className="coin-face"
              style={{
                backgroundColor: 'var(--sf-bg-secondary)',
                border: '0.5px solid var(--sf-border)',
                flexDirection: 'column',
              }}
            >
              <div className="text-5xl">{GAME_META[state.finalVoteOptions[0]].icon}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--sf-text)', fontWeight: 400 }}>
                {GAME_META[state.finalVoteOptions[0]].label}
              </div>
            </div>
            <div
              className="coin-face back"
              style={{
                backgroundColor: 'var(--sf-bg-secondary)',
                border: '0.5px solid var(--sf-border)',
                flexDirection: 'column',
              }}
            >
              <div className="text-5xl">{GAME_META[state.finalVoteOptions[1]].icon}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--sf-text)', fontWeight: 400 }}>
                {GAME_META[state.finalVoteOptions[1]].label}
              </div>
            </div>
          </motion.div>
        </div>

        <div className="flex gap-6 items-center">
          <div className="text-center">
            <div className="text-3xl mb-1">{GAME_META[state.finalVoteOptions[0]].icon}</div>
            <div className="text-xs" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
              {GAME_META[state.finalVoteOptions[0]].label}
            </div>
          </div>
          <div className="text-sm" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>vs</div>
          <div className="text-center">
            <div className="text-3xl mb-1">{GAME_META[state.finalVoteOptions[1]].icon}</div>
            <div className="text-xs" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
              {GAME_META[state.finalVoteOptions[1]].label}
            </div>
          </div>
        </div>

        {landed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="panel p-6 text-center"
            style={{ borderColor: 'var(--sf-accent)' }}
          >
            <div className="text-xs mb-2" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
              Final round game
            </div>
            <div className="text-6xl mb-2">{winnerMeta.icon}</div>
            <div className="font-display text-2xl mb-1" style={{ fontWeight: 500, color: 'var(--sf-text)' }}>
              {winnerMeta.label}
            </div>
            <div className="text-sm" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
              {winnerMeta.description}
            </div>
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="text-xs mt-3"
              style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}
            >
              Starting round...
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
