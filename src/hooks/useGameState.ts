'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
  sortedPlayers,
} from '@/lib/gameLogic';
import { Sound } from '@/lib/sounds';
import { generateRoomCode } from '@/lib/utils-casino';

export interface UseGameStateApi {
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
  // player actions (safe to call by anyone; routed to host)
  selectGame: (game: GameName) => void;
  finalVote: (game: GameName) => void;
  skipVote: () => void;
  unskipVote: () => void;
  sendLiveBalance: (balance: number) => void;
  sendRoundEndBalance: (balance: number) => void;
  chooseBailout: (amount: number) => void;
}

interface P2PApi {
  selfId: string;
  sendState: (state: GameState, peerIds?: string[]) => Promise<void>;
  onState: (cb: (state: GameState, peerId: string) => void) => () => void;
  sendAction: (action: PlayerAction, peerIds?: string[]) => Promise<void>;
  onAction: (cb: (action: PlayerAction, peerId: string) => void) => () => void;
  sendHostCommand: (cmd: any, peerIds?: string[]) => Promise<void>;
  onHostCommand: (cb: (cmd: any, peerId: string) => void) => () => void;
  onPeerJoin: (cb: (peerId: string) => void) => () => void;
  onPeerLeave: (cb: (peerId: string) => void) => () => void;
  leave: () => void;
}

