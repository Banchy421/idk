'use client';

import { useState } from 'react';
import { Sound } from '@/lib/sounds';
import { formatMoney } from '@/lib/utils-casino';
import { cn } from '@/lib/utils';

interface BetControlsProps {
  balance: number;
  bet: number;
  setBet: (n: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  presets?: number[];
}

export function BetControls({
  balance, bet, setBet, min = 1, max, disabled, presets = [5, 10, 25, 50, 100],
}: BetControlsProps) {
  const effectiveMax = max ?? Math.max(min, balance);
  const [input, setInput] = useState(String(bet));

  const apply = (n: number) => {
    const clamped = Math.max(min, Math.min(effectiveMax, Math.round(n * 100) / 100));
    setBet(clamped);
    setInput(String(clamped));
    Sound.bet();
  };

  return (
    <div className="panel p-3 space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Bet Amount</span>
        <span>Balance: <span className="font-mono text-gold">{formatMoney(balance)}</span></span>
      </div>
      <div className="flex gap-2">
        <input
          type="number"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onBlur={() => apply(parseFloat(input) || min)}
          disabled={disabled}
          className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] focus:border-gold focus:outline-none rounded px-3 py-2 font-mono text-gold"
          min={min}
          max={effectiveMax}
        />
        <button
          onClick={() => apply(bet / 2)}
          disabled={disabled}
          className="px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] hover:border-gold rounded text-xs"
        >½</button>
        <button
          onClick={() => apply(bet * 2)}
          disabled={disabled}
          className="px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] hover:border-gold rounded text-xs"
        >2×</button>
        <button
          onClick={() => apply(balance)}
          disabled={disabled}
          className="px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] hover:border-gold rounded text-xs"
        >MAX</button>
      </div>
      <div className="flex gap-1 flex-wrap">
        {presets.map((p) => (
          <button
            key={p}
            onClick={() => apply(p)}
            disabled={disabled || p > balance}
            className={cn(
              'flex-1 min-w-[50px] py-1.5 rounded text-xs transition-all',
              bet === p
                ? 'bg-gold text-black font-bold'
                : 'bg-[#0a0a0a] border border-[#2a2a2a] hover:border-gold text-muted-foreground hover:text-white',
              (disabled || p > balance) && 'opacity-30 cursor-not-allowed'
            )}
          >
            €{p}
          </button>
        ))}
      </div>
    </div>
  );
}
