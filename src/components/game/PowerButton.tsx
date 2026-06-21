'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameState, Player } from '@/lib/types';
import { POWER_META } from '@/lib/types';
import { Sound } from '@/lib/sounds';
import { formatMoney } from '@/lib/utils-casino';

interface PowerButtonProps {
  state: GameState;
  self: Player | null;
  onActivate: (targetId?: string) => void;
}

export function PowerButton({ state, self, onActivate }: PowerButtonProps) {
  const [open, setOpen] = useState(false);
  const [showFrozen, setShowFrozen] = useState(false);
  const [activating, setActivating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const myPower = self?.power;
  const isUsed = !myPower || myPower.used;
  const powerMeta = myPower ? POWER_META[myPower.type] : null;

  const isFrozen = self ? self.frozenUntil > Date.now() : false;

  useEffect(() => {
    if (isFrozen) {
      setShowFrozen(true);
      const id = setTimeout(() => setShowFrozen(false), 5000);
      return () => clearTimeout(id);
    }
  }, [isFrozen]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!powerMeta || isUsed) {
    return (
      <div className="fixed bottom-5 right-5 z-40">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-2xl opacity-25"
          style={{
            backgroundColor: 'var(--sf-bg-secondary)',
            border: '0.5px solid var(--sf-border)',
          }}
        >
          {powerMeta?.icon || '✦'}
        </div>
      </div>
    );
  }

  const otherPlayers = Object.values(state.players)
    .filter((p) => p.id !== self?.id && !p.isEliminated);

  const handleActivate = (targetId?: string) => {
    setActivating(true);
    Sound.cashRegister();
    setTimeout(() => {
      onActivate(targetId);
      setOpen(false);
      setActivating(false);
    }, 400);
  };

  return (
    <>
      {/* Frozen overlay */}
      <AnimatePresence>
        {showFrozen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
          >
            <motion.div
              initial={{ scale: 0.5, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="panel p-6 text-center"
              style={{ borderColor: 'var(--sf-lose)' }}
            >
              <motion.div
                animate={{ rotate: [0, -5, 5, -5, 0] }}
                transition={{ duration: 0.5, repeat: 2 }}
                className="text-5xl mb-2"
              >
                🧊
              </motion.div>
              <div className="font-display text-xl" style={{ fontWeight: 500, color: 'var(--sf-lose)' }}>
                You are frozen!
              </div>
              <div className="text-sm mt-1" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
                Wait 5 seconds...
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating power button with animations */}
      <div className="fixed bottom-5 right-5 z-40" ref={dropdownRef}>
        {/* Pulsing ring behind button */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ backgroundColor: 'var(--sf-accent)' }}
          animate={{ scale: [1, 1.6], opacity: [0.4, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
        />
        {/* Second offset pulse ring */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ backgroundColor: 'var(--sf-accent)' }}
          animate={{ scale: [1, 1.6], opacity: [0.3, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut', delay: 0.6 }}
        />

        <motion.button
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.3 }}
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.88 }}
          onClick={() => { setOpen(!open); Sound.click(); }}
          className="relative w-16 h-16 rounded-full flex items-center justify-center text-3xl"
          style={{
            backgroundColor: 'var(--sf-accent)',
            border: '3px solid var(--sf-bg)',
            color: 'var(--sf-text)',
          }}
          title={`Activate ${powerMeta.label}`}
        >
          {/* Gentle continuous bob */}
          <motion.div
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            {powerMeta.icon}
          </motion.div>

          {/* "POWER" label badge */}
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="absolute -left-1 -top-1 px-1.5 py-0.5 rounded-full text-[8px] font-mono"
            style={{
              backgroundColor: 'var(--sf-lose)',
              color: 'var(--sf-bg)',
              fontWeight: 500,
            }}
          >
            POWER
          </motion.div>
        </motion.button>

        {/* Activation dropdown */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="absolute bottom-20 right-0 w-72 rounded-lg border overflow-hidden"
              style={{
                backgroundColor: 'var(--sf-bg-secondary)',
                borderColor: 'var(--sf-border)',
              }}
            >
              {/* Animated header with power icon */}
              <div
                className="p-4 border-b"
                style={{ borderColor: 'var(--sf-border)', backgroundColor: 'var(--sf-bg)' }}
              >
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="text-3xl"
                  >
                    {powerMeta.icon}
                  </motion.div>
                  <div className="flex-1">
                    <div className="font-display text-base" style={{ fontWeight: 500, color: 'var(--sf-text)' }}>
                      {powerMeta.label}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
                      {powerMeta.description}
                    </div>
                  </div>
                </div>
              </div>

              {/* Target list or activate button */}
              <div className="p-3">
                {activating ? (
                  <div className="py-4 text-center">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }}
                      className="inline-block text-2xl"
                    >
                      ⚡
                    </motion.div>
                    <div className="text-xs mt-2" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
                      Activating...
                    </div>
                  </div>
                ) : powerMeta.targeted ? (
                  <>
                    <div className="text-xs mb-2" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
                      Select a target:
                    </div>
                    <div className="space-y-1 max-h-48 overflow-y-auto casino-scroll">
                      {otherPlayers.map((p, i) => (
                        <motion.button
                          key={p.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          onClick={() => handleActivate(p.id)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors text-left"
                          style={{ backgroundColor: 'transparent' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--sf-border)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <span className="text-lg">{p.avatar}</span>
                          <span className="flex-1 text-sm" style={{ color: 'var(--sf-text)', fontWeight: 400 }}>
                            {p.name}
                          </span>
                          <span className="font-mono text-xs" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
                            {formatMoney(p.balance)}
                          </span>
                        </motion.button>
                      ))}
                    </div>
                  </>
                ) : (
                  <button
                    onClick={() => handleActivate()}
                    className="w-full py-2.5 rounded-md text-sm transition-colors"
                    style={{
                      backgroundColor: 'var(--sf-accent)',
                      color: 'var(--sf-text)',
                      fontWeight: 400,
                    }}
                  >
                    Activate {powerMeta.label}
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
