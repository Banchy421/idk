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

  const inputStyle: React.CSSProperties = {
    backgroundColor: 'var(--sf-bg)',
    border: '0.5px solid var(--sf-border)',
    color: 'var(--sf-text)',
    borderRadius: '6px',
    fontWeight: 400,
  };

  const btnStyle: React.CSSProperties = {
    backgroundColor: 'var(--sf-bg)',
    border: '0.5px solid var(--sf-border)',
    color: 'var(--sf-text-muted)',
    borderRadius: '6px',
    fontWeight: 400,
  };

  return (
    <div className="panel p-3.5 space-y-2.5">
      <div className="flex items-center justify-between text-xs" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
        <span>Bet amount</span>
        <span>Balance: <span className="font-mono" style={{ color: 'var(--sf-text)' }}>{formatMoney(balance)}</span></span>
      </div>
      <div className="flex gap-1.5">
        <input
          type="number"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onBlur={() => apply(parseFloat(input) || min)}
          disabled={disabled}
          className="flex-1 px-3 py-2 font-mono focus:outline-none transition-colors"
          style={inputStyle}
          min={min}
          max={effectiveMax}
        />
        <button
          onClick={() => apply(bet / 2)}
          disabled={disabled}
          className="px-3 py-2 text-xs transition-colors"
          style={btnStyle}
        >½</button>
        <button
          onClick={() => apply(bet * 2)}
          disabled={disabled}
          className="px-3 py-2 text-xs transition-colors"
          style={btnStyle}
        >2×</button>
        <button
          onClick={() => apply(balance)}
          disabled={disabled}
          className="px-3 py-2 text-xs transition-colors"
          style={btnStyle}
        >Max</button>
      </div>
      <div className="flex gap-1 flex-wrap">
        {presets.map((p) => (
          <button
            key={p}
            onClick={() => apply(p)}
            disabled={disabled || p > balance}
            className={cn(
              'flex-1 min-w-[48px] py-1.5 rounded text-xs transition-colors',
            )}
            style={{
              backgroundColor: bet === p ? 'var(--sf-accent)' : 'var(--sf-bg)',
              border: '0.5px solid var(--sf-border)',
              color: bet === p ? 'var(--sf-text)' : 'var(--sf-text-muted)',
              fontWeight: 400,
              cursor: (disabled || p > balance) ? 'not-allowed' : 'pointer',
              opacity: (disabled || p > balance) ? 0.4 : 1,
            }}
          >
            €{p}
          </button>
        ))}
      </div>
    </div>
  );
}
