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
    <div className="panel p-3" style={{ padding: compact ? '8px 12px' : undefined }}>
      {label && (
        <div className="text-xs mb-1 text-center" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
          {label}
        </div>
      )}
      <motion.div
        key={remaining}
        className={cn('font-mono text-center', compact ? 'text-xl' : 'text-3xl')}
        style={{
          color: danger ? 'var(--sf-lose)' : 'var(--sf-text)',
          fontWeight: 400,
        }}
      >
        {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
      </motion.div>
      {!compact && (
        <div className="mt-2 h-0.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--sf-bg)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: danger ? 'var(--sf-lose)' : 'var(--sf-accent)' }}
            initial={{ width: '100%' }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.3, ease: 'linear' }}
          />
        </div>
      )}
    </div>
  );
}
