'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { kenoDraw, KENO_PAYOUTS, mulberry32 } from '@/lib/utils-casino';
import { Sound } from '@/lib/sounds';
import { formatMoney } from '@/lib/utils-casino';
import { BetControls } from './BetControls';
import { cn } from '@/lib/utils';

interface KenoProps {
  balance: number;
  onBalanceChange: (n: number) => void;
  bonusMultiplier: number;
  bailoutPenalty: boolean;
  timeRemaining: number;
  seed: number;
}

type Phase = 'idle' | 'drawing' | 'done';

export function Keno({ balance, onBalanceChange, bonusMultiplier, timeRemaining, seed }: KenoProps) {
  const [bet, setBet] = useState(10);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [drawn, setDrawn] = useState<number[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [matches, setMatches] = useState<number>(0);
  const [winAmount, setWinAmount] = useState(0);
  const [drawIndex, setDrawIndex] = useState(0);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => {
    timeoutsRef.current.forEach(clearTimeout);
  }, []);

  const togglePick = (n: number) => {
    if (phase !== 'idle') return;
    Sound.hover();
    const next = new Set(picked);
    if (next.has(n)) {
      next.delete(n);
    } else {
      if (next.size >= 10) return;
      next.add(n);
    }
    setPicked(next);
  };

  const play = async () => {
    if (balance < bet) { Sound.error(); return; }
    if (timeRemaining <= 3) { Sound.error(); return; }
    if (picked.size !== 10) { Sound.error(); return; }

    Sound.bet();
    onBalanceChange(balance - bet);
    setPhase('drawing');
    setDrawn([]);
    setMatches(0);
    setWinAmount(0);
    setDrawIndex(0);

    const drawNumber = Math.floor(Math.random() * 1000);
    const allDrawn = kenoDraw((seed ^ Date.now() ^ drawNumber) >>> 0, drawNumber);
    // Reveal one at a time
    for (let i = 0; i < allDrawn.length; i++) {
      const id = setTimeout(() => {
        setDrawIndex(i + 1);
        setDrawn((prev) => [...prev, allDrawn[i]]);
        if (picked.has(allDrawn[i])) {
          Sound.winSmall();
          setMatches((m) => m + 1);
        } else {
          Sound.tick();
        }
      }, i * 300);
      timeoutsRef.current.push(id);
    }

    // After all drawn, compute win
    const finalId = setTimeout(() => {
      const matchCount = allDrawn.filter((n) => picked.has(n)).length;
      const payout = KENO_PAYOUTS[matchCount] || 0;
      const win = bet * payout * bonusMultiplier;
      setMatches(matchCount);
      setWinAmount(win);
      if (win > 0) {
        onBalanceChange(balance + win);
        if (payout >= 50) Sound.winBig();
        else Sound.cashRegister();
      } else {
        Sound.lose();
      }
      setPhase('done');
      setTimeout(() => setPhase('idle'), 3500);
    }, allDrawn.length * 300 + 400);
    timeoutsRef.current.push(finalId);
  };

  const isDrawn = (n: number) => drawn.includes(n);
  const isPicked = (n: number) => picked.has(n);
  const isMatch = (n: number) => isDrawn(n) && isPicked(n);

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-4">
      <div className="text-center">
        <h2 className="font-display text-3xl text-gold mb-1">🔢 Keno</h2>
        <p className="text-xs text-muted-foreground">Pick 10 numbers. Match the draw for up to 1000×.</p>
      </div>

      <BetControls balance={balance} bet={bet} setBet={setBet} disabled={phase !== 'idle'} />

      {/* Status */}
      <div className="panel p-3 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Picked: <span className={cn('font-mono', picked.size === 10 ? 'text-win' : 'text-gold')}>{picked.size}/10</span>
        </span>
        {phase === 'drawing' && (
          <span className="text-gold">Drawing... {drawIndex}/20</span>
        )}
        {phase === 'done' && (
          <span className={cn('font-bold', winAmount > 0 ? 'text-win' : 'text-lose')}>
            {matches} matches — {winAmount > 0 ? `+${formatMoney(winAmount - bet)}` : `−${formatMoney(bet)}`}
          </span>
        )}
        {phase === 'idle' && picked.size === 10 && (
          <span className="text-win">Ready to draw!</span>
        )}
      </div>

      {/* Number grid */}
      <div className="panel p-3">
        <div className="grid grid-cols-8 gap-1.5">
          {Array.from({ length: 40 }, (_, i) => i + 1).map((n) => {
            const picked_ = isPicked(n);
            const drawn_ = isDrawn(n);
            const match_ = isMatch(n);
            return (
              <motion.button
                key={n}
                layout
                onClick={() => togglePick(n)}
                disabled={phase !== 'idle'}
                whileHover={phase === 'idle' ? { scale: 1.1 } : {}}
                whileTap={phase === 'idle' ? { scale: 0.95 } : {}}
                animate={match_ ? { scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 0.3 }}
                className={cn(
                  'aspect-square rounded-md font-mono text-sm font-bold flex items-center justify-center border-2 transition-all',
                  match_ && 'bg-gold border-gold text-black glow-gold',
                  picked_ && !drawn_ && 'bg-gold bg-opacity-20 border-gold text-gold',
                  drawn_ && !picked_ && 'bg-lose bg-opacity-20 border-lose text-lose',
                  !picked_ && !drawn_ && 'bg-[#0a0a0a] border-[#2a2a2a] text-muted-foreground hover:border-gold hover:text-white',
                )}
              >
                {n}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Paytable */}
      <div className="panel p-3">
        <div className="text-xs text-muted-foreground uppercase tracking-widest mb-2 text-center">Payout Table (×bet)</div>
        <div className="grid grid-cols-5 gap-1 text-xs">
          {[
            { m: '0–2', p: '0×' },
            { m: '3', p: '0.5×' },
            { m: '4', p: '1×' },
            { m: '5', p: '2×' },
            { m: '6', p: '5×' },
            { m: '7', p: '15×' },
            { m: '8', p: '50×' },
            { m: '9', p: '200×' },
            { m: '10', p: '1000×' },
          ].map((row) => (
            <div key={row.m} className="text-center p-1.5 bg-[#0a0a0a] rounded">
              <div className="text-muted-foreground">{row.m}</div>
              <div className="text-gold font-mono font-bold">{row.p}</div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={play}
        disabled={balance < bet || phase !== 'idle' || picked.size !== 10 || timeRemaining <= 3}
        onMouseEnter={() => Sound.hover()}
        className={cn(
          'py-3 rounded-md font-bold transition-all',
          balance >= bet && phase === 'idle' && picked.size === 10 && timeRemaining > 3
            ? 'bg-gold hover:bg-gold-dark text-black glow-gold'
            : 'bg-[#2a2a2a] text-muted-foreground cursor-not-allowed',
        )}
      >
        {phase === 'drawing' ? 'Drawing...' :
         phase === 'done' ? 'Round ended' :
         picked.size !== 10 ? `Pick ${10 - picked.size} more number${10 - picked.size !== 1 ? 's' : ''}` :
         balance >= bet ? `Draw (−${formatMoney(bet)})` : 'Not enough balance'}
      </button>
    </div>
  );
}
