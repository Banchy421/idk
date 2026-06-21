'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/lib/themes';
import { Sound } from '@/lib/sounds';
import { cn } from '@/lib/utils';

interface ThemePickerProps {
  compact?: boolean;
}

export function ThemePicker({ compact = false }: ThemePickerProps) {
  const { theme, setThemeId, themes } = useTheme();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => { setOpen(!open); Sound.click(); }}
        className={cn(
          'flex items-center gap-2 rounded-md border transition-colors',
          compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm',
        )}
        style={{
          backgroundColor: open ? 'var(--sf-border)' : 'var(--sf-bg-secondary)',
          borderColor: 'var(--sf-border)',
          color: 'var(--sf-text)',
          fontWeight: 400,
        }}
      >
        <span style={{ color: 'var(--sf-text-muted)' }}>{theme.icon}</span>
        {!compact && <span>{theme.name}</span>}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 mt-1 w-56 rounded-md border z-50 overflow-hidden"
            style={{
              backgroundColor: 'var(--sf-bg-secondary)',
              borderColor: 'var(--sf-border)',
            }}
          >
            <div className="p-1.5">
              <div
                className="text-xs px-2 py-1.5 mb-0.5"
                style={{ color: 'var(--sf-text-muted)', fontWeight: 400, textTransform: 'none' }}
              >
                Select theme
              </div>
              {themes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setThemeId(t.id);
                    Sound.click();
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded transition-colors text-left"
                  style={{
                    backgroundColor: theme.id === t.id ? 'var(--sf-border)' : 'transparent',
                  }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: t.colors.accent }}
                  />
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-sm"
                      style={{
                        color: 'var(--sf-text)',
                        fontWeight: theme.id === t.id ? 500 : 400,
                      }}
                    >
                      {t.name}
                    </div>
                    <div className="text-xs truncate" style={{ color: 'var(--sf-text-muted)' }}>
                      {t.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
