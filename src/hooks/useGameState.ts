'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { GameState, Player, PlayerAction, GameMode, GameName, PowerType } from '@/lib/types';
import {
  makeInitialState,
  addPlayer,
  removePlayer,
  startGameSelect,
  resolveGameSelect,
  startFinalVote,
  resolveFinalVote,
  resolveCoinflip,
  startRoundTimeout,
  applyBailout,
  collectRoundEndBalances,
  endRound,
  advanceAfterTimeout,
  skipRound,
  resetForPlayAgain,
  sortedPlayers,
  startPowerSelect,
  resolvePowerSelect,
  selectPower,
  activatePower,
} from '@/lib/gameLogic';
import { Sound } from '@/lib/sounds';
import { generateRoomCode } from '@/lib/utils-casino';

export interface UseGameStateApi {
  state: GameState;
  isHost: boolean;
  selfId: string;
  self: Player | null;
  roomCode: string;
  connectionStatus: 'idle' | 'connecting' | 'connected';
  // actions
  createRoom: (player: Player) => string;
  joinRoomByCode: (player: Player, code: string) => void;
  leave: () => void;
  // host actions
  hostStartGame: (mode: GameMode, powersEnabled: boolean) => void;
  hostAdvanceFromGameSelect: () => void;
  hostAdvanceFromPowerSelect: () => void;
  hostAdvanceFromFinalVote: () => void;
  hostResolveCoinflip: () => void;
  hostAdvanceFromRoundTimeout: () => void;
  hostSkipRound: () => void;
  hostForceEndRound: () => void;
  hostPlayAgain: () => void;
  // player actions (safe to call by anyone; routed to host)
  selectGame: (game: GameName) => void;
  finalVote: (game: GameName) => void;
  skipVote: () => void;
  unskipVote: () => void;
  sendLiveBalance: (balance: number) => void;
  sendRoundEndBalance: (balance: number) => void;
  chooseBailout: (amount: number) => void;
  selectPlayerPower: (power: PowerType) => void;
  activatePlayerPower: (targetId?: string) => void;
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
  const [selfId, setSelfId] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected'>('idle');
  const p2pRef = useRef<P2PApi | null>(null);
  const stateRef = useRef<GameState | null>(null);
  const selfRef = useRef<Player | null>(null);
  const liveBalanceRef = useRef<Record<string, number>>({});
  const joinRetryRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roundEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { stateRef.current = state; }, [state]);

  // Save state to localStorage for refresh persistence
  useEffect(() => {
    if (state && roomCode) {
      try {
        localStorage.setItem('sf-game-state', JSON.stringify(state));
        localStorage.setItem('sf-room-code', roomCode);
        localStorage.setItem('sf-is-host', isHost ? '1' : '0');
        if (selfRef.current) {
          localStorage.setItem('sf-self-player', JSON.stringify(selfRef.current));
        }
      } catch {}
    }
  }, [state, roomCode, isHost]);

  // Restore state on mount (for refresh persistence)
  useEffect(() => {
    try {
      const savedState = localStorage.getItem('sf-game-state');
      const savedRoomCode = localStorage.getItem('sf-room-code');
      const savedIsHost = localStorage.getItem('sf-is-host') === '1';
      const savedSelf = localStorage.getItem('sf-self-player');
      if (savedState && savedRoomCode) {
        const parsedState = JSON.parse(savedState) as GameState;
        const parsedSelf = savedSelf ? JSON.parse(savedSelf) as Player : null;
        // Defer state updates to avoid cascading renders
        queueMicrotask(() => {
          stateRef.current = parsedState;
          if (parsedSelf) selfRef.current = parsedSelf;
          setState(parsedState);
          setRoomCode(savedRoomCode);
          setIsHost(savedIsHost);
          if (parsedSelf) setSelfId(parsedSelf.id);
          setConnectionStatus(savedIsHost ? 'connected' : 'connecting');
        });
        // Reconnect to the P2P room
        if (parsedSelf) {
          import('@/lib/p2p').then(({ joinGameRoom }) => {
            const p2p = joinGameRoom(savedRoomCode) as unknown as P2PApi;
            p2pRef.current = p2p;
            p2p.onState(applyRemoteState);
            p2p.onAction(handleAction);
            p2p.onHostCommand(handleHostCommand);
            p2p.onPeerJoin((peerId) => {
              Sound.join();
              setConnectionStatus('connected');
              const cur = stateRef.current;
              if (cur && savedIsHost) {
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
            // Send join action to re-announce ourselves
            setTimeout(() => {
              void p2p.sendAction({ type: 'join', name: parsedSelf.name, avatar: parsedSelf.avatar });
            }, 500);
          });
        }
      }
    } catch {}
  }, []);

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
        // Guard: if we're no longer in final-vote phase, ignore late votes
        // (prevents race condition when both players vote simultaneously)
        if (next.phase !== 'final-vote') break;
        const choices = { ...next.finalVoteChoices, [peerId]: action.game };
        next = { ...next, finalVoteChoices: choices };
        // Auto-resolve if all active players have voted (don't wait for timer)
        const activePlayers = Object.keys(next.players).filter((id) => !next.players[id].isEliminated);
        if (Object.keys(choices).length >= activePlayers.length && next.phase === 'final-vote') {
          next = resolveFinalVote(next);
          if (next.phase === 'final-coinflip') {
            Sound.coinSpin();
          } else {
            Sound.fanfare();
          }
        }
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
          // All balances received — advance immediately
          if (roundEndTimeoutRef.current) {
            clearTimeout(roundEndTimeoutRef.current);
            roundEndTimeoutRef.current = null;
          }
          next = endRound(next, balances);
          Sound.fanfare();
        } else if (next.phase === 'round-active' && !roundEndTimeoutRef.current) {
          // Not all balances received — start a 5s fallback timeout.
          // If it fires, fill in missing balances with last-known live values
          // and force-advance. This prevents the round from getting stuck if
          // a guest's P2P message is delayed or lost.
          roundEndTimeoutRef.current = setTimeout(() => {
            roundEndTimeoutRef.current = null;
            const cur2 = stateRef.current;
            if (!cur2 || cur2.phase !== 'round-active') return;
            const active2 = Object.keys(cur2.players).filter((id) => !cur2.players[id].isEliminated);
            if (Object.keys(cur2.roundEndBalances).length >= active2.length) return; // Already advanced
            // Fill in missing balances with last-known live balance (or current state balance)
            const fallback: Record<string, number> = {};
            for (const pid of active2) {
              fallback[pid] = cur2.roundEndBalances[pid]
                ?? cur2.lastBalanceUpdate[pid]
                ?? cur2.players[pid].balance;
            }
            console.log('[StakeFriends] Round-end fallback: force-advancing with', fallback);
            const next2 = endRound(cur2, fallback);
            Sound.fanfare();
            void broadcast(next2);
          }, 5000);
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
          const base = { ...next, gameMode: action.mode, totalRounds: action.mode === 'standard' ? 3 : 6, powersEnabled: action.powersEnabled };
          if (action.powersEnabled) {
            next = startPowerSelect(base);
          } else {
            next = startGameSelect(base);
          }
        }
        break;
      }
      case 'select-power': {
        if (next.phase !== 'power-select') break;
        next = selectPower(next, peerId, action.power);
        // Check if all players selected
        const active = Object.keys(next.players).filter((id) => !next.players[id].isEliminated);
        if (active.every((id) => next.powerSelections[id])) {
          next = resolvePowerSelect(next);
          Sound.fanfare();
        }
        break;
      }
      case 'activate-power': {
        if (next.phase !== 'round-active') break;
        next = activatePower(next, peerId, action.targetId);
        Sound.cashRegister();
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
    setSelfId(player.id);
    setConnectionStatus('connecting');
    selfRef.current = player;
    // dynamic import to avoid SSR
    import('@/lib/p2p').then(({ joinGameRoom, selfId: p2pSelfId }) => {
      // Use the actual trystero selfId, not the placeholder
      const actualSelfId = p2pSelfId;
      setSelfId(actualSelfId);
      const playerWithCorrectId: Player = { ...player, id: actualSelfId };
      selfRef.current = playerWithCorrectId;

      const p2p = joinGameRoom(code) as unknown as P2PApi;
      p2pRef.current = p2p;
      p2p.onState(applyRemoteState);
      p2p.onAction(handleAction);
      p2p.onHostCommand(handleHostCommand);
      p2p.onPeerJoin((peerId) => {
        Sound.join();
        setConnectionStatus('connected');
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
      const initial = makeInitialState(playerWithCorrectId, 'standard');
      void broadcast(initial);
      setConnectionStatus('connected'); // host is immediately "connected"
    });
    return code;
  }, [applyRemoteState, handleAction, handleHostCommand, broadcast]);

  /** Join an existing room as guest. */
  const joinRoomByCode = useCallback((player: Player, code: string) => {
    setRoomCode(code);
    setIsHost(false);
    setConnectionStatus('connecting');
    selfRef.current = player;
    import('@/lib/p2p').then(({ joinGameRoom, selfId: p2pSelfId }) => {
      const actualSelfId = p2pSelfId;
      setSelfId(actualSelfId);
      selfRef.current = { ...player, id: actualSelfId };

      const p2p = joinGameRoom(code) as unknown as P2PApi;
      p2pRef.current = p2p;
      p2p.onState((remote) => {
        // Once we receive state from the host, we're connected
        setConnectionStatus('connected');
        applyRemoteState(remote);
      });
      p2p.onAction(handleAction);
      p2p.onHostCommand(handleHostCommand);
      p2p.onPeerJoin(() => {
        // Send our join info to host whenever a peer (the host) joins
        void p2p.sendAction({ type: 'join', name: player.name, avatar: player.avatar });
      });
      p2p.onPeerLeave(() => {
        Sound.leave();
      });

      // Retry sending the join action every 1.5s for up to 30s, in case the
      // host isn't connected yet on the first attempt. Stop once we appear
      // in the player list (state.players contains our id).
      let attempts = 0;
      const maxAttempts = 20;
      const sendJoin = () => {
        const cur = stateRef.current;
        if (cur && cur.players[actualSelfId]) {
          // We're in the player list — stop retrying
          if (joinRetryRef.current) {
            clearInterval(joinRetryRef.current);
            joinRetryRef.current = null;
          }
          return;
        }
        void p2p.sendAction({ type: 'join', name: player.name, avatar: player.avatar });
        attempts++;
        if (attempts >= maxAttempts && joinRetryRef.current) {
          clearInterval(joinRetryRef.current);
          joinRetryRef.current = null;
        }
      };
      // Send immediately, then retry periodically
      sendJoin();
      joinRetryRef.current = setInterval(sendJoin, 1500);
    });
  }, [applyRemoteState, handleAction, handleHostCommand]);

  // Clean up the join retry interval on unmount
  useEffect(() => {
    return () => {
      if (joinRetryRef.current) {
        clearInterval(joinRetryRef.current);
        joinRetryRef.current = null;
      }
    };
  }, []);

  // Add a join mechanism: guests send player info via a custom action
  // We'll extend the action dispatch above. To keep types clean, we add a 'join' action type at runtime.

  const leave = useCallback(() => {
    if (joinRetryRef.current) {
      clearInterval(joinRetryRef.current);
      joinRetryRef.current = null;
    }
    if (roundEndTimeoutRef.current) {
      clearTimeout(roundEndTimeoutRef.current);
      roundEndTimeoutRef.current = null;
    }
    p2pRef.current?.leave();
    p2pRef.current = null;
    setState(null);
    setRoomCode('');
    setIsHost(false);
    setSelfId('');
    setConnectionStatus('idle');
    // Clear persisted state
    try {
      localStorage.removeItem('sf-game-state');
      localStorage.removeItem('sf-room-code');
      localStorage.removeItem('sf-is-host');
      localStorage.removeItem('sf-self-player');
    } catch {}
  }, []);

  // HOST ACTIONS
  const hostStartGame = useCallback((mode: GameMode, powersEnabled: boolean) => {
    const cur = stateRef.current;
    if (!cur || !isHost) return;
    const base = { ...cur, gameMode: mode, totalRounds: mode === 'standard' ? 3 : 6, powersEnabled };
    if (powersEnabled) {
      void broadcast(startPowerSelect(base));
    } else {
      void broadcast(startGameSelect(base));
    }
  }, [isHost, broadcast]);

  const hostAdvanceFromGameSelect = useCallback(() => {
    const cur = stateRef.current;
    if (!cur || !isHost) return;
    const next = resolveGameSelect(cur);
    void broadcast(next);
  }, [isHost, broadcast]);

  const hostAdvanceFromPowerSelect = useCallback(() => {
    const cur = stateRef.current;
    if (!cur || !isHost) return;
    if (cur.phase !== 'power-select') return;
    const next = resolvePowerSelect(cur);
    void broadcast(next);
  }, [isHost, broadcast]);

  const hostAdvanceFromFinalVote = useCallback(() => {
    const cur = stateRef.current;
    if (!cur || !isHost) return;
    const next = resolveFinalVote(cur);
    void broadcast(next);
  }, [isHost, broadcast]);

  const hostResolveCoinflip = useCallback(() => {
    const cur = stateRef.current;
    if (!cur || !isHost) return;
    if (cur.phase !== 'final-coinflip') return;
    const next = resolveCoinflip(cur);
    Sound.coinLand();
    Sound.fanfare();
    void broadcast(next);
  }, [isHost, broadcast]);

  const hostAdvanceFromRoundTimeout = useCallback(() => {
    const cur = stateRef.current;
    if (!cur || !isHost) return;
    // Apply bailout defaults for players who didn't choose (auto €50)
    let next = cur;
    for (const pid of cur.bailoutPending) {
      next = applyBailout(next, pid, 50);
    }
    // Mark eliminated players who still have 0 balance after bailout
    const players = { ...next.players };
    for (const pid of Object.keys(players)) {
      if (players[pid].balance <= 0 && !players[pid].bailoutUsed) {
        // give them €50 default bailout (also queues the penalty)
        next = applyBailout(next, pid, 50);
      }
    }
    // Re-read after applyBailout may have mutated
    const playersAfter = { ...next.players };
    for (const pid of Object.keys(playersAfter)) {
      if (playersAfter[pid].balance <= 0) {
        playersAfter[pid] = { ...playersAfter[pid], isEliminated: true, balance: 0 };
      }
    }
    next = { ...next, players: playersAfter, bailoutPending: [] };
    const advanced = advanceAfterTimeout(next);
    void broadcast(advanced);
  }, [isHost, broadcast]);

  const hostSkipRound = useCallback(() => {
    const cur = stateRef.current;
    if (!cur || !isHost) return;
    void broadcast(skipRound(cur));
  }, [isHost, broadcast]);

  /** Host can force-end a round that's stuck (e.g. guest disconnected). */
  const hostForceEndRound = useCallback(() => {
    const cur = stateRef.current;
    if (!cur || !isHost) return;
    if (cur.phase !== 'round-active') return;
    // Collect all balances from last-known live values
    const activePlayers = Object.keys(cur.players).filter((id) => !cur.players[id].isEliminated);
    const fallback: Record<string, number> = {};
    for (const pid of activePlayers) {
      fallback[pid] = cur.roundEndBalances[pid]
        ?? cur.lastBalanceUpdate[pid]
        ?? cur.players[pid].balance;
    }
    if (roundEndTimeoutRef.current) {
      clearTimeout(roundEndTimeoutRef.current);
      roundEndTimeoutRef.current = null;
    }
    const next = endRound(cur, fallback);
    Sound.fanfare();
    void broadcast(next);
  }, [isHost, broadcast]);

  const hostPlayAgain = useCallback(() => {
    const cur = stateRef.current;
    if (!cur || !isHost) return;
    void broadcast(resetForPlayAgain(cur));
  }, [isHost, broadcast]);

  // PLAYER ACTIONS
  // Always call handleAction locally (it self-no-ops if we're not the host via the
  // `cur.hostId !== p2pRef.current?.selfId` check) AND always send via P2P.
  // This avoids stale `isHost` closure issues — the authority check is inside
  // handleAction itself, not in the dispatch layer.
  const dispatchPlayerAction = useCallback((action: PlayerAction) => {
    const p2p = p2pRef.current;
    if (!p2p) return;
    // Process locally — handleAction returns early if we're not the host
    if (selfRef.current) {
      void handleAction(action, selfRef.current.id);
    }
    // Also send to all peers — host receives & processes; guests ignore
    void p2p.sendAction(action);
  }, [handleAction]);

  const selectGame = useCallback((game: GameName) => {
    dispatchPlayerAction({ type: 'select-game', game });
  }, [dispatchPlayerAction]);

  const finalVote = useCallback((game: GameName) => {
    dispatchPlayerAction({ type: 'final-vote', game });
  }, [dispatchPlayerAction]);

  const skipVote = useCallback(() => {
    dispatchPlayerAction({ type: 'skip-vote' });
  }, [dispatchPlayerAction]);

  const unskipVote = useCallback(() => {
    dispatchPlayerAction({ type: 'skip-unvote' });
  }, [dispatchPlayerAction]);

  const sendLiveBalance = useCallback((balance: number) => {
    dispatchPlayerAction({ type: 'live-balance', balance });
  }, [dispatchPlayerAction]);

  const sendRoundEndBalance = useCallback((balance: number) => {
    dispatchPlayerAction({ type: 'round-end-balance', balance });
  }, [dispatchPlayerAction]);

  const chooseBailout = useCallback((amount: number) => {
    dispatchPlayerAction({ type: 'bailout-choice', amount });
  }, [dispatchPlayerAction]);

  const selectPlayerPower = useCallback((power: PowerType) => {
    dispatchPlayerAction({ type: 'select-power', power });
  }, [dispatchPlayerAction]);

  const activatePlayerPower = useCallback((targetId?: string) => {
    dispatchPlayerAction({ type: 'activate-power', targetId });
  }, [dispatchPlayerAction]);

  // Detect self in state
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
    connectionStatus,
    createRoom,
    joinRoomByCode,
    leave,
    hostStartGame,
    hostAdvanceFromGameSelect,
    hostAdvanceFromPowerSelect,
    hostAdvanceFromFinalVote,
    hostResolveCoinflip,
    hostAdvanceFromRoundTimeout,
    hostSkipRound,
    hostForceEndRound,
    hostPlayAgain,
    selectGame,
    finalVote,
    skipVote,
    unskipVote,
    sendLiveBalance,
    sendRoundEndBalance,
    chooseBailout,
    selectPlayerPower,
    activatePlayerPower,
  };
}
