'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { Player } from '@/lib/types';
import { formatMoney } from '@/lib/utils-casino';
import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';

interface LeaderboardProps {
  players: Record<string, Player>;
  selfId: string;
  liveBalances?: Record<string, number>;
  collapsed?: boolean;
}

export function Leaderboard({ players, selfId, liveBalances = {}, collapsed = false }: LeaderboardProps) {
  const ranked = Object.values(players)
    .map((p) => ({ ...p, displayBalance: liveBalances[p.id] ?? p.balance }))
    .sort((a, b) => b.displayBalance - a.displayBalance);
  const prevBalances = useRef<Record<string, number>>({});
  const [flashState, setFlashState] = useState<Record<string, 'up' | 'down' | null>>({});

  useEffect(() => {
    const newFlash: Record<string, 'up' | 'down' | null> = {};
    for (const p of ranked) {
      const prev = prevBalances.current[p.id];
      if (prev !== undefined && prev !== p.displayBalance) {
        newFlash[p.id] = p.displayBalance > prev ? 'up' : 'down';
      }
      prevBalances.current[p.id] = p.displayBalance;
    }
    if (Object.keys(newFlash).length > 0) {
      const id = setTimeout(() => setFlashState({}), 600);
      Promise.resolve().then(() => setFlashState(newFlash));
      return () => clearTimeout(id);
    }
  }, [ranked.map((p) => p.displayBalance).join(',')]);

  if (collapsed) {
    return (
      <div className="flex items-center gap-1.5 mb-3 overflow-x-auto casino-scroll">
        {ranked.slice(0, 6).map((p, i) => (
          <div
            key={p.id}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-md flex-shrink-0',
              flashState[p.id] === 'up' && 'flash-win',
              flashState[p.id] === 'down' && 'flash-lose',
            )}
            style={{
              backgroundColor: p.id === selfId ? 'var(--sf-border)' : 'var(--sf-bg-secondary)',
              border: '0.5px solid var(--sf-border)',
            }}
          >
            <span className="text-xs" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>{i + 1}</span>
            <span className="text-sm">{p.avatar}</span>
            <span className="text-xs font-mono" style={{ color: 'var(--sf-text)', fontWeight: 400 }}>
              {formatMoney(p.displayBalance)}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="panel p-3 h-full flex flex-col">
      <h3 className="text-xs mb-3" style={{ color: 'var(--sf-text-muted)', fontWeight: 500 }}>
        Leaderboard
      </h3>
      <div className="space-y-1 overflow-y-auto casino-scroll flex-1">
        <AnimatePresence>
          {ranked.map((p, i) => (
            <div
              key={p.id}
              className={cn(
                'flex items-center gap-2 p-2 rounded-md',
                flashState[p.id] === 'up' && 'flash-win',
                flashState[p.id] === 'down' && 'flash-lose',
              )}
              style={{
                backgroundColor: p.id === selfId ? 'var(--sf-border)' : 'transparent',
              }}
            >
              <div className="w-4 text-center text-xs" style={{
                color: 'var(--sf-text-muted)',
                fontWeight: 400,
              }}>
                {i + 1}
              </div>
              <div className="text-base">{p.avatar}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate" style={{ color: 'var(--sf-text)', fontWeight: 400 }}>
                  {p.name} {p.id === selfId && <span className="text-xs" style={{ color: 'var(--sf-text-muted)' }}>(you)</span>}
                </div>
                {p.roundBonus > 1 && (
                  <div className="text-[10px]" style={{ color: 'var(--sf-accent)', fontWeight: 400 }}>
                    +{Math.round((p.roundBonus - 1) * 100)}% bonus
                  </div>
                )}
                {p.roundBonus < 1 && p.bailoutUsed && (
                  <div className="text-[10px]" style={{ color: 'var(--sf-lose)', fontWeight: 400 }}>
                    −10% bailout penalty
                  </div>
                )}
              </div>
              <div className="font-mono text-sm" style={{
                color: p.displayBalance > 100 ? 'var(--sf-win)' : p.displayBalance < 100 ? 'var(--sf-lose)' : 'var(--sf-text-muted)',
                fontWeight: 400,
              }}>
                {formatMoney(p.displayBalance)}
              </div>
            </div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
