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
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={cn(
        'panel flex items-center gap-3',
        compact ? 'p-2' : 'p-3',
        isSelf && 'border-gold',
        player.isHost && 'border-opacity-50',
      )}
    >
      <div className={cn(
        'flex items-center justify-center bg-[#0a0a0a] rounded-full',
        compact ? 'w-8 h-8 text-base' : 'w-10 h-10 text-xl',
      )}>
        {player.avatar}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={cn('font-medium truncate', compact ? 'text-sm' : 'text-base')}>
            {player.name}
          </span>
          {player.isHost && <span title="Host" className="text-gold text-xs">👑</span>}
          {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}
        </div>
        {showBalance && (
          <div className={cn('font-mono', compact ? 'text-xs' : 'text-sm', player.balance > 100 ? 'text-win' : player.balance < 100 ? 'text-lose' : 'text-muted-foreground')}>
            {formatMoney(player.balance)}
          </div>
        )}
      </div>
      {rank !== undefined && (
        <div className={cn(
          'font-display font-bold',
          compact ? 'text-lg' : 'text-2xl',
          rank === 0 ? 'text-gold' : rank === 1 ? 'text-gray-300' : rank === 2 ? 'text-amber-600' : 'text-muted-foreground',
        )}>
          #{rank + 1}
        </div>
      )}
    </motion.div>
  );
}
