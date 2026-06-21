'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import type { GameState, Player } from '@/lib/types';
import { useTimer } from '@/hooks/useTimer';
import { Sound } from '@/lib/sounds';
import { RoundTimer } from '@/components/game/RoundTimer';
import { formatMoney } from '@/lib/utils-casino';
import { cn } from '@/lib/utils';

interface RoundTimeoutScreenProps {
  state: GameState;
  self: Player | null;
  isHost: boolean;
  onBailout: (amount: number) => void;
  onAdvance: () => void;
  onLeave: () => void;
}

export function RoundTimeoutScreen({ state, self, isHost, onBailout, onAdvance, onLeave }: RoundTimeoutScreenProps) {
  const [chosen, setChosen] = useState<number | null>(null);
  const timeRemaining = useTimer(state.timeRemaining, state.phase, () => {}, () => {
    if (isHost) onAdvance();
  });

  const winner = state.roundWinnerId ? state.players[state.roundWinnerId] : null;
  const needsBailout = self ? state.bailoutPending.includes(self.id) : false;
  const myChosen = self ? state.bailoutChoices[self.id] : undefined;

  useEffect(() => {
    if (winner) Sound.fanfare();
  }, [winner?.id]);

  const handleBailout = (amount: number) => {
    if (chosen !== null) return;
    setChosen(amount);
    onBailout(amount);
  };

  return (
    <div className="min-h-screen flex flex-col p-4 relative">
      {winner && <Confetti />}

      <header className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-2xl mb-1" style={{ fontWeight: 500, color: 'var(--sf-text)' }}>
            Round {state.currentRound} complete
          </h2>
          <p className="text-xs" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>Next round starts soon</p>
        </div>
        <RoundTimer remaining={timeRemaining} total={state.roundDuration} label="Next round" compact />
        <button
          onClick={onLeave}
          className="text-xs transition-colors"
          style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}
        >
          Leave
        </button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        {winner && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="panel p-6 text-center"
          >
            <div className="text-xs mb-2" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
              Round {state.currentRound} winner
            </div>
            <div className="text-6xl mb-3">{winner.avatar}</div>
            <div className="font-display text-2xl mb-1" style={{ fontWeight: 500, color: 'var(--sf-text)' }}>
              {winner.name}
            </div>
            <div className="font-mono text-lg" style={{ color: 'var(--sf-win)', fontWeight: 400 }}>
              {formatMoney(winner.balance)}
            </div>
            <div className="text-xs mt-2" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
              +10% bonus on all wins next round
            </div>
          </motion.div>
        )}

        <AnimatePresence>
          {needsBailout && !myChosen && chosen === null && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="panel p-5 max-w-md w-full"
              style={{ borderColor: 'var(--sf-lose)' }}
            >
              <div className="text-center mb-4">
                <div className="font-display text-lg mb-1" style={{ fontWeight: 500, color: 'var(--sf-lose)' }}>
                  You're broke
                </div>
                <div className="text-sm" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
                  Take a bailout to keep playing. Both options apply a −10% profit penalty next round.
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleBailout(50)}
                  className="p-4 rounded-md border transition-colors"
                  style={{ backgroundColor: 'var(--sf-bg)', borderColor: 'var(--sf-border)' }}
                >
                  <div className="font-display text-xl" style={{ fontWeight: 500, color: 'var(--sf-text)' }}>€50</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>Smaller penalty</div>
                </button>
                <button
                  onClick={() => handleBailout(80)}
                  className="p-4 rounded-md border transition-colors"
                  style={{ backgroundColor: 'var(--sf-bg)', borderColor: 'var(--sf-border)' }}
                >
                  <div className="font-display text-xl" style={{ fontWeight: 500, color: 'var(--sf-text)' }}>€80</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>More cash, same penalty</div>
                </button>
              </div>
              <div className="text-xs text-center mt-3" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
                Auto-selects €50 in {timeRemaining}s
              </div>
            </motion.div>
          )}
          {needsBailout && (myChosen !== undefined || chosen !== null) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="panel p-4 text-center"
            >
              <div style={{ color: 'var(--sf-win)', fontWeight: 400 }}>
                Bailout: +{formatMoney(myChosen ?? chosen ?? 50)}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
                −10% profit penalty next round
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="panel p-3 max-w-md w-full">
          <div className="text-xs mb-2 text-center" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
            Current standings
          </div>
          <div className="space-y-1">
            {Object.values(state.players)
              .sort((a, b) => b.balance - a.balance)
              .map((p, i) => (
                <div
                  key={p.id}
                  className={cn('flex items-center gap-2 p-1.5 rounded-md')}
                  style={{
                    backgroundColor: p.id === self?.id ? 'var(--sf-border)' : 'var(--sf-bg)',
                  }}
                >
                  <div className="w-4 text-center text-xs" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
                    {i + 1}
                  </div>
                  <div className="text-sm">{p.avatar}</div>
                  <div className="flex-1 text-sm" style={{ color: 'var(--sf-text)', fontWeight: 400 }}>{p.name}</div>
                  <div className="font-mono text-sm" style={{
                    color: p.balance > 100 ? 'var(--sf-win)' : p.balance < 100 ? 'var(--sf-lose)' : 'var(--sf-text-muted)',
                    fontWeight: 400,
                  }}>
                    {formatMoney(p.balance)}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 50 }, () => ({
    id: Math.random(),
    left: Math.random() * 100,
    delay: Math.random() * 3,
    color: ['#B8A898', '#A39485', '#7D756C', '#DDD6CA'][Math.floor(Math.random() * 4)],
    size: 5 + Math.random() * 6,
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
