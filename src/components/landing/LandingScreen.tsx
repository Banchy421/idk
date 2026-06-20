'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AVATARS } from '@/lib/types';
import { Sound, unlockAudio } from '@/lib/sounds';
import { cn } from '@/lib/utils';

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
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-8"
      >
        <h1 className="font-display text-6xl md:text-7xl font-bold shimmer mb-2">
          StakeFriends
        </h1>
        <p className="text-muted-foreground text-lg">
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
            <div className="flex gap-1 p-1 bg-[#0a0a0a] rounded-md border border-[#2a2a2a]">
              <button
                onClick={() => { onModeChange('multiplayer'); Sound.click(); }}
                onMouseEnter={() => Sound.hover()}
                className={cn(
                  'flex-1 py-1.5 rounded text-xs font-medium transition-all',
                  mode === 'multiplayer' ? 'bg-gold text-black' : 'text-muted-foreground hover:text-white',
                )}
              >
                👥 Multiplayer (P2P)
              </button>
              <button
                onClick={() => { onModeChange('solo'); Sound.click(); }}
                onMouseEnter={() => Sound.hover()}
                className={cn(
                  'flex-1 py-1.5 rounded text-xs font-medium transition-all',
                  mode === 'solo' ? 'bg-gold text-black' : 'text-muted-foreground hover:text-white',
                )}
              >
                🤖 Solo vs Bots
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-1.5">
              {mode === 'multiplayer'
                ? 'Play with friends over WebRTC P2P. Requires WebRTC support.'
                : 'Practice against AI bots. Same game flow, single browser.'}
            </p>
          </div>
        )}

        <div className="mb-5">
          <label className="text-sm text-muted-foreground mb-2 block">Nickname</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 16))}
            placeholder="Enter your name"
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] focus:border-gold focus:outline-none rounded-md px-4 py-2.5 text-white"
            maxLength={16}
          />
        </div>

        <div className="mb-5">
          <label className="text-sm text-muted-foreground mb-2 block">Avatar</label>
          <div className="grid grid-cols-8 gap-1.5">
            {AVATARS.map((a) => (
              <button
                key={a}
                onClick={() => { setAvatar(a); Sound.hover(); }}
                onMouseEnter={() => Sound.hover()}
                className={cn(
                  'aspect-square rounded-md text-2xl flex items-center justify-center transition-all',
                  avatar === a ? 'bg-gold bg-opacity-20 border-2 border-gold scale-105' : 'bg-[#0a0a0a] border border-[#2a2a2a] hover:border-gold'
                )}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {mode === 'multiplayer' && (
          <div className="mb-5">
            <div className="flex gap-2 p-1 bg-[#0a0a0a] rounded-md border border-[#2a2a2a]">
              <button
                onClick={() => { setAction('create'); Sound.click(); }}
                className={cn(
                  'flex-1 py-2 rounded text-sm font-medium transition-all',
                  action === 'create' ? 'bg-gold text-black' : 'text-muted-foreground hover:text-white'
                )}
              >
                Create Room
              </button>
              <button
                onClick={() => { setAction('join'); Sound.click(); }}
                className={cn(
                  'flex-1 py-2 rounded text-sm font-medium transition-all',
                  action === 'join' ? 'bg-gold text-black' : 'text-muted-foreground hover:text-white'
                )}
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
              <label className="text-sm text-muted-foreground mb-2 block">Room Code</label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                placeholder="ABCDEF"
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] focus:border-gold focus:outline-none rounded-md px-4 py-2.5 text-white text-center text-2xl tracking-[0.5em] font-mono uppercase"
                maxLength={6}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="text-lose text-sm mb-3 text-center">{error}</div>
        )}

        <button
          onClick={handleSubmit}
          onMouseEnter={() => Sound.hover()}
          className="w-full bg-gold hover:bg-gold-dark text-black font-bold py-3 rounded-md transition-all glow-gold"
        >
          {mode === 'solo' ? 'Start Solo Game' : action === 'create' ? 'Create Room' : 'Join Room'}
        </button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-6 text-center text-xs text-muted-foreground max-w-md"
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
