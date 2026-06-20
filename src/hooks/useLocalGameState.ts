'use client';

// Local solo-mode implementation of useGameState.
// Mirrors the same API as useGameState but everything runs in a single browser.
// Useful for testing the game flow without P2P, and as a fallback for environments
// where WebRTC data channels aren't fully supported.

import { useState, useCallback, useEffect, useRef } from 'react';
import type { GameState, Player, PlayerAction, GameMode, GameName } from '@/lib/types';
import {
  makeInitialState,
  addPlayer,
  removePlayer,
  startGameSelect,
  resolveGameSelect,
  startFinalVote,
  resolveFinalVote,
  startRoundTimeout,
  applyBailout,
  collectRoundEndBalances,
  advanceAfterTimeout,
  skipRound,
  resetForPlayAgain,
} from '@/lib/gameLogic';
import { Sound } from '@/lib/sounds';
import { generateRoomCode, randomSeed } from '@/lib/utils-casino';

export interface UseLocalGameStateApi {
  state: GameState;
  isHost: boolean;
  selfId: string;
  self: Player | null;
  roomCode: string;
  // actions
  createRoom: (player: Player) => string;
  joinRoomByCode: (player: Player, code: string) => void;
  leave: () => void;
  // host actions
  hostStartGame: (mode: GameMode) => void;
  hostAdvanceFromGameSelect: () => void;
  hostAdvanceFromFinalVote: () => void;
  hostAdvanceFromRoundTimeout: () => void;
  hostSkipRound: () => void;
  hostPlayAgain: () => void;
  // player actions
  selectGame: (game: GameName) => void;
  finalVote: (game: GameName) => void;
  skipVote: () => void;
  unskipVote: () => void;
  sendLiveBalance: (balance: number) => void;
  sendRoundEndBalance: (balance: number) => void;
  chooseBailout: (amount: number) => void;
}

const SOLO_BOT_NAMES = ['Bot Alex', 'Bot Sam', 'Bot Jordan', 'Bot Casey', 'Bot Riley'];
const SOLO_BOT_AVATARS = ['🐯', '🦁', '🐺', '🐉', '🦅'];

