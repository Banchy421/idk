'use client';

import { useState, useEffect } from 'react';
import { useGameState } from '@/hooks/useGameState';
import { useLocalGameState } from '@/hooks/useLocalGameState';
import { LandingScreen } from '@/components/landing/LandingScreen';
import { LobbyScreen } from '@/components/lobby/LobbyScreen';
import { GameSelectScreen } from '@/components/phases/GameSelectScreen';
import { RoundTimeoutScreen } from '@/components/phases/RoundTimeoutScreen';
import { FinalVoteScreen } from '@/components/phases/FinalVoteScreen';
import { ResultsScreen } from '@/components/phases/ResultsScreen';
import { GameLayout } from '@/components/game/GameLayout';
import type { Player, GameMode } from '@/lib/types';
import { makeSelfPlayer } from '@/lib/p2p';

type Mode = 'multiplayer' | 'solo';

export default function Home() {
  const multiplayerApi = useGameState();
  const soloApi = useLocalGameState();
  // Lazy initial state — check ?solo=1 once on mount
  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === 'undefined') return 'multiplayer';
    return new URLSearchParams(window.location.search).get('solo') === '1' ? 'solo' : 'multiplayer';
  });
  const [view, setView] = useState<'landing' | 'game'>('landing');

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

  const handleStart = (gameMode: GameMode) => {
    api.hostStartGame(gameMode);
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

  if (!api.state || Object.keys(api.state.players).length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="font-display text-2xl text-gold mb-2">Connecting...</div>
          <div className="text-sm text-muted-foreground">
            {mode === 'solo' ? 'Starting solo session' : 'Establishing P2P connection'}
          </div>
          <button onClick={handleLeave} className="mt-4 text-xs text-muted-foreground hover:text-lose">
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

      {phase === 'round-active' && (
        <GameLayout
          state={api.state}
          self={api.self}
          isHost={api.isHost}
          onSkipVote={api.skipVote}
          onUnskipVote={api.unskipVote}
          onLiveBalance={api.sendLiveBalance}
          onRoundEndBalance={api.sendRoundEndBalance}
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