export function useGameState(): UseGameStateApi {
  const [state, setState] = useState<GameState | null>(null);
  const [roomCode, setRoomCode] = useState<string>('');
  const [isHost, setIsHost] = useState(false);
  const p2pRef = useRef<P2PApi | null>(null);
  const stateRef = useRef<GameState | null>(null);
  const selfRef = useRef<Player | null>(null);
  const liveBalanceRef = useRef<Record<string, number>>({});

  useEffect(() => { stateRef.current = state; }, [state]);

  /** Broadcast state to all peers (host only). */
  const broadcast = useCallback(async (next: GameState) => {
    setState(next);
    stateRef.current = next;
    if (p2pRef.current && next.hostId === p2pRef.current.selfId) {
      try { await p2pRef.current.sendState(next); } catch {}
    }
  }, []);

  /** Apply host's incoming state. */
  const applyRemoteState = useCallback((remote: GameState) => {
    setState(remote);
    stateRef.current = remote;
  }, []);

  /** Handle a player action (host-only). */
  const handleAction = useCallback(async (action: PlayerAction, peerId: string) => {
    const cur = stateRef.current;
    if (!cur) return;
    // Only host processes actions
    if (cur.hostId !== p2pRef.current?.selfId) return;
    let next = cur;
    switch (action.type) {
      case 'join': {
        if (next.players[peerId]) {
          // Update name/avatar if already present
          next = {
            ...next,
            players: {
              ...next.players,
              [peerId]: { ...next.players[peerId], name: action.name, avatar: action.avatar },
            },
          };
        } else {
          const newPlayer: Player = {
            id: peerId,
            name: action.name.slice(0, 16) || 'Player',
            avatar: action.avatar,
            balance: 100,
            roundBonus: 1.0,
            bailoutUsed: false,
            isHost: false,
            isEliminated: false,
            joinedAt: Date.now(),
          };
          next = addPlayer(next, newPlayer);
        }
        break;
      }
      case 'select-game': {
        const choices = { ...next.playerGameChoices, [peerId]: action.game };
        next = { ...next, playerGameChoices: choices };
        break;
      }
      case 'final-vote': {
        const choices = { ...next.finalVoteChoices, [peerId]: action.game };
        next = { ...next, finalVoteChoices: choices };
        break;
      }
      case 'final-pick': {
        const choices = { ...next.playerGameChoices, [peerId]: action.game };
        next = { ...next, playerGameChoices: choices };
        break;
      }
      case 'skip-vote': {
        if (!next.skipVotes.includes(peerId)) {
          next = { ...next, skipVotes: [...next.skipVotes, peerId] };
        }
        // If all non-eliminated players voted skip, end the round
        const activePlayers = Object.keys(next.players).filter((id) => !next.players[id].isEliminated);
        if (next.skipVotes.length >= activePlayers.length && next.phase === 'round-active') {
          next = skipRound(next);
          Sound.skip();
        }
        break;
      }
      case 'skip-unvote': {
        next = { ...next, skipVotes: next.skipVotes.filter((id) => id !== peerId) };
        break;
      }
      case 'live-balance': {
        liveBalanceRef.current[peerId] = action.balance;
        // Throttled merge: just update lastBalanceUpdate (UI shows updates from this)
        next = { ...next, lastBalanceUpdate: { ...next.lastBalanceUpdate, [peerId]: action.balance } };
        break;
      }
      case 'round-end-balance': {
        const balances = { ...next.roundEndBalances, [peerId]: action.balance };
        next = { ...next, roundEndBalances: balances };
        // If all non-eliminated players reported, collect & advance to timeout
        const activePlayers = Object.keys(next.players).filter((id) => !next.players[id].isEliminated);
        if (Object.keys(balances).length >= activePlayers.length && next.phase === 'round-active') {
          next = collectRoundEndBalances(next, balances);
          next = startRoundTimeout(next);
          Sound.fanfare();
        }
        break;
      }
      case 'bailout-choice': {
        next = applyBailout(next, peerId, action.amount);
        Sound.bailout();
        break;
      }
      case 'start-game': {
        if (peerId === next.hostId) {
          next = startGameSelect({ ...next, gameMode: action.mode, totalRounds: action.mode === 'standard' ? 3 : 6 });
        }
        break;
      }
      case 'play-again': {
        if (peerId === next.hostId) {
          next = resetForPlayAgain(next);
        }
        break;
      }
    }
    if (next !== cur) {
      await broadcast(next);
    }
  }, [broadcast]);

  const handleHostCommand = useCallback(async (cmd: any, peerId: string) => {
    const cur = stateRef.current;
    if (!cur) return;
    if (cmd.type === 'request-round-end-balance') {
      // Host asking all players for their final round balance
      // Each player will respond via 'round-end-balance' action — handled in the game components / GameLayout.
    } else if (cmd.type === 'request-live-balance') {
      // Periodic live balance request — handled by GameLayout
    }
  }, []);

  /** Create a room as host. */
  const createRoom = useCallback((player: Player): string => {
    const code = generateRoomCode();
    setRoomCode(code);
    setIsHost(true);
    selfRef.current = player;
    // dynamic import to avoid SSR
    import('@/lib/p2p').then(({ joinGameRoom }) => {
      const p2p = joinGameRoom(code) as unknown as P2PApi;
      p2pRef.current = p2p;
      p2p.onState(applyRemoteState);
      p2p.onAction(handleAction);
      p2p.onHostCommand(handleHostCommand);
      p2p.onPeerJoin((peerId) => {
        Sound.join();
        // Host: send current state to the new peer so they can sync
        const cur = stateRef.current;
        if (cur) {
          void p2p.sendState(cur, [peerId]);
        }
      });
      p2p.onPeerLeave((peerId) => {
        Sound.leave();
        const cur = stateRef.current;
        if (cur && cur.hostId === p2p.selfId) {
          void broadcast(removePlayer(cur, peerId));
        }
      });
      const initial = makeInitialState(player, 'standard');
      void broadcast(initial);
    });
    return code;
  }, [applyRemoteState, handleAction, handleHostCommand, broadcast]);

  /** Join an existing room as guest. */
  const joinRoomByCode = useCallback((player: Player, code: string) => {
    setRoomCode(code);
    setIsHost(false);
    selfRef.current = player;
    import('@/lib/p2p').then(({ joinGameRoom }) => {
      const p2p = joinGameRoom(code) as unknown as P2PApi;
      p2pRef.current = p2p;
      p2p.onState(applyRemoteState);
      p2p.onAction(handleAction);
      p2p.onHostCommand(handleHostCommand);
      p2p.onPeerJoin(() => {
        // Send our join info to host (and any other peers; only host will act on it)
        void p2p.sendAction({ type: 'join', name: player.name, avatar: player.avatar });
      });
      p2p.onPeerLeave(() => {
        Sound.leave();
      });
      // Also send immediately in case host already exists
      setTimeout(() => {
        void p2p.sendAction({ type: 'join', name: player.name, avatar: player.avatar });
      }, 500);
    });
  }, [applyRemoteState, handleAction, handleHostCommand]);

  // Add a join mechanism: guests send player info via a custom action
  // We'll extend the action dispatch above. To keep types clean, we add a 'join' action type at runtime.

  const leave = useCallback(() => {
    p2pRef.current?.leave();
    p2pRef.current = null;
    setState(null);
    setRoomCode('');
    setIsHost(false);
  }, []);

  // HOST ACTIONS
  const hostStartGame = useCallback((mode: GameMode) => {
    const cur = stateRef.current;
    if (!cur || !isHost) return;
    const next = startGameSelect({
      ...cur,
      gameMode: mode,
      totalRounds: mode === 'standard' ? 3 : 6,
    });
    void broadcast(next);
  }, [isHost, broadcast]);

  const hostAdvanceFromGameSelect = useCallback(() => {
    const cur = stateRef.current;
    if (!cur || !isHost) return;
    const next = resolveGameSelect(cur);
    void broadcast(next);
  }, [isHost, broadcast]);

  const hostAdvanceFromFinalVote = useCallback(() => {
    const cur = stateRef.current;
    if (!cur || !isHost) return;
    const next = resolveFinalVote(cur);
    void broadcast(next);
  }, [isHost, broadcast]);

  const hostAdvanceFromRoundTimeout = useCallback(() => {
    const cur = stateRef.current;
    if (!cur || !isHost) return;
    // Apply bailout defaults for players who didn't choose
    let next = cur;
    for (const pid of cur.bailoutPending) {
      next = applyBailout(next, pid, 50); // default €50
    }
    // Mark eliminated players who still have 0 balance after bailout
    const players = { ...next.players };
    for (const pid of Object.keys(players)) {
      if (players[pid].balance <= 0 && !players[pid].bailoutUsed) {
        // give them €50 default bailout
        players[pid] = { ...players[pid], balance: 50, bailoutUsed: true, roundBonus: 0.9 };
      }
      if (players[pid].balance <= 0) {
        players[pid] = { ...players[pid], isEliminated: true, balance: 0 };
      }
    }
    next = { ...next, players, bailoutPending: [] };
    const advanced = advanceAfterTimeout(next);
    void broadcast(advanced);
  }, [isHost, broadcast]);

  const hostSkipRound = useCallback(() => {
    const cur = stateRef.current;
    if (!cur || !isHost) return;
    void broadcast(skipRound(cur));
  }, [isHost, broadcast]);

  const hostPlayAgain = useCallback(() => {
    const cur = stateRef.current;
    if (!cur || !isHost) return;
    void broadcast(resetForPlayAgain(cur));
  }, [isHost, broadcast]);

  // PLAYER ACTIONS (routed to host)
  const selectGame = useCallback((game: GameName) => {
    p2pRef.current?.sendAction({ type: 'select-game', game });
  }, []);

  const finalVote = useCallback((game: GameName) => {
    p2pRef.current?.sendAction({ type: 'final-vote', game });
  }, []);

  const skipVote = useCallback(() => {
    p2pRef.current?.sendAction({ type: 'skip-vote' });
  }, []);

  const unskipVote = useCallback(() => {
    p2pRef.current?.sendAction({ type: 'skip-unvote' });
  }, []);

  const sendLiveBalance = useCallback((balance: number) => {
    p2pRef.current?.sendAction({ type: 'live-balance', balance });
  }, []);

  const sendRoundEndBalance = useCallback((balance: number) => {
    p2pRef.current?.sendAction({ type: 'round-end-balance', balance });
  }, []);

  const chooseBailout = useCallback((amount: number) => {
    p2pRef.current?.sendAction({ type: 'bailout-choice', amount });
  }, []);

  // Detect self in state
  const selfId = p2pRef.current?.selfId ?? '';
  const self = state && selfId ? state.players[selfId] ?? null : null;

  // When state arrives and we don't have our self in it, send a synthetic 'join' action via live-balance.
  // Actually, the host needs to know our name/avatar. We'll piggyback via 'select-game' style — but we need player info.
  // The cleanest fix: host sends 'request-info' on peer join, peer replies with their info in 'live-balance' wrapper.
  // We'll implement a separate 'join' message channel via the existing PlayerAction union (extend at runtime).

  return {
    state: state ?? makeInitialState({ id: '', name: '', avatar: '🦊', balance: 100, roundBonus: 1, bailoutUsed: false, isHost: false, isEliminated: false, joinedAt: 0 }, 'standard'),
    isHost,
    selfId,
    self,
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
