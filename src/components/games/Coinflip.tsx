'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CoinSide } from '@/lib/utils-casino';
import { Sound } from '@/lib/sounds';
import { formatMoney } from '@/lib/utils-casino';
import { BetControls } from './BetControls';
import { cn } from '@/lib/utils';

interface CoinflipProps {
  balance: number;
  onBalanceChange: (n: number) => void;
  bonusMultiplier: number;
  bailoutPenalty: boolean;
  timeRemaining: number;
  seed: number;
}

type Phase = 'idle' | 'flipping' | 'won' | 'lost';

export function Coinflip({ balance, onBalanceChange, bonusMultiplier, timeRemaining }: CoinflipProps) {
  const [bet, setBet] = useState(10);
  const [side, setSide] = useState<CoinSide>('heads');
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<CoinSide | null>(null);
  const [flips, setFlips] = useState(0);
  const [winAmount, setWinAmount] = useState(0);

  const flip = () => {
    if (balance < bet) { Sound.error(); return; }
    if (timeRemaining <= 3) { Sound.error(); return; }
    if (phase === 'flipping') return;

    Sound.bet();
    onBalanceChange(balance - bet);
    setPhase('flipping');
    setResult(null);
    setWinAmount(0);
    Sound.coinSpin();

    const landed: CoinSide = Math.random() < 0.5 ? 'heads' : 'tails';
    // 8 full spins + land on correct face
    const spins = 8 + (landed === 'heads' ? 0 : 0.5);
    setFlips(spins);

    setTimeout(() => {
      setResult(landed);
      Sound.coinLand();
      const won = landed === side;
      if (won) {
        const win = bet * bonusMultiplier;
        setWinAmount(win);
        onBalanceChange(balance + win);
        Sound.winSmall();
        setPhase('won');
      } else {
        Sound.lose();
        setPhase('lost');
      }
      setTimeout(() => setPhase('idle'), 2200);
    }, 2200);
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4">
      <div className="text-center">
        <h2 className="font-display text-3xl text-gold mb-1">🪙 Coin Flip</h2>
        <p className="text-xs text-muted-foreground">Heads or tails. 1:1 payout. Pure luck.</p>
      </div>

      <BetControls balance={balance} bet={bet} setBet={setBet} disabled={phase !== 'idle'} />

      {/* Side selection */}
      <div className="panel p-3 grid grid-cols-2 gap-2">
        {(['heads', 'tails'] as const).map((s) => (
          <button
            key={s}
            onClick={() => { setSide(s); Sound.click(); }}
            disabled={phase !== 'idle'}
            onMouseEnter={() => Sound.hover()}
            className={cn(
              'py-3 rounded-md font-bold transition-all border-2 capitalize',
              side === s
                ? 'bg-gold bg-opacity-20 border-gold text-gold'
                : 'bg-[#0a0a0a] border-[#2a2a2a] text-muted-foreground hover:border-gold',
            )}
          >
            {s === 'heads' ? '👑' : '🦅'} {s}
          </button>
        ))}
      </div>

      {/* Coin */}
      <div className="panel p-8 flex flex-col items-center justify-center min-h-[260px]">
        <div style={{ perspective: '1000px' }}>
          <motion.div
            animate={
              phase === 'flipping'
                ? { rotateY: 360 * flips }
                : { rotateY: result === 'tails' ? 180 : 0 }
            }
            transition={{
              duration: phase === 'flipping' ? 2 : 0.3,
              ease: phase === 'flipping' ? 'easeOut' : 'easeInOut',
            }}
            className="coin-3d w-32 h-32"
          >
            <div className="coin-face bg-gradient-to-br from-yellow-400 to-yellow-700 border-4 border-yellow-300 text-6xl shadow-2xl">
              👑
            </div>
            <div className="coin-face back bg-gradient-to-br from-yellow-400 to-yellow-700 border-4 border-yellow-300 text-6xl shadow-2xl">
              🦅
            </div>
          </motion.div>
        </div>

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 text-center"
            >
              <div className="text-sm text-muted-foreground">Landed on</div>
              <div className="font-display text-3xl text-gold capitalize">{result}</div>
              {phase === 'won' && (
                <div className="text-win text-xl font-bold mt-1">+{formatMoney(winAmount - bet)}</div>
              )}
              {phase === 'lost' && (
                <div className="text-lose text-xl font-bold mt-1">−{formatMoney(bet)}</div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {phase === 'idle' && (
          <div className="text-muted-foreground text-sm mt-4">Pick a side, then flip</div>
        )}
      </div>

      <button
        onClick={flip}
        disabled={balance < bet || phase !== 'idle' || timeRemaining <= 3}
        onMouseEnter={() => Sound.hover()}
        className={cn(
          'py-3 rounded-md font-bold transition-all',
          balance >= bet && phase === 'idle' && timeRemaining > 3
            ? 'bg-gold hover:bg-gold-dark text-black glow-gold'
            : 'bg-[#2a2a2a] text-muted-foreground cursor-not-allowed',
        )}
      >
        {phase === 'flipping' ? 'Flipping...' : balance >= bet ? `Flip (−${formatMoney(bet)})` : 'Not enough balance'}
      </button>
    </div>
  );
}
