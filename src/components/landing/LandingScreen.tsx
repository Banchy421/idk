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
  // Always start with defaults to avoid hydration mismatch.
  // Saved values are loaded in a useEffect after hydration.
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<string>(AVATARS[0]);
  const [action, setAction] = useState<'create' | 'join'>('create');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');

  // Load saved name/avatar/joinCode after mount — deferred to avoid cascading renders
  useEffect(() => {
    const savedName = localStorage.getItem('sf-name') ?? '';
    const savedAvatar = localStorage.getItem('sf-avatar');
    const pendingJoin = sessionStorage.getItem('sf-pending-join');
    const avatarVal = savedAvatar && (AVATARS as readonly string[]).includes(savedAvatar as any)
      ? savedAvatar as string : undefined;
    queueMicrotask(() => {
      if (savedName) setName(savedName);
      if (avatarVal) setAvatar(avatarVal);
      if (pendingJoin) {
        sessionStorage.removeItem('sf-pending-join');
        setAction('join');
        setJoinCode(pendingJoin);
      }
    });
  }, []);

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

  const inputStyle: React.CSSProperties = {
    backgroundColor: 'var(--sf-bg)',
    border: '0.5px solid var(--sf-border)',
    color: 'var(--sf-text)',
    borderRadius: '6px',
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative">
      <div className="absolute top-5 right-5">
        <ThemePicker />
      </div>

      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center mb-10"
      >
        <h1 className="font-display text-5xl md:text-6xl mb-3" style={{ fontWeight: 500, color: 'var(--sf-text)' }}>
          StakeFriends
        </h1>
        <p className="text-base" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
          Real-time multiplayer casino. No backend. No accounts.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="panel p-7 w-full max-w-md"
      >
        {onModeChange && (
          <div className="mb-6">
            <div className="flex gap-0.5 p-0.5 rounded-md border" style={{ backgroundColor: 'var(--sf-bg)', borderColor: 'var(--sf-border)' }}>
              <button
                onClick={() => { onModeChange('multiplayer'); Sound.click(); }}
                className="flex-1 py-1.5 rounded text-xs transition-colors"
                style={{
                  backgroundColor: mode === 'multiplayer' ? 'var(--sf-border)' : 'transparent',
                  color: 'var(--sf-text)',
                  fontWeight: 400,
                }}
              >
                Multiplayer (P2P)
              </button>
              <button
                onClick={() => { onModeChange('solo'); Sound.click(); }}
                className="flex-1 py-1.5 rounded text-xs transition-colors"
                style={{
                  backgroundColor: mode === 'solo' ? 'var(--sf-border)' : 'transparent',
                  color: 'var(--sf-text)',
                  fontWeight: 400,
                }}
              >
                Solo vs bots
              </button>
            </div>
            <p className="text-xs text-center mt-2" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
              {mode === 'multiplayer'
                ? 'Play with friends over WebRTC P2P. Requires WebRTC support.'
                : 'Practice against AI bots. Same game flow, single browser.'}
            </p>
          </div>
        )}

        <div className="mb-6">
          <label className="text-xs mb-2 block" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>Nickname</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 16))}
            placeholder="Enter your name"
            className="w-full px-3.5 py-2.5 focus:outline-none transition-colors"
            style={inputStyle}
            maxLength={16}
          />
        </div>

        <div className="mb-6">
          <label className="text-xs mb-2 block" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>Avatar</label>
          <div className="grid grid-cols-8 gap-1">
            {AVATARS.map((a) => (
              <button
                key={a}
                onClick={() => { setAvatar(a); Sound.click(); }}
                className={cn(
                  'aspect-square rounded-md text-xl flex items-center justify-center transition-colors',
                )}
                style={{
                  backgroundColor: avatar === a ? 'var(--sf-border)' : 'var(--sf-bg)',
                  border: '0.5px solid var(--sf-border)',
                }}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {mode === 'multiplayer' && (
          <div className="mb-6">
            <div className="flex gap-0.5 p-0.5 rounded-md border" style={{ backgroundColor: 'var(--sf-bg)', borderColor: 'var(--sf-border)' }}>
              <button
                onClick={() => { setAction('create'); Sound.click(); }}
                className="flex-1 py-1.5 rounded text-xs transition-colors"
                style={{
                  backgroundColor: action === 'create' ? 'var(--sf-border)' : 'transparent',
                  color: 'var(--sf-text)',
                  fontWeight: 400,
                }}
              >
                Create room
              </button>
              <button
                onClick={() => { setAction('join'); Sound.click(); }}
                className="flex-1 py-1.5 rounded text-xs transition-colors"
                style={{
                  backgroundColor: action === 'join' ? 'var(--sf-border)' : 'transparent',
                  color: 'var(--sf-text)',
                  fontWeight: 400,
                }}
              >
                Join room
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
              className="mb-6 overflow-hidden"
            >
              <label className="text-xs mb-2 block" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>Room code</label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                placeholder="ABCDEF"
                className="w-full px-3.5 py-2.5 text-center text-xl tracking-[0.4em] font-mono uppercase focus:outline-none transition-colors"
                style={inputStyle}
                maxLength={6}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="text-sm mb-3 text-center" style={{ color: 'var(--sf-lose)', fontWeight: 400 }}>{error}</div>
        )}

        <button
          onClick={handleSubmit}
          className="btn-premium w-full py-3"
          style={{ fontSize: '14px' }}
        >
          {mode === 'solo' ? 'Start solo game' : action === 'create' ? 'Create room' : 'Join room'}
        </button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-8 text-center text-xs max-w-md leading-relaxed"
        style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}
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
