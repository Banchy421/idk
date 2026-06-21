'use client';

import { motion } from 'framer-motion';
import type { Player } from '@/lib/types';
import { formatMoney } from '@/lib/utils-casino';
import { cn } from '@/lib/utils';

interface PlayerCardProps {
  player: Player;
  isSelf?: boolean;
  rank?: number;
  showBalance?: boolean;
  compact?: boolean;
}

export function PlayerCard({ player, isSelf, rank, showBalance = true, compact = false }: PlayerCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      className="flex items-center gap-3 rounded-md border p-2.5"
      style={{
        backgroundColor: isSelf ? 'var(--sf-border)' : 'var(--sf-bg)',
        borderColor: 'var(--sf-border)',
      }}
    >
      <div className={cn(
        'flex items-center justify-center rounded-md',
        compact ? 'w-7 h-7 text-sm' : 'w-9 h-9 text-lg',
      )}
        style={{ backgroundColor: 'var(--sf-bg-secondary)' }}>
        {player.avatar}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate" style={{ fontWeight: 400, color: 'var(--sf-text)', fontSize: compact ? '13px' : '14px' }}>
            {player.name}
          </span>
          {player.isHost && <span className="text-xs" style={{ color: 'var(--sf-text-muted)' }}>·</span>}
          {isSelf && <span className="text-xs" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>(you)</span>}
        </div>
        {showBalance && (
          <div className="font-mono" style={{
            fontSize: compact ? '11px' : '12px',
            color: 'var(--sf-text-muted)',
            fontWeight: 400,
          }}>
            {formatMoney(player.balance)}
          </div>
        )}
      </div>
      {rank !== undefined && (
        <div className="font-mono" style={{
          fontWeight: 400,
          fontSize: compact ? '14px' : '16px',
          color: rank === 0 ? 'var(--sf-accent)' : 'var(--sf-text-muted)',
        }}>
          {rank + 1}
        </div>
      )}
    </motion.div>
  );
}
