'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameState, Player, PowerType } from '@/lib/types';
import { POWER_META } from '@/lib/types';
import { formatMoney } from '@/lib/utils-casino';

interface PowerEffectsProps {
  state: GameState;
  self: Player | null;
}

interface FlashNotification {
  id: number;
  icon: string;
  title: string;
  message: string;
  color: string;
}

export function PowerEffects({ state, self }: PowerEffectsProps) {
  const [notifications, setNotifications] = useState<FlashNotification[]>([]);
  const notifIdRef = useRef(0);
  const prevBalanceRef = useRef<number | null>(null);
  const prevPowerRef = useRef<{ type: PowerType; used: boolean } | null>(null);

  const now = Date.now();

  // Active persistent effects
  const goldRushActive = self ? self.goldRushUntil > now : false;
  const goldRushRemaining = self ? Math.max(0, Math.ceil((self.goldRushUntil - now) / 1000)) : 0;
  const frozenActive = self ? self.frozenUntil > now : false;
  const frozenRemaining = self ? Math.max(0, Math.ceil((self.frozenUntil - now) / 1000)) : 0;
  const doubleOrNothing = self?.doubleOrNothing ?? false;
  const insured = self?.insured ?? false;
  const jackpotMagnet = self?.jackpotMagnet ?? false;
  const cursed = self?.cursed ?? false;
  const bailoutBlocked = self?.bailoutBlocked ?? false;
  const mirroredBy = self?.mirroredBy ?? null;

  const mirrorSource = mirroredBy ? state.players[mirroredBy] : null;

  const addNotification = (notif: Omit<FlashNotification, 'id'>) => {
    const id = ++notifIdRef.current;
    setNotifications((prev) => [...prev, { ...notif, id }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4000);
  };

  // Detect instant power effects (heist/swap) by watching balance changes
  useEffect(() => {
    if (!self) return;
    const prevBal = prevBalanceRef.current;
    const prevPower = prevPowerRef.current;

    // Detect power activation by self (for the activator's screen)
    if (prevPower && self.power && prevPower.used === false && self.power.used === true) {
      const meta = POWER_META[prevPower.type];
      if (meta) {
        addNotification({
          icon: meta.icon,
          title: `${meta.label} activated!`,
          message: meta.targeted ? 'Power used on target' : 'Power is now active',
          color: 'var(--sf-accent)',
        });
      }
    }

    // Detect balance drop from heist (someone stole from us)
    if (prevBal !== null && self.balance < prevBal - 0.5) {
      const diff = prevBal - self.balance;
      // Check if any other player just used heist/swap
      const heister = Object.values(state.players).find(
        (p) => p.id !== self.id && p.power?.used && p.power.type === 'heist'
      );
      const swapper = Object.values(state.players).find(
        (p) => p.id !== self.id && p.power?.used && p.power.type === 'swap'
      );
      if (heister) {
        addNotification({
          icon: '💰',
          title: 'You were robbed!',
          message: `${heister.name} stole ${formatMoney(diff)} from you`,
          color: 'var(--sf-lose)',
        });
      } else if (swapper) {
        addNotification({
          icon: '🔄',
          title: 'Balance swapped!',
          message: `${swapper.name} swapped balances with you`,
          color: 'var(--sf-accent)',
        });
      }
    }

    // Detect balance gain from heist (we stole from someone)
    if (prevBal !== null && self.balance > prevBal + 0.5) {
      const diff = self.balance - prevBal;
      if (self.power?.used && self.power.type === 'heist') {
        addNotification({
          icon: '💰',
          title: 'Heist successful!',
          message: `You stole ${formatMoney(diff)}`,
          color: 'var(--sf-win)',
        });
      } else if (self.power?.used && self.power.type === 'swap') {
        addNotification({
          icon: '🔄',
          title: 'Balance swapped!',
          message: `New balance: ${formatMoney(self.balance)}`,
          color: 'var(--sf-accent)',
        });
      }
    }

    prevBalanceRef.current = self.balance;
    prevPowerRef.current = self.power ? { ...self.power } : null;
  }, [self?.balance, self?.power?.used, self?.power?.type, state.players]);

  // Tick for timers
  const [, setTick] = useState(0);
  useEffect(() => {
    if (goldRushActive || frozenActive) {
      const id = setInterval(() => setTick((t) => t + 1), 500);
      return () => clearInterval(id);
    }
  }, [goldRushActive, frozenActive]);

  return (
    <>
      {/* ─── Gold Rush: gold border + timer ─── */}
      <AnimatePresence>
        {goldRushActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 pointer-events-none z-30"
          >
            {/* Gold border edges */}
            <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 0 4px var(--sf-accent), inset 0 0 40px rgba(184, 168, 152, 0.3)' }} />
            {/* Floating timer */}
            <motion.div
              initial={{ scale: 0, y: -20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0, y: -20 }}
              className="fixed top-20 left-1/2 -translate-x-1/2 panel px-5 py-3 flex items-center gap-3"
              style={{ borderColor: 'var(--sf-accent)' }}
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className="text-2xl"
              >
                ✨
              </motion.div>
              <div>
                <div className="text-xs" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>Gold rush active</div>
                <div className="font-display text-2xl font-mono" style={{ color: 'var(--sf-accent)', fontWeight: 500 }}>
                  {goldRushRemaining}s
                </div>
              </div>
              <div className="text-xs" style={{ color: 'var(--sf-win)', fontWeight: 400 }}>×1.5 wins</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Freeze: ice border + timer ─── */}
      <AnimatePresence>
        {frozenActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 pointer-events-none z-30"
          >
            <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 0 4px #6BA8C8, inset 0 0 50px rgba(107, 168, 200, 0.25)' }} />
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 panel px-6 py-4 text-center"
              style={{ borderColor: '#6BA8C8' }}
            >
              <motion.div
                animate={{ rotate: [0, -5, 5, -5, 0] }}
                transition={{ duration: 0.6, repeat: Infinity }}
                className="text-4xl mb-1"
              >
                🧊
              </motion.div>
              <div className="font-display text-xl" style={{ color: '#6BA8C8', fontWeight: 500 }}>Frozen</div>
              <div className="font-mono text-lg" style={{ color: 'var(--sf-text)', fontWeight: 400 }}>{frozenRemaining}s</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Curse: red tint border ─── */}
      <AnimatePresence>
        {cursed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 pointer-events-none z-30"
          >
            <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 0 3px var(--sf-lose), inset 0 0 30px rgba(184, 92, 92, 0.15)' }} />
            <motion.div
              initial={{ x: -100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="fixed top-20 right-5 panel px-3 py-2 flex items-center gap-2"
              style={{ borderColor: 'var(--sf-lose)' }}
            >
              <span className="text-lg">诅咒</span>
              <div className="text-xs" style={{ color: 'var(--sf-lose)', fontWeight: 400 }}>
                Cursed — 50% next win
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Double or Nothing: badge ─── */}
      <AnimatePresence>
        {doubleOrNothing && (
          <motion.div
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 90 }}
            className="fixed top-20 right-5 panel px-3 py-2 flex items-center gap-2 z-30 pointer-events-none"
            style={{ borderColor: 'var(--sf-accent)' }}
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="text-lg"
            >
              🎲
            </motion.div>
            <div className="text-xs" style={{ color: 'var(--sf-text)', fontWeight: 400 }}>
              2× win / 2× loss
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Insurance: shield badge ─── */}
      <AnimatePresence>
        {insured && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="fixed top-20 right-5 panel px-3 py-2 flex items-center gap-2 z-30 pointer-events-none"
            style={{ borderColor: 'var(--sf-win)' }}
          >
            <motion.div
              animate={{ y: [0, -2, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-lg"
            >
              🛡️
            </motion.div>
            <div className="text-xs" style={{ color: 'var(--sf-win)', fontWeight: 400 }}>
              Insured — 50% loss
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Jackpot Magnet: magnet badge ─── */}
      <AnimatePresence>
        {jackpotMagnet && (
          <motion.div
            initial={{ scale: 0, x: 20 }}
            animate={{ scale: 1, x: 0 }}
            exit={{ scale: 0, x: 20 }}
            className="fixed top-20 right-5 panel px-3 py-2 flex items-center gap-2 z-30 pointer-events-none"
            style={{ borderColor: 'var(--sf-accent)' }}
          >
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              className="text-lg"
            >
              🧲
            </motion.div>
            <div className="text-xs" style={{ color: 'var(--sf-accent)', fontWeight: 400 }}>
              +20% luck
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Bailout Block: blocked badge ─── */}
      <AnimatePresence>
        {bailoutBlocked && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="fixed top-20 right-5 panel px-3 py-2 flex items-center gap-2 z-30 pointer-events-none"
            style={{ borderColor: 'var(--sf-lose)' }}
          >
            <span className="text-lg">🚫</span>
            <div className="text-xs" style={{ color: 'var(--sf-lose)', fontWeight: 400 }}>
              Bailout blocked
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Mirror: echo badge ─── */}
      <AnimatePresence>
        {mirrorSource && (
          <motion.div
            initial={{ scale: 0, x: -20 }}
            animate={{ scale: 1, x: 0 }}
            exit={{ scale: 0, x: -20 }}
            className="fixed top-20 left-5 panel px-3 py-2 flex items-center gap-2 z-30 pointer-events-none"
            style={{ borderColor: 'var(--sf-accent)' }}
          >
            <motion.div
              animate={{ scale: [1, -1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-lg"
            >
              🪞
            </motion.div>
            <div className="text-xs" style={{ color: 'var(--sf-text)', fontWeight: 400 }}>
              {mirrorSource.name} is mirroring you
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Flash notifications (heist/swap/activation) ─── */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2 pointer-events-none">
        <AnimatePresence>
          {notifications.map((notif) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 300 }}
              className="panel px-4 py-3 flex items-center gap-3 min-w-[240px]"
              style={{ borderColor: notif.color }}
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.5, repeat: 2 }}
                className="text-2xl"
              >
                {notif.icon}
              </motion.div>
              <div>
                <div className="text-sm" style={{ color: notif.color, fontWeight: 500 }}>
                  {notif.title}
                </div>
                <div className="text-xs" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
                  {notif.message}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ─── Power used indicator (dimmed badge showing what you used) ─── */}
      {self?.power?.used && self.power.type && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          className="fixed bottom-5 left-5 z-30 pointer-events-none"
        >
          <div className="panel px-3 py-2 flex items-center gap-2 opacity-50">
            <span className="text-lg grayscale">{POWER_META[self.power.type].icon}</span>
            <span className="text-xs" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
              {POWER_META[self.power.type].label} — used
            </span>
          </div>
        </motion.div>
      )}
    </>
  );
}
