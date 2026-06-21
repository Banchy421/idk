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
    <div className="flex flex-col items-end gap-0.5">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => {
          if (voted) { onUnvote(); Sound.skip(); }
          else { onVote(); Sound.click(); }
        }}
        className="px-3 py-1.5 rounded-md border text-xs transition-colors"
        style={{
          backgroundColor: voted ? 'var(--sf-lose)' : 'var(--sf-bg)',
          borderColor: 'var(--sf-border)',
          color: voted ? 'var(--sf-bg)' : 'var(--sf-text-muted)',
          fontWeight: 400,
        }}
      >
        {voted ? 'Voted to skip' : 'Vote to skip'}
      </motion.button>
      <div className="text-[10px]" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
        {count}/{total} players
      </div>
    </div>
  );
}