export function useLocalGameState(): UseLocalGameStateApi {
  const [state, setState] = useState<GameState | null>(null);
  const [roomCode, setRoomCode] = useState<string>('');
  const [isHost, setIsHost] = useState(false);
  const [selfId, setSelfId] = useState<string>('');
  const stateRef = useRef<GameState | null>(null);
  const selfRef = useRef<Player | null>(null);

  useEffect(() => { stateRef.current = state; }, [state]);

  const broadcast = useCallback((next: GameState) => {
    setState(next);
    stateRef.current = next;
  }, []);

  const createRoom = useCallback((player: Player): string => {
    const code = generateRoomCode();
    setRoomCode(code);
    setIsHost(true);
    setSelfId(player.id);
    selfRef.current = player;
    const initial = makeInitialState(player, 'standard');
    broadcast(initial);
    return code;
  }, [broadcast]);

  const joinRoomByCode = useCallback((player: Player, code: string) => {
    // Local mode: joining just creates a new solo room with the same code
    setRoomCode(code);
    setIsHost(true); // In solo mode, the joiner becomes host of their own session
    setSelfId(player.id);
    selfRef.current = player;
    const initial = makeInitialState(player, 'standard');
    broadcast(initial);
  }, [broadcast]);

  const leave = useCallback(() => {
    setState(null);
    setRoomCode('');
    setIsHost(false);
    setSelfId('');
    selfRef.current = null;
  }, []);

  const hostStartGame = useCallback((mode: GameMode) => {
    const cur = stateRef.current;
    if (!cur) return;
    // Spawn 2 bot opponents in solo mode for testing
    let next = { ...cur, gameMode: mode, totalRounds: mode === 'standard' ? 3 : 6 };
    for (let i = 0; i < 2; i++) {
      const bot: Player = {
        id: `bot-${i}-${Date.now()}`,
        name: SOLO_BOT_NAMES[i],
        avatar: SOLO_BOT_AVATARS[i],
        balance: 100,
        roundBonus: 1.0,
        bailoutUsed: false,
        isHost: false,
        isEliminated: false,
        joinedAt: Date.now() + i,
      };
      next = addPlayer(next, bot);
    }
    next = startGameSelect(next);
    Sound.fanfare();
    broadcast(next);
  }, [broadcast]);

  const hostAdvanceFromGameSelect = useCallback(() => {
    const cur = stateRef.current;
    if (!cur) return;
    // Auto-pick for bots
    let next = cur;
    for (const pid of Object.keys(next.players)) {
      if (pid.startsWith('bot-') && !next.playerGameChoices[pid]) {
        const pool = next.availableGames;
        next = {
          ...next,
          playerGameChoices: { ...next.playerGameChoices, [pid]: pool[Math.floor(Math.random() * pool.length)] },
        };
      }
    }
    next = resolveGameSelect(next);
    broadcast(next);
  }, [broadcast]);

  const hostAdvanceFromFinalVote = useCallback(() => {
    const cur = stateRef.current;
    if (!cur) return;
    // Auto-vote for bots
    let next = cur;
    for (const pid of Object.keys(next.players)) {
      if (pid.startsWith('bot-') && !next.finalVoteChoices[pid]) {
        next = {
          ...next,
          finalVoteChoices: { ...next.finalVoteChoices, [pid]: next.finalVoteOptions[Math.floor(Math.random() * next.finalVoteOptions.length)] },
        };
      }
    }
    next = resolveFinalVote(next);
    broadcast(next);
  }, [broadcast]);

  const hostAdvanceFromRoundTimeout = useCallback(() => {
    const cur = stateRef.current;
    if (!cur) return;
    let next = cur;
    for (const pid of cur.bailoutPending) {
      next = applyBailout(next, pid, 50);
    }
    const players = { ...next.players };
    for (const pid of Object.keys(players)) {
      if (players[pid].balance <= 0 && !players[pid].bailoutUsed) {
        players[pid] = { ...players[pid], balance: 50, bailoutUsed: true, roundBonus: 0.9 };
      }
      if (players[pid].balance <= 0) {
        players[pid] = { ...players[pid], isEliminated: true, balance: 0 };
      }
    }
    next = { ...next, players, bailoutPending: [] };
    const advanced = advanceAfterTimeout(next);
    if (advanced.phase === 'game-select' || advanced.phase === 'final-vote') {
      Sound.fanfare();
    }
    broadcast(advanced);
  }, [broadcast]);

  const hostSkipRound = useCallback(() => {
    const cur = stateRef.current;
    if (!cur) return;
    broadcast(skipRound(cur));
  }, [broadcast]);

  const hostPlayAgain = useCallback(() => {
    const cur = stateRef.current;
    if (!cur) return;
    broadcast(resetForPlayAgain(cur));
  }, [broadcast]);

  const selectGame = useCallback((game: GameName) => {
    const cur = stateRef.current;
    if (!cur || !selfRef.current) return;
    broadcast({
      ...cur,
      playerGameChoices: { ...cur.playerGameChoices, [selfRef.current.id]: game },
    });
  }, [broadcast]);

  const finalVote = useCallback((game: GameName) => {
    const cur = stateRef.current;
    if (!cur || !selfRef.current) return;
    broadcast({
      ...cur,
      finalVoteChoices: { ...cur.finalVoteChoices, [selfRef.current.id]: game },
    });
  }, [broadcast]);

  const skipVote = useCallback(() => {
    const cur = stateRef.current;
    if (!cur || !selfRef.current) return;
    let next = {
      ...cur,
      skipVotes: [...cur.skipVotes, selfRef.current.id],
    };
    // Also auto-vote bots
    for (const pid of Object.keys(cur.players)) {
      if (pid.startsWith('bot-') && !next.skipVotes.includes(pid)) {
        if (Math.random() < 0.3) {
          next.skipVotes = [...next.skipVotes, pid];
        }
      }
    }
    const activePlayers = Object.keys(next.players).filter((id) => !next.players[id].isEliminated);
    if (next.skipVotes.length >= activePlayers.length && next.phase === 'round-active') {
      next = skipRound(next);
      Sound.skip();
    }
    broadcast(next);
  }, [broadcast]);

  const unskipVote = useCallback(() => {
    const cur = stateRef.current;
    if (!cur || !selfRef.current) return;
    broadcast({
      ...cur,
      skipVotes: cur.skipVotes.filter((id) => id !== selfRef.current.id),
    });
  }, [broadcast]);

  const sendLiveBalance = useCallback((balance: number) => {
    const cur = stateRef.current;
    if (!cur || !selfRef.current) return;
    broadcast({
      ...cur,
      lastBalanceUpdate: { ...cur.lastBalanceUpdate, [selfRef.current.id]: balance },
    });
  }, [broadcast]);

  const sendRoundEndBalance = useCallback((balance: number) => {
    const cur = stateRef.current;
    if (!cur || !selfRef.current) return;
    // Collect bot balances (simulated)
    const balances: Record<string, number> = { [selfRef.current.id]: balance };
    for (const pid of Object.keys(cur.players)) {
      if (pid.startsWith('bot-')) {
        // Bots play randomly — their balance fluctuates
        const baseBalance = cur.lastBalanceUpdate[pid] ?? cur.players[pid].balance;
        const variance = (Math.random() - 0.5) * 50;
        balances[pid] = Math.max(0, Math.round((baseBalance + variance) * 100) / 100);
      }
    }
    let next = collectRoundEndBalances(cur, balances);
    next = startRoundTimeout(next);
    Sound.fanfare();
    broadcast(next);
  }, [broadcast]);

  const chooseBailout = useCallback((amount: number) => {
    const cur = stateRef.current;
    if (!cur || !selfRef.current) return;
    broadcast(applyBailout(cur, selfRef.current.id, amount));
  }, [broadcast]);

  // Auto-advance from game-select when timer hits 0 — handled by useTimer in components.
  // But we also need to auto-pick for the player if they didn't pick:
  // resolveGameSelect handles that.

  // Provide a stable empty state for SSR
  const fallbackPlayer: Player = {
    id: '', name: '', avatar: '🦊', balance: 100, roundBonus: 1, bailoutUsed: false,
    isHost: false, isEliminated: false, joinedAt: 0,
  };

  return {
    state: state ?? makeInitialState(fallbackPlayer, 'standard'),
    isHost,
    selfId,
    self: state && selfId ? state.players[selfId] ?? null : null,
    roomCode,
    createRoom,
    joinRoomByCode,
    leave,
    hostStartGame,
    hostAdvanceFromGameSelect,
    hostAdvanceFromFinalVote,
    hostAdvanceFromRoundTimeout,
    hostSkipRound,
    hostPlayAgain,
    selectGame,
    finalVote,
    skipVote,
    unskipVote,
    sendLiveBalance,
    sendRoundEndBalance,
    chooseBailout,
  };
}
