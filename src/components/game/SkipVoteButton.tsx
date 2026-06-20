'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Sound } from '@/lib/sounds';

interface SkipVoteButtonProps {
  voted: boolean;
  count: number;
  total: number;
  onVote: () => void;
  onUnvote: () => void;
}

export function SkipVoteButton({ voted, count, total, onVote, onUnvote }: SkipVoteButtonProps) {
  return (
    <div className="flex flex-col items-end gap-1">
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => {
          if (voted) { onUnvote(); Sound.skip(); }
          else { onVote(); Sound.click(); }
        }}
        className={cn(
          'px-4 py-2 rounded-md font-bold text-sm transition-all',
          voted
            ? 'bg-lose text-white'
            : 'bg-[#1a1a1a] border border-[#2a2a2a] hover:border-lose text-muted-foreground hover:text-lose'
        )}
      >
        {voted ? '✓ Voted to Skip' : 'Vote to Skip'}
      </motion.button>
      <div className="text-xs text-muted-foreground">
        {count}/{total} players
      </div>
    </div>
  );
}
