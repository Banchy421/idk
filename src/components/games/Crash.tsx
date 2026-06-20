'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { crashPointsForRound } from '@/lib/utils-casino';
import { Sound } from '@/lib/sounds';
import { formatMoney } from '@/lib/utils-casino';
import { BetControls } from './BetControls';
import { cn } from '@/lib/utils';

interface CrashProps {
  balance: number;
  onBalanceChange: (n: number) => void;
  bonusMultiplier: number;
  bailoutPenalty: boolean;
  timeRemaining: number;
  seed: number;
}

type Phase = 'idle' | 'running' | 'crashed' | 'cashed';

export function Crash({ balance, onBalanceChange, bonusMultiplier, timeRemaining, seed }: CrashProps) {
  const [bet, setBet] = useState(10);
  const [phase, setPhase] = useState<Phase>('idle');
  const [multiplier, setMultiplier] = useState(1.0);
  const [crashPoint, setCrashPoint] = useState(0);
  const [crashIndex, setCrashIndex] = useState(0);
  const [cashedAt, setCashedAt] = useState(0);
  const [winAmount, setWinAmount] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  const startTimeRef = useRef(0);
  const rafRef = useRef<number>(0);
  const phaseRef = useRef<Phase>('idle');
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  const cashedRef = useRef(false);

  // Pre-computed crash points for the round
  const crashPoints = useRef<number[]>(crashPointsForRound(seed, 10));

  const startRound = () => {
    if (balance < bet) { Sound.error(); return; }
    if (timeRemaining <= 3) { Sound.error(); return; }
    Sound.bet();
    onBalanceChange(balance - bet);
    const idx = crashIndex % crashPoints.current.length;
    const point = crashPoints.current[idx];
    setCrashPoint(point);
    setCrashIndex(idx + 1);
    setMultiplier(1.0);
    setCashedAt(0);
    setWinAmount(0);
    cashedRef.current = false;
    setPhase('running');
    startTimeRef.current = performance.now();
    Sound.reelSpin();
  };

  useEffect(() => {
    if (phase !== 'running') return;
    const tick = () => {
      const elapsed = (performance.now() - startTimeRef.current) / 1000;
      // Multiplier grows exponentially: m = e^(k*t)
      const k = 0.18;
      const m = Math.pow(Math.E, k * elapsed);
      if (m >= crashPoint) {
        // Crash!
        setMultiplier(crashPoint);
        setPhase('crashed');
        Sound.crashBoom();
        setHistory((h) => [crashPoint, ...h].slice(0, 8));
        setTimeout(() => setPhase('idle'), 2500);
        return;
      }
      setMultiplier(m);
      // Periodic tick sound based on growth
      if (Math.floor(m * 10) % 5 === 0) {
        // small tick
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, crashPoint]);

  const cashOut = () => {
    if (phase !== 'running' || cashedRef.current) return;
    cashedRef.current = true;
    const win = bet * multiplier * bonusMultiplier;
    setCashedAt(multiplier);
    setWinAmount(win);
    onBalanceChange(balance + win);
    Sound.cashRegister();
    if (multiplier >= 3) Sound.winBig();
    else Sound.winSmall();
    setPhase('cashed');
    setHistory((h) => [multiplier, ...h].slice(0, 8));
    setTimeout(() => setPhase('idle'), 2500);
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4">
      <div className="text-center">
        <h2 className="font-display text-3xl text-gold mb-1">🚀 Crash</h2>
        <p className="text-xs text-muted-foreground">Cash out before the rocket crashes.</p>
      </div>

      <BetControls balance={balance} bet={bet} setBet={setBet} disabled={phase === 'running'} />

      {/* History */}
      {history.length > 0 && (
        <div className="panel p-2 flex gap-1.5 overflow-x-auto casino-scroll">
          {history.map((h, i) => (
            <span
              key={i}
              className={cn(
                'text-xs px-2 py-1 rounded font-mono flex-shrink-0',
                h >= 2 ? 'bg-win bg-opacity-20 text-win' : 'bg-lose bg-opacity-20 text-lose',
              )}
            >
              {h.toFixed(2)}×
            </span>
          ))}
        </div>
      )}

      {/* Graph */}
      <div className={cn(
        'panel p-6 h-64 flex items-center justify-center relative overflow-hidden',
        phase === 'crashed' && 'flash-lose',
        phase === 'cashed' && 'flash-win',
      )}>
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="crashGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(201, 168, 76, 0.4)" />
              <stop offset="100%" stopColor="rgba(201, 168, 76, 0)" />
            </linearGradient>
          </defs>
          {phase === 'running' || phase === 'cashed' ? (
            <>
              <motion.path
                d={`M 0 100 Q ${50} ${100 - Math.min(95, (multiplier - 1) * 30)}, ${Math.min(95, (multiplier - 1) * 50)} ${100 - Math.min(95, (multiplier - 1) * 30)}`}
                stroke={phase === 'cashed' ? '#38A169' : '#C9A84C'}
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              />
              <motion.path
                d={`M 0 100 Q ${50} ${100 - Math.min(95, (multiplier - 1) * 30)}, ${Math.min(95, (multiplier - 1) * 50)} ${100 - Math.min(95, (multiplier - 1) * 30)} L ${Math.min(95, (multiplier - 1) * 50)} 100 Z`}
                fill="url(#crashGradient)"
              />
            </>
          ) : null}
          {phase === 'crashed' && (
            <text x="50" y="50" textAnchor="middle" fill="#E53E3E" fontSize="14" fontWeight="bold">
              💥 CRASHED @ {crashPoint.toFixed(2)}×
            </text>
          )}
        </svg>

        <div className="relative z-10 text-center">
          <motion.div
            animate={
              phase === 'running'
                ? { scale: [1, 1.05, 1] }
                : phase === 'crashed'
                  ? { scale: [1, 1.3, 1] }
                  : {}
            }
            transition={{ duration: 0.5, repeat: phase === 'running' ? Infinity : 0 }}
            className={cn(
              'font-display font-bold',
              phase === 'crashed' ? 'text-lose text-5xl' : 'text-gold text-7xl',
              phase === 'cashed' && 'text-win text-7xl',
            )}
          >
            {multiplier.toFixed(2)}×
          </motion.div>
          {phase === 'idle' && (
            <div className="text-muted-foreground text-sm mt-2">Place a bet to launch</div>
          )}
          {phase === 'cashed' && (
            <div className="text-win text-2xl mt-2 font-bold">+{formatMoney(winAmount - bet)}</div>
          )}
        </div>
      </div>

      <button
        onClick={phase === 'running' ? cashOut : startRound}
        disabled={
          (phase === 'idle' && (balance < bet || timeRemaining <= 3)) ||
          (phase === 'cashed' || phase === 'crashed')
        }
        onMouseEnter={() => Sound.hover()}
        className={cn(
          'py-3 rounded-md font-bold transition-all',
          phase === 'running'
            ? 'bg-win hover:bg-green-700 text-white glow-win'
            : phase === 'idle' && balance >= bet && timeRemaining > 3
              ? 'bg-gold hover:bg-gold-dark text-black glow-gold'
              : 'bg-[#2a2a2a] text-muted-foreground cursor-not-allowed',
        )}
      >
        {phase === 'running'
          ? `CASH OUT (${formatMoney(bet * multiplier * bonusMultiplier)})`
          : phase === 'cashed' || phase === 'crashed'
            ? '...'
            : balance >= bet ? `Launch (−${formatMoney(bet)})` : 'Not enough balance'
        }
      </button>
    </div>
  );
}
