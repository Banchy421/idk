'use client';

import { useState, useEffect } from 'react';
import { useGameState } from '@/hooks/useGameState';
import { useLocalGameState } from '@/hooks/useLocalGameState';
import { LandingScreen } from '@/components/landing/LandingScreen';
import { LobbyScreen } from '@/components/lobby/LobbyScreen';
import { GameSelectScreen } from '@/components/phases/GameSelectScreen';
import { RoundTimeoutScreen } from '@/components/phases/RoundTimeoutScreen';
import { FinalVoteScreen } from '@/components/phases/FinalVoteScreen';
import { FinalCoinflipScreen } from '@/components/phases/FinalCoinflipScreen';
import { ResultsScreen } from '@/components/phases/ResultsScreen';
import { PowerSelectScreen } from '@/components/phases/PowerSelectScreen';
import { GameLayout } from '@/components/game/GameLayout';
import type { Player, GameMode } from '@/lib/types';
import { makeSelfPlayer } from '@/lib/p2p';

type Mode = 'multiplayer' | 'solo';

export default function Home() {
  const multiplayerApi = useGameState();
  const soloApi = useLocalGameState();
  // Always start with defaults to avoid hydration mismatch.
  // Saved state is loaded in a useEffect after hydration.
  const [mode, setMode] = useState<Mode>('multiplayer');
  const [view, setView] = useState<'landing' | 'game'>('landing');

  // Load saved mode/view after mount (client-only) — deferred to avoid cascading renders
  useEffect(() => {
    const soloParam = new URLSearchParams(window.location.search).get('solo') === '1';
    const savedMp = localStorage.getItem('sf-game-state');
    const savedSolo = localStorage.getItem('sf-solo-state');
    const updates: { mode?: Mode; view?: 'landing' | 'game' } = {};
    if (soloParam) {
      updates.mode = 'solo';
      if (savedSolo) updates.view = 'game';
    } else if (savedSolo && !savedMp) {
      updates.mode = 'solo';
      updates.view = 'game';
    } else if (savedMp) {
      updates.view = 'game';
    }
    if (updates.mode || updates.view) {
      queueMicrotask(() => {
        if (updates.mode) setMode(updates.mode);
        if (updates.view) setView(updates.view);
      });
    }
  }, []);

  // Use the appropriate API based on mode
  const api = mode === 'solo' ? soloApi : multiplayerApi;

  // Auto-join via ?room=CODE query param
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room && room.length === 6) {
      sessionStorage.setItem('sf-pending-join', room.toUpperCase());
      const url = new URL(window.location.href);
      url.searchParams.delete('room');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  const handleCreate = (name: string, avatar: string) => {
    if (mode === 'solo') {
      // Solo: use a synthetic ID (no P2P)
      const player: Player = {
        id: `solo-${Date.now()}`,
        name: name.slice(0, 16) || 'Player',
        avatar,
        balance: 100,
        roundBonus: 1.0,
        bailoutUsed: false,
        isHost: true,
        isEliminated: false,
        joinedAt: Date.now(),
      };
      soloApi.createRoom(player);
    } else {
      const player = makeSelfPlayer(name, avatar, true);
      multiplayerApi.createRoom(player);
    }
    setView('game');
  };

  const handleJoin = (name: string, avatar: string, code: string) => {
    if (mode === 'solo') {
      const player: Player = {
        id: `solo-${Date.now()}`,
        name: name.slice(0, 16) || 'Player',
        avatar,
        balance: 100,
        roundBonus: 1.0,
        bailoutUsed: false,
        isHost: true,
        isEliminated: false,
        joinedAt: Date.now(),
      };
      soloApi.joinRoomByCode(player, code);
    } else {
      const player = makeSelfPlayer(name, avatar, false);
      multiplayerApi.joinRoomByCode(player, code);
    }
    setView('game');
  };

  const handleLeave = () => {
    api.leave();
    setView('landing');
  };

  const handleStart = (gameMode: GameMode, powersEnabled: boolean) => {
    api.hostStartGame(gameMode, powersEnabled);
  };

  if (view === 'landing') {
    return (
      <LandingScreen
        onCreate={handleCreate}
        onJoin={handleJoin}
        mode={mode}
        onModeChange={setMode}
      />
    );
  }

  if (!api.state || Object.keys(api.state.players).length === 0 || api.connectionStatus === 'connecting') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="mb-5 inline-block">
            <div
              className="w-10 h-10 rounded-full animate-spin mx-auto"
              style={{ border: '2px solid var(--sf-border)', borderTopColor: 'var(--sf-accent)' }}
            />
          </div>
          <div className="font-display text-xl mb-2" style={{ fontWeight: 500, color: 'var(--sf-text)' }}>
            {api.connectionStatus === 'connecting' ? 'Connecting...' : 'Loading...'}
          </div>
          <div className="text-sm" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
            {mode === 'solo'
              ? 'Starting solo session'
              : api.connectionStatus === 'connecting'
                ? 'Establishing P2P connection via WebRTC. This can take 5–15 seconds.'
                : 'Loading game state'}
          </div>
          {mode === 'multiplayer' && api.connectionStatus === 'connecting' && (
            <div className="mt-4 text-xs leading-relaxed" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
              <p>Connecting to tracker servers</p>
              <p>Establishing WebRTC data channel</p>
              <p>Waiting for host response</p>
            </div>
          )}
          <button
            onClick={handleLeave}
            className="mt-5 text-xs transition-colors"
            style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}
          >
            ← Cancel
          </button>
        </div>
      </div>
    );
  }

  const phase = api.state.phase;

  return (
    <>
      {phase === 'lobby' && (
        <LobbyScreen
          state={api.state}
          self={api.self}
          isHost={api.isHost}
          roomCode={api.roomCode}
          onStart={handleStart}
          onLeave={handleLeave}
          soloMode={mode === 'solo'}
        />
      )}

      {phase === 'power-select' && (
        <PowerSelectScreen
          state={api.state}
          self={api.self}
          isHost={api.isHost}
          onSelect={api.selectPlayerPower}
          onAdvance={api.hostAdvanceFromPowerSelect}
          onLeave={handleLeave}
        />
      )}

      {phase === 'game-select' && (
        <GameSelectScreen
          state={api.state}
          self={api.self}
          isHost={api.isHost}
          onSelect={api.selectGame}
          onAdvance={api.hostAdvanceFromGameSelect}
          onLeave={handleLeave}
        />
      )}

      {phase === 'final-vote' && (
        <FinalVoteScreen
          state={api.state}
          self={api.self}
          isHost={api.isHost}
          onVote={api.finalVote}
          onAdvance={api.hostAdvanceFromFinalVote}
          onLeave={handleLeave}
        />
      )}

      {phase === 'final-coinflip' && (
        <FinalCoinflipScreen
          state={api.state}
          self={api.self}
          isHost={api.isHost}
          onResolve={api.hostResolveCoinflip}
          onLeave={handleLeave}
        />
      )}

      {phase === 'round-active' && (
        <GameLayout
          key={`round-${api.state.currentRound}`}
          state={api.state}
          self={api.self}
          isHost={api.isHost}
          onSkipVote={api.skipVote}
          onUnskipVote={api.unskipVote}
          onLiveBalance={api.sendLiveBalance}
          onRoundEndBalance={api.sendRoundEndBalance}
          onForceEndRound={api.hostForceEndRound}
          onActivatePower={api.activatePlayerPower}
          onLeave={handleLeave}
        />
      )}

      {phase === 'round-timeout' && (
        <RoundTimeoutScreen
          state={api.state}
          self={api.self}
          isHost={api.isHost}
          onBailout={api.chooseBailout}
          onAdvance={api.hostAdvanceFromRoundTimeout}
          onLeave={handleLeave}
        />
      )}

      {phase === 'results' && (
        <ResultsScreen
          state={api.state}
          self={api.self}
          isHost={api.isHost}
          onPlayAgain={api.hostPlayAgain}
          onLeave={handleLeave}
        />
      )}
    </>
  );
}
