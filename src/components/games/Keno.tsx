'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { kenoDraw, KENO_PAYOUTS } from '@/lib/utils-casino';
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
  const balanceRef = useRef(balance);
  useEffect(() => { balanceRef.current = balance; }, [balance]);

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
    if (balanceRef.current < bet) { Sound.error(); return; }
    if (timeRemaining <= 3) { Sound.error(); return; }
    if (picked.size !== 10) { Sound.error(); return; }
    Sound.bet();
    onBalanceChange(balanceRef.current - bet);
    setPhase('drawing');
    setDrawn([]);
    setMatches(0);
    setWinAmount(0);
    setDrawIndex(0);
    const drawNumber = Math.floor(Math.random() * 1000);
    const allDrawn = kenoDraw((seed ^ Date.now() ^ drawNumber) >>> 0, drawNumber);
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
    const finalId = setTimeout(() => {
      const matchCount = allDrawn.filter((n) => picked.has(n)).length;
      const payout = KENO_PAYOUTS[matchCount] || 0;
      const totalReturn = bet * payout * bonusMultiplier;
      const profit = totalReturn - bet;
      setMatches(matchCount);
      setWinAmount(profit);
      if (totalReturn > 0) {
        onBalanceChange(balanceRef.current + totalReturn);
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
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-2.5">
      <div className="text-center">
        <h2 className="font-display text-xl mb-0.5" style={{ fontWeight: 500, color: 'var(--sf-text)' }}>Keno</h2>
        <p className="text-xs" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>Pick 10 numbers. Match the draw for up to 1000×.</p>
      </div>

      <BetControls balance={balance} bet={bet} setBet={setBet} disabled={phase !== 'idle'} />

      <div className="panel px-3 py-2 flex items-center justify-between text-sm" style={{ fontWeight: 400 }}>
        <span style={{ color: 'var(--sf-text-muted)' }}>
          Picked: <span className="font-mono" style={{ color: picked.size === 10 ? 'var(--sf-win)' : 'var(--sf-text)' }}>{picked.size}/10</span>
        </span>
        {phase === 'drawing' && (
          <span style={{ color: 'var(--sf-text)' }}>Drawing... {drawIndex}/20</span>
        )}
        {phase === 'done' && (
          <span style={{ color: winAmount > 0 ? 'var(--sf-win)' : 'var(--sf-lose)', fontWeight: 500 }}>
            {matches} matches — {winAmount > 0 ? `+${formatMoney(winAmount)}` : `−${formatMoney(bet)}`}
          </span>
        )}
        {phase === 'idle' && picked.size === 10 && (
          <span style={{ color: 'var(--sf-win)' }}>Ready to draw</span>
        )}
      </div>

      <div className="panel p-2">
        <div className="grid grid-cols-10 gap-1">
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
                whileTap={phase === 'idle' ? { scale: 0.9 } : {}}
                animate={match_ ? { scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 0.3 }}
                className="aspect-square rounded font-mono text-xs flex items-center justify-center transition-colors"
                style={{
                  backgroundColor: match_ ? 'var(--sf-accent)' : picked_ ? 'var(--sf-border)' : drawn_ ? 'var(--sf-bg-secondary)' : 'var(--sf-bg)',
                  border: '0.5px solid var(--sf-border)',
                  color: match_ ? 'var(--sf-text)' : picked_ ? 'var(--sf-text)' : drawn_ ? 'var(--sf-lose)' : 'var(--sf-text-muted)',
                  fontWeight: 400,
                }}
              >
                {n}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Compact inline payout table */}
      <div className="flex flex-wrap gap-1 text-[10px] justify-center">
        {[
          { m: '3', p: '0.5×' },
          { m: '4', p: '1×' },
          { m: '5', p: '2×' },
          { m: '6', p: '5×' },
          { m: '7', p: '15×' },
          { m: '8', p: '50×' },
          { m: '9', p: '200×' },
          { m: '10', p: '1000×' },
        ].map((row) => (
          <span key={row.m} className="px-1.5 py-0.5 rounded font-mono" style={{ backgroundColor: 'var(--sf-bg-secondary)', border: '0.5px solid var(--sf-border)', color: 'var(--sf-text-muted)', fontWeight: 400 }}>
            {row.m}: {row.p}
          </span>
        ))}
      </div>

      <button
        onClick={play}
        disabled={balance < bet || phase !== 'idle' || picked.size !== 10 || timeRemaining <= 3}
        className="btn-premium py-2.5"
        style={{
          opacity: (balance < bet || phase !== 'idle' || picked.size !== 10 || timeRemaining <= 3) ? 0.5 : 1,
          cursor: (balance < bet || phase !== 'idle' || picked.size !== 10 || timeRemaining <= 3) ? 'not-allowed' : 'pointer',
        }}
      >
        {phase === 'drawing' ? 'Drawing...' :
         phase === 'done' ? 'Round ended' :
         picked.size !== 10 ? `Pick ${10 - picked.size} more number${10 - picked.size !== 1 ? 's' : ''}` :
         balance >= bet ? `Draw (−${formatMoney(bet)})` : 'Not enough balance'}
      </button>
    </div>
  );
}
