'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SLOTS_SYMBOLS, slotsPayout } from '@/lib/utils-casino';
import { Sound } from '@/lib/sounds';
import { formatMoney } from '@/lib/utils-casino';
import { BetControls } from './BetControls';
import { cn } from '@/lib/utils';

interface SlotsProps {
  balance: number;
  onBalanceChange: (n: number) => void;
  bonusMultiplier: number;
  bailoutPenalty: boolean;
  timeRemaining: number;
  seed: number;
}

type SpinState = 'idle' | 'spinning' | 'evaluating' | 'won' | 'lost';

export function Slots({ balance, onBalanceChange, bonusMultiplier, timeRemaining }: SlotsProps) {
  const [bet, setBet] = useState(10);
  const [reels, setReels] = useState<string[]>(['🍒', '🍋', '🍊']);
  const [reelStates, setReelStates] = useState<('idle' | 'spinning' | 'stopped')[]>(['idle', 'idle', 'idle']);
  const [spinState, setSpinState] = useState<SpinState>('idle');
  const [lastWin, setLastWin] = useState(0);
  const [lastPayout, setLastPayout] = useState(0);
  const spinIntervals = useRef<ReturnType<typeof setInterval>[]>([]);

  const stopAllIntervals = () => {
    spinIntervals.current.forEach(clearInterval);
    spinIntervals.current = [];
  };

  useEffect(() => () => stopAllIntervals(), []);

  const spin = async () => {
    if (balance < bet) { Sound.error(); return; }
    if (timeRemaining <= 3) { Sound.error(); return; }
    if (spinState === 'spinning') return;

    // Clear any leftover intervals from a previous spin (safety net)
    stopAllIntervals();

    Sound.bet();
    onBalanceChange(balance - bet);
    setSpinState('spinning');
    setReelStates(['spinning', 'spinning', 'spinning']);
    setLastWin(0);
    setLastPayout(0);
    Sound.reelSpin();

    // Pre-determine final symbols
    const final = [
      SLOTS_SYMBOLS[Math.floor(Math.random() * SLOTS_SYMBOLS.length)],
      SLOTS_SYMBOLS[Math.floor(Math.random() * SLOTS_SYMBOLS.length)],
      SLOTS_SYMBOLS[Math.floor(Math.random() * SLOTS_SYMBOLS.length)],
    ];

    // Start spinning animation for each reel — use a FRESH array so we don't
    // accumulate stale interval IDs across multiple spins.
    const intervals: ReturnType<typeof setInterval>[] = [];
    for (let i = 0; i < 3; i++) {
      const id = setInterval(() => {
        setReels((prev) => {
          const next = [...prev];
          next[i] = SLOTS_SYMBOLS[Math.floor(Math.random() * SLOTS_SYMBOLS.length)];
          return next;
        });
      }, 80);
      intervals.push(id);
    }
    spinIntervals.current = intervals;

    // Stop reels one by one with 1s delay (as per spec)
    for (let i = 0; i < 3; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      clearInterval(intervals[i]);
      setReels((prev) => {
        const next = [...prev];
        next[i] = final[i];
        return next;
      });
      setReelStates((prev) => {
        const next = [...prev];
        next[i] = 'stopped';
        return next;
      });
      Sound.reelStop();
    }

    // Evaluate
    setSpinState('evaluating');
    const payout = slotsPayout(final);
    const win = bet * payout * bonusMultiplier;
    await new Promise((r) => setTimeout(r, 400));
    setLastPayout(payout);
    setLastWin(win);
    if (payout > 0) {
      onBalanceChange(balance + win);
      if (payout >= 5) Sound.winBig();
      else Sound.winSmall();
      setSpinState('won');
    } else {
      Sound.lose();
      setSpinState('lost');
    }

    setTimeout(() => setSpinState('idle'), 1800);
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4">
      <div className="text-center">
        <h2 className="font-display text-3xl text-gold mb-1">🎰 Slots</h2>
        <p className="text-xs text-muted-foreground">Spin 3 reels. Match symbols for up to 10×.</p>
      </div>

      <BetControls balance={balance} bet={bet} setBet={setBet} disabled={spinState === 'spinning'} />

      {/* Reels */}
      <div className="panel p-5">
        <div className="flex justify-center gap-3 mb-3">
          {reels.map((sym, i) => (
            <motion.div
              key={i}
              animate={
                reelStates[i] === 'spinning'
                  ? { y: [0, -10, 0, 10, 0] }
                  : { scale: reelStates[i] === 'stopped' ? [1.2, 1] : 1 }
              }
              transition={
                reelStates[i] === 'spinning'
                  ? { duration: 0.15, repeat: Infinity }
                  : { duration: 0.3, type: 'spring' }
              }
              className={cn(
                'w-24 h-32 md:w-28 md:h-36 rounded-md flex items-center justify-center text-6xl border-2',
                reelStates[i] === 'spinning' && 'bg-[#0a0a0a] border-[#2a2a2a] blur-[1px]',
                reelStates[i] === 'stopped' && 'bg-gold bg-opacity-10 border-gold glow-gold',
                reelStates[i] === 'idle' && 'bg-[#0a0a0a] border-[#2a2a2a]',
              )}
            >
              {sym}
            </motion.div>
          ))}
        </div>

        {/* Paytable hint */}
        <div className="text-center text-xs text-muted-foreground grid grid-cols-3 gap-1">
          <span>7️⃣7️⃣7️⃣ = 10×</span>
          <span>💎💎💎 = 7×</span>
          <span>⭐⭐⭐ = 5×</span>
          <span>🍊🍊🍊 = 3×</span>
          <span>🍋🍋🍋 = 2×</span>
          <span>🍒🍒🍒 = 1.5×</span>
        </div>
      </div>

      <AnimatePresence>
        {lastPayout > 0 && spinState === 'won' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              'text-center font-display text-3xl font-bold py-3 rounded',
              lastPayout >= 5 ? 'text-gold flash-gold' : 'text-win',
            )}
          >
            {lastPayout}× — +{formatMoney(lastWin - bet)}
          </motion.div>
        )}
        {spinState === 'lost' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center text-lose font-display text-2xl py-2"
          >
            No match. Try again!
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={spin}
        disabled={balance < bet || spinState === 'spinning' || timeRemaining <= 3}
        onMouseEnter={() => Sound.hover()}
        className={cn(
          'py-3 rounded-md font-bold transition-all',
          balance >= bet && spinState !== 'spinning' && timeRemaining > 3
            ? 'bg-gold hover:bg-gold-dark text-black glow-gold'
            : 'bg-[#2a2a2a] text-muted-foreground cursor-not-allowed',
        )}
      >
        {spinState === 'spinning' ? 'Spinning...' : balance >= bet ? `Spin (−${formatMoney(bet)})` : 'Not enough balance'}
      </button>
    </div>
  );
}
