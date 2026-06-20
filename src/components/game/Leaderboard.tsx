'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { Player } from '@/lib/types';
import { PlayerCard } from '@/components/lobby/PlayerCard';
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
      // Defer the state update to avoid cascading renders
      Promise.resolve().then(() => setFlashState(newFlash));
      return () => clearTimeout(id);
    }
  }, [ranked.map((p) => p.displayBalance).join(',')]);

  const leader = ranked[0];

  if (collapsed) {
    return (
      <div className="panel p-2 mb-3 flex items-center gap-2 overflow-x-auto casino-scroll">
        {ranked.slice(0, 6).map((p, i) => (
          <div
            key={p.id}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#0a0a0a] flex-shrink-0',
              p.id === selfId && 'border border-gold',
              flashState[p.id] === 'up' && 'flash-win',
              flashState[p.id] === 'down' && 'flash-lose',
            )}
          >
            <span className="text-xs text-muted-foreground">#{i + 1}</span>
            <span className="text-base">{p.avatar}</span>
            <span className="text-xs font-mono text-gold">{formatMoney(p.displayBalance)}</span>
            {i === 0 && <span className="text-xs">👑</span>}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="panel p-3 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display text-base text-gold flex items-center gap-1">
          <span>👑</span> Leaderboard
        </h3>
      </div>
      <div className="space-y-1.5 overflow-y-auto casino-scroll flex-1">
        <AnimatePresence>
          {ranked.map((p, i) => (
            <div
              key={p.id}
              className={cn(
                'flex items-center gap-2 p-2 rounded-md bg-[#0a0a0a] border border-transparent',
                p.id === selfId && 'border-gold',
                i === 0 && 'bg-gold bg-opacity-10',
                flashState[p.id] === 'up' && 'flash-win',
                flashState[p.id] === 'down' && 'flash-lose',
              )}
            >
              <div className={cn(
                'w-6 text-center font-display font-bold text-sm',
                i === 0 ? 'text-gold' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-muted-foreground',
              )}>
                {i + 1}
              </div>
              <div className="text-lg">{p.avatar}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">
                  {p.name} {p.id === selfId && <span className="text-xs text-muted-foreground">(you)</span>}
                </div>
                {p.roundBonus > 1 && (
                  <div className="text-[10px] text-gold">+{Math.round((p.roundBonus - 1) * 100)}% bonus</div>
                )}
                {p.roundBonus < 1 && p.bailoutUsed && (
                  <div className="text-[10px] text-lose">−10% bailout penalty</div>
                )}
              </div>
              <div className={cn(
                'font-mono text-sm',
                p.displayBalance > 100 ? 'text-win' : p.displayBalance < 100 ? 'text-lose' : 'text-muted-foreground',
              )}>
                {formatMoney(p.displayBalance)}
              </div>
            </div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
