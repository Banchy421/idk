'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameState, Player } from '@/lib/types';
import { Sound } from '@/lib/sounds';
import { formatMoney } from '@/lib/utils-casino';
import { cn } from '@/lib/utils';

interface ResultsScreenProps {
  state: GameState;
  self: Player | null;
  isHost: boolean;
  onPlayAgain: () => void;
  onLeave: () => void;
}

export function ResultsScreen({ state, self, isHost, onPlayAgain, onLeave }: ResultsScreenProps) {
  const ranked = useMemo(
    () => Object.values(state.players).sort((a, b) => b.balance - a.balance),
    [state.players],
  );
  const revealOrder = useMemo(() => [...ranked].reverse(), [ranked]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [showFinal, setShowFinal] = useState(false);

  useEffect(() => {
    if (revealOrder.length === 0) return;
    setRevealedCount(0);
    setShowFinal(false);

    const timeouts: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < revealOrder.length; i++) {
      const delay = 800 + i * 2000;
      timeouts.push(setTimeout(() => {
        setRevealedCount(i + 1);
        const isLastPlace = i === 0;
        const isWinner = i === revealOrder.length - 1;
        if (isWinner) Sound.fanfareBig();
        else if (isLastPlace) Sound.lose();
        else Sound.reveal();
      }, delay));
    }
    timeouts.push(setTimeout(() => {
      setShowFinal(true);
      Sound.fanfareBig();
    }, 800 + revealOrder.length * 2000));

    return () => timeouts.forEach(clearTimeout);
  }, [revealOrder]);

  const revealedPlayers = revealOrder.slice(0, revealedCount);
  const winner = ranked[0];

  return (
    <div className="min-h-screen flex flex-col p-4 relative overflow-hidden">
      {showFinal && <Confetti />}
      <header className="flex items-center justify-between mb-6">
        <h2 className="font-display text-2xl" style={{ fontWeight: 500, color: 'var(--sf-text)' }}>
          Final results
        </h2>
        <button
          onClick={onLeave}
          className="text-xs transition-colors"
          style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}
        >
          Leave
        </button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center gap-4 max-w-3xl mx-auto w-full">
        {!showFinal ? (
          <div className="w-full space-y-2">
            <AnimatePresence mode="popLayout">
              {revealedPlayers.map((p, idx) => {
                const realRank = ranked.findIndex((rp) => rp.id === p.id);
                const isWinner = realRank === 0;
                const isLastPlace = realRank === ranked.length - 1;
                const isSelf = p.id === self?.id;
                return (
                  <motion.div
                    key={p.id}
                    layout
                    initial={{ opacity: 0, x: -60 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                    className="panel p-4 flex items-center gap-4"
                    style={{
                      borderColor: isWinner ? 'var(--sf-accent)' : 'var(--sf-border)',
                      backgroundColor: isSelf ? 'var(--sf-border)' : 'var(--sf-bg-secondary)',
                    }}
                  >
                    <div className="font-mono text-2xl w-8 text-center" style={{
                      color: isWinner ? 'var(--sf-accent)' : 'var(--sf-text-muted)',
                      fontWeight: 400,
                    }}>
                      {realRank + 1}
                    </div>
                    <div className="text-3xl">{p.avatar}</div>
                    <div className="flex-1">
                      <div className="font-display text-lg" style={{ fontWeight: 500, color: 'var(--sf-text)' }}>
                        {p.name} {isSelf && <span className="text-xs" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>(you)</span>}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
                        {isWinner ? 'Champion' : isLastPlace ? 'Last place' : `Rank ${realRank + 1}`}
                      </div>
                    </div>
                    <div className="font-mono text-xl" style={{
                      color: p.balance > 100 ? 'var(--sf-win)' : p.balance < 100 ? 'var(--sf-lose)' : 'var(--sf-text)',
                      fontWeight: 400,
                    }}>
                      {formatMoney(p.balance)}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {revealedCount < revealOrder.length && (
              <div className="text-center text-sm pt-4" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
                Revealing rank #{ranked.length - revealedCount}...
              </div>
            )}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full text-center"
          >
            <motion.div
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="panel p-8 mb-6"
              style={{ borderColor: 'var(--sf-accent)' }}
            >
              <div className="text-xs mb-2" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
                Champion
              </div>
              <div className="text-7xl mb-3">{winner?.avatar}</div>
              <div className="font-display text-3xl mb-2" style={{ fontWeight: 500, color: 'var(--sf-text)' }}>
                {winner?.name}
              </div>
              <div className="font-mono text-xl" style={{ color: 'var(--sf-win)', fontWeight: 400 }}>
                {formatMoney(winner?.balance ?? 0)}
              </div>
            </motion.div>

            <div className="panel p-3 mb-6 text-left">
              <div className="text-xs mb-2 text-center" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
                Final standings
              </div>
              <div className="space-y-1">
                {ranked.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center gap-3 p-2 rounded-md"
                    style={{
                      backgroundColor: i === 0 ? 'var(--sf-border)' : 'var(--sf-bg)',
                    }}
                  >
                    <div className="w-6 text-center font-mono text-sm" style={{
                      color: 'var(--sf-text-muted)',
                      fontWeight: 400,
                    }}>
                      {i + 1}
                    </div>
                    <div className="text-lg">{p.avatar}</div>
                    <div className="flex-1 text-sm" style={{ color: 'var(--sf-text)', fontWeight: 400 }}>
                      {p.name} {p.id === self?.id && <span className="text-xs" style={{ color: 'var(--sf-text-muted)' }}>(you)</span>}
                    </div>
                    <div className="font-mono text-sm" style={{
                      color: p.balance > 100 ? 'var(--sf-win)' : p.balance < 100 ? 'var(--sf-lose)' : 'var(--sf-text-muted)',
                      fontWeight: 400,
                    }}>
                      {formatMoney(p.balance)}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {isHost ? (
              <button
                onClick={onPlayAgain}
                className="btn-premium px-8 py-3"
              >
                Play again
              </button>
            ) : (
              <div className="text-sm" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
                Waiting for host to start a new game...
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 80 }, () => ({
    id: Math.random(),
    left: Math.random() * 100,
    delay: Math.random() * 4,
    color: ['#B8A898', '#A39485', '#7D756C', '#DDD6CA', '#EFE9E0'][Math.floor(Math.random() * 5)],
    size: 5 + Math.random() * 8,
  })), []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            animationDelay: `${p.delay}s`,
            backgroundColor: p.color,
            width: p.size,
            height: p.size,
            borderRadius: Math.random() > 0.5 ? '50%' : '0',
          }}
        />
      ))}
    </div>
  );
}
