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

  // Show confetti for winner
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
      {/* Confetti */}
      {winner && <Confetti />}

      <header className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display text-2xl text-gold">Round {state.currentRound} Complete</h2>
          <p className="text-xs text-muted-foreground">Next round starts soon</p>
        </div>
        <RoundTimer remaining={timeRemaining} total={state.roundDuration} label="Next Round" compact />
        <button onClick={onLeave} className="text-xs text-muted-foreground hover:text-lose">Leave</button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        {/* Winner announcement */}
        {winner && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: -50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring' }}
            className="panel p-6 text-center pulse-gold"
          >
            <div className="text-xs text-muted-foreground uppercase tracking-widest mb-2">
              🏆 Round {state.currentRound} Winner
            </div>
            <div className="text-7xl mb-3">{winner.avatar}</div>
            <div className="font-display text-3xl text-gold mb-1">{winner.name}</div>
            <div className="font-mono text-xl text-win">{formatMoney(winner.balance)}</div>
            <div className="text-xs text-muted-foreground mt-2">
              +10% bonus on all wins next round
            </div>
          </motion.div>
        )}

        {/* Bailout offer */}
        <AnimatePresence>
          {needsBailout && !myChosen && chosen === null && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="panel p-5 max-w-md w-full border-2 border-lose"
            >
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">💸</div>
                <div className="font-display text-xl text-lose mb-1">You're broke!</div>
                <div className="text-sm text-muted-foreground">
                  Take a bailout to keep playing. Both options apply a −10% profit penalty next round.
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleBailout(50)}
                  onMouseEnter={() => Sound.hover()}
                  className="p-4 rounded-md bg-[#0a0a0a] border-2 border-[#2a2a2a] hover:border-gold transition-all"
                >
                  <div className="font-display text-2xl text-gold">€50</div>
                  <div className="text-xs text-muted-foreground mt-1">Smaller penalty</div>
                </button>
                <button
                  onClick={() => handleBailout(80)}
                  onMouseEnter={() => Sound.hover()}
                  className="p-4 rounded-md bg-[#0a0a0a] border-2 border-[#2a2a2a] hover:border-gold transition-all"
                >
                  <div className="font-display text-2xl text-gold">€80</div>
                  <div className="text-xs text-muted-foreground mt-1">More cash, same penalty</div>
                </button>
              </div>
              <div className="text-xs text-muted-foreground text-center mt-3">
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
              <div className="text-win font-bold text-lg">
                ✓ Bailout: +{formatMoney(myChosen ?? chosen ?? 50)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                −10% profit penalty next round
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mini leaderboard */}
        <div className="panel p-3 max-w-md w-full">
          <div className="text-xs text-muted-foreground uppercase tracking-widest mb-2 text-center">
            Current Standings
          </div>
          <div className="space-y-1.5">
            {Object.values(state.players)
              .sort((a, b) => b.balance - a.balance)
              .map((p, i) => (
                <div
                  key={p.id}
                  className={cn(
                    'flex items-center gap-2 p-2 rounded-md bg-[#0a0a0a]',
                    p.id === self?.id && 'border border-gold',
                  )}
                >
                  <div className={cn(
                    'w-6 text-center font-display font-bold text-sm',
                    i === 0 ? 'text-gold' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-muted-foreground',
                  )}>
                    {i + 1}
                  </div>
                  <div className="text-base">{p.avatar}</div>
                  <div className="flex-1 text-sm truncate">{p.name}</div>
                  <div className={cn(
                    'font-mono text-sm',
                    p.balance > 100 ? 'text-win' : p.balance < 100 ? 'text-lose' : 'text-muted-foreground',
                  )}>
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
  const pieces = useMemo(() => Array.from({ length: 60 }, () => ({
    id: Math.random(),
    left: Math.random() * 100,
    delay: Math.random() * 3,
    color: ['#C9A84C', '#E53E3E', '#38A169', '#fff'][Math.floor(Math.random() * 4)],
    size: 6 + Math.random() * 8,
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
