'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AVATARS } from '@/lib/types';
import { Sound, unlockAudio } from '@/lib/sounds';
import { cn } from '@/lib/utils';
import { ThemePicker } from '@/components/theme/ThemePicker';

interface LandingScreenProps {
  onCreate: (name: string, avatar: string) => void;
  onJoin: (name: string, avatar: string, code: string) => void;
  mode?: 'multiplayer' | 'solo';
  onModeChange?: (m: 'multiplayer' | 'solo') => void;
}

function loadInitial() {
  if (typeof window === 'undefined') return { name: '', avatar: AVATARS[0], action: 'create' as const, joinCode: '' };
  const savedName = localStorage.getItem('sf-name') ?? '';
  const savedAvatar = localStorage.getItem('sf-avatar');
  const avatar = savedAvatar && (AVATARS as readonly string[]).includes(savedAvatar as any)
    ? savedAvatar as string
    : AVATARS[0];
  const pendingJoin = sessionStorage.getItem('sf-pending-join');
  if (pendingJoin) {
    sessionStorage.removeItem('sf-pending-join');
    return { name: savedName, avatar, action: 'join' as const, joinCode: pendingJoin };
  }
  return { name: savedName, avatar, action: 'create' as const, joinCode: '' };
}

export function LandingScreen({ onCreate, onJoin, mode = 'multiplayer', onModeChange }: LandingScreenProps) {
  const init = typeof window !== 'undefined' ? loadInitial() : { name: '', avatar: AVATARS[0], action: 'create' as const, joinCode: '' };
  const [name, setName] = useState(init.name);
  const [avatar, setAvatar] = useState<string>(init.avatar);
  const [action, setAction] = useState<'create' | 'join'>(init.action);
  const [joinCode, setJoinCode] = useState(init.joinCode);
  const [error, setError] = useState('');

  // Unlock audio on the FIRST user interaction anywhere on the page.
  // This ensures the AudioContext is resumed before any Sound.* calls,
  // so the first click on an avatar/button isn't swallowed by audio setup.
  useEffect(() => {
    const unlock = () => { unlockAudio(); };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const handleSubmit = () => {
    if (!name.trim()) {
      setError('Pick a nickname first');
      Sound.error();
      return;
    }
    unlockAudio();
    Sound.click();
    localStorage.setItem('sf-name', name.trim());
    localStorage.setItem('sf-avatar', avatar);
    if (action === 'create') {
      onCreate(name.trim(), avatar);
    } else {
      const code = joinCode.trim().toUpperCase();
      if (code.length !== 6) {
        setError('Room code must be 6 letters');
        Sound.error();
        return;
      }
      onJoin(name.trim(), avatar, code);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative">
      {/* Theme picker — top right */}
      <div className="absolute top-4 right-4">
        <ThemePicker />
      </div>

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-8"
      >
        <h1 className="font-display text-6xl md:text-7xl font-bold shimmer mb-2">
          StakeFriends
        </h1>
        <p className="text-lg" style={{ color: 'var(--sf-text-muted)' }}>
          Real-time multiplayer casino. No backend. No accounts.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="panel p-6 w-full max-w-md"
      >
        {/* Mode toggle */}
        {onModeChange && (
          <div className="mb-4">
            <div className="flex gap-1 p-1 rounded-md border" style={{ backgroundColor: 'var(--sf-bg-tertiary)', borderColor: 'var(--sf-border)' }}>
              <button
                onClick={() => { onModeChange('multiplayer'); Sound.click(); }}
                onMouseEnter={() => Sound.hover()}
                className={cn(
                  'flex-1 py-1.5 rounded text-xs font-medium transition-all',
                )}
                style={{
                  backgroundColor: mode === 'multiplayer' ? 'var(--sf-accent)' : 'transparent',
                  color: mode === 'multiplayer' ? 'var(--sf-bg)' : 'var(--sf-text-muted)',
                }}
              >
                👥 Multiplayer (P2P)
              </button>
              <button
                onClick={() => { onModeChange('solo'); Sound.click(); }}
                onMouseEnter={() => Sound.hover()}
                className="flex-1 py-1.5 rounded text-xs font-medium transition-all"
                style={{
                  backgroundColor: mode === 'solo' ? 'var(--sf-accent)' : 'transparent',
                  color: mode === 'solo' ? 'var(--sf-bg)' : 'var(--sf-text-muted)',
                }}
              >
                🤖 Solo vs Bots
              </button>
            </div>
            <p className="text-[10px] text-center mt-1.5" style={{ color: 'var(--sf-text-muted)' }}>
              {mode === 'multiplayer'
                ? 'Play with friends over WebRTC P2P. Requires WebRTC support.'
                : 'Practice against AI bots. Same game flow, single browser.'}
            </p>
          </div>
        )}

        <div className="mb-5">
          <label className="text-sm mb-2 block" style={{ color: 'var(--sf-text-muted)' }}>Nickname</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 16))}
            placeholder="Enter your name"
            className="w-full rounded-md px-4 py-2.5 focus:outline-none transition-colors"
            style={{
              backgroundColor: 'var(--sf-bg-tertiary)',
              border: '1px solid var(--sf-border)',
              color: 'var(--sf-text)',
            }}
            maxLength={16}
          />
        </div>

        <div className="mb-5">
          <label className="text-sm mb-2 block" style={{ color: 'var(--sf-text-muted)' }}>Avatar</label>
          <div className="grid grid-cols-8 gap-1.5">
            {AVATARS.map((a) => (
              <button
                key={a}
                onClick={() => { setAvatar(a); Sound.hover(); }}
                onMouseEnter={() => Sound.hover()}
                className={cn(
                  'aspect-square rounded-md text-2xl flex items-center justify-center transition-all',
                )}
                style={{
                  backgroundColor: avatar === a ? `rgba(var(--sf-accent-rgb), 0.2)` : 'var(--sf-bg-tertiary)',
                  border: avatar === a ? '2px solid var(--sf-accent)' : '1px solid var(--sf-border)',
                  transform: avatar === a ? 'scale(1.05)' : 'scale(1)',
                }}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {mode === 'multiplayer' && (
          <div className="mb-5">
            <div className="flex gap-2 p-1 rounded-md border" style={{ backgroundColor: 'var(--sf-bg-tertiary)', borderColor: 'var(--sf-border)' }}>
              <button
                onClick={() => { setAction('create'); Sound.click(); }}
                className="flex-1 py-2 rounded text-sm font-medium transition-all"
                style={{
                  backgroundColor: action === 'create' ? 'var(--sf-accent)' : 'transparent',
                  color: action === 'create' ? 'var(--sf-bg)' : 'var(--sf-text-muted)',
                }}
              >
                Create Room
              </button>
              <button
                onClick={() => { setAction('join'); Sound.click(); }}
                className="flex-1 py-2 rounded text-sm font-medium transition-all"
                style={{
                  backgroundColor: action === 'join' ? 'var(--sf-accent)' : 'transparent',
                  color: action === 'join' ? 'var(--sf-bg)' : 'var(--sf-text-muted)',
                }}
              >
                Join Room
              </button>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {mode === 'multiplayer' && action === 'join' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-5 overflow-hidden"
            >
              <label className="text-sm mb-2 block" style={{ color: 'var(--sf-text-muted)' }}>Room Code</label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                placeholder="ABCDEF"
                className="w-full rounded-md px-4 py-2.5 text-center text-2xl tracking-[0.5em] font-mono uppercase focus:outline-none transition-colors"
                style={{
                  backgroundColor: 'var(--sf-bg-tertiary)',
                  border: '1px solid var(--sf-border)',
                  color: 'var(--sf-text)',
                }}
                maxLength={6}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="text-sm mb-3 text-center" style={{ color: 'var(--sf-lose)' }}>{error}</div>
        )}

        <button
          onClick={handleSubmit}
          onMouseEnter={() => Sound.hover()}
          className="btn-premium w-full py-3 font-bold"
        >
          {mode === 'solo' ? 'Start Solo Game' : action === 'create' ? 'Create Room' : 'Join Room'}
        </button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-6 text-center text-xs max-w-md"
        style={{ color: 'var(--sf-text-muted)' }}
      >
        {mode === 'multiplayer' ? (
          <>
            <p>P2P via Trystero (WebRTC). 1–10 players. 8 casino games.</p>
            <p className="mt-1">You all start with €100. Highest balance after all rounds wins.</p>
          </>
        ) : (
          <>
            <p>Practice mode vs AI bots. Same rules, same games.</p>
            <p className="mt-1">Test all 8 casino games without needing friends online.</p>
          </>
        )}
      </motion.div>
    </div>
  );
}
