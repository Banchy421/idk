'use client';

// P2P setup using Trystero.
// Host is the single source of truth; guests send actions to host.

import { selfId as torrentSelfId, joinRoom as torrentJoinRoom, type Room } from '@trystero-p2p/torrent';
import type { GameState, PlayerAction, HostCommand, Player } from './types';

const APP_ID = 'stakefriends-v1';

export interface P2P {
  selfId: string;
  room: Room;
  /** host -> all: send full state */
  sendState: (state: GameState, peerIds?: string[]) => Promise<void>;
  onState: (cb: (state: GameState, peerId: string) => void) => () => void;
  /** guest -> host: send an action */
  sendAction: (action: PlayerAction, peerIds?: string[]) => Promise<void>;
  onAction: (cb: (action: PlayerAction, peerId: string) => void) => () => void;
  /** host -> all: send command (e.g. request balances) */
  sendHostCommand: (cmd: HostCommand, peerIds?: string[]) => Promise<void>;
  onHostCommand: (cb: (cmd: HostCommand, peerId: string) => void) => () => void;
  onPeerJoin: (cb: (peerId: string) => void) => () => void;
  onPeerLeave: (cb: (peerId: string) => void) => () => void;
  leave: () => void;
}

export const selfId: string = torrentSelfId;

export function joinGameRoom(roomCode: string): P2P {
  console.log('[StakeFriends] joinGameRoom:', roomCode);
  const room = torrentJoinRoom(
    { appId: APP_ID },
    roomCode.toLowerCase(),
  );

  const [sendState, onState] = room.makeAction<GameState>('gameState');
  const [sendAction, onAction] = room.makeAction<PlayerAction>('playerAction');
  const [sendHostCommand, onHostCommand] = room.makeAction<HostCommand>('hostCommand');

  return {
    selfId: torrentSelfId,
    room,
    sendState: (state, peerIds) => sendState(state, peerIds),
    onState,
    sendAction: (action, peerIds) => sendAction(action, peerIds),
    onAction,
    sendHostCommand: (cmd, peerIds) => sendHostCommand(cmd, peerIds),
    onHostCommand,
    onPeerJoin: (cb) => {
      room.onPeerJoin((peerId) => {
        console.log('[StakeFriends] peer joined:', peerId);
        cb(peerId);
      });
      return () => {};
    },
    onPeerLeave: (cb) => {
      room.onPeerLeave((peerId) => {
        console.log('[StakeFriends] peer left:', peerId);
        cb(peerId);
      });
      return () => {};
    },
    leave: () => room.leave(),
  };
}

/** Add self as a player on join. */
export function makeSelfPlayer(name: string, avatar: string, isHost: boolean): Player {
  return {
    id: torrentSelfId,
    name: name.slice(0, 16) || 'Player',
    avatar,
    balance: 100,
    roundBonus: 1.0,
    bailoutUsed: false,
    isHost,
    isEliminated: false,
    joinedAt: Date.now(),
  };
}
