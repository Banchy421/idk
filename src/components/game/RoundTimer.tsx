'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface RoundTimerProps {
  remaining: number;
  total: number;
  label?: string;
  compact?: boolean;
}

export function RoundTimer({ remaining, total, label, compact = false }: RoundTimerProps) {
  const pct = total > 0 ? (remaining / total) * 100 : 0;
  const danger = remaining <= 10;
  return (
    <div className={cn('panel p-3', compact && 'p-2')}>
      {label && (
        <div className="text-xs text-muted-foreground mb-1 uppercase tracking-widest text-center">{label}</div>
      )}
      <motion.div
        key={remaining}
        initial={danger ? { scale: 1.1 } : false}
        animate={{ scale: 1 }}
        className={cn(
          'font-mono font-bold text-center',
          compact ? 'text-2xl' : 'text-4xl',
          danger ? 'text-lose' : 'text-gold',
        )}
      >
        {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
      </motion.div>
      {!compact && (
        <div className="mt-2 h-1 bg-[#0a0a0a] rounded-full overflow-hidden">
          <motion.div
            className={cn('h-full rounded-full', danger ? 'bg-lose' : 'bg-gold')}
            initial={{ width: '100%' }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.3, ease: 'linear' }}
          />
        </div>
      )}
    </div>
  );
}
