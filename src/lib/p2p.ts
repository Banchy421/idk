'use client';

// P2P setup using Trystero.
// Host is the single source of truth; guests send actions to host.

import { selfId as torrentSelfId, joinRoom as torrentJoinRoom, type Room, type MessageAction } from '@trystero-p2p/torrent';
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

  // Trystero v0.25 API: makeAction returns a single MessageAction object,
  // NOT a [send, onMessage] tuple. The callback is `onMessage`, not the array index.
  const stateAction: MessageAction<GameState> = room.makeAction<GameState>('gameState');
  const playerActionChannel: MessageAction<PlayerAction> = room.makeAction<PlayerAction>('playerAction');
  const hostCommandAction: MessageAction<HostCommand> = room.makeAction<HostCommand>('hostCommand');

  return {
    selfId: torrentSelfId,
    room,
    sendState: (state, peerIds) => stateAction.send(state, peerIds ? { target: peerIds } : undefined),
    onState: (cb) => {
      stateAction.onMessage = (data, context) => cb(data, context.peerId);
      return () => { stateAction.onMessage = null; };
    },
    sendAction: (action, peerIds) => playerActionChannel.send(action, peerIds ? { target: peerIds } : undefined),
    onAction: (cb) => {
      playerActionChannel.onMessage = (data, context) => cb(data, context.peerId);
      return () => { playerActionChannel.onMessage = null; };
    },
    sendHostCommand: (cmd, peerIds) => hostCommandAction.send(cmd, peerIds ? { target: peerIds } : undefined),
    onHostCommand: (cb) => {
      hostCommandAction.onMessage = (data, context) => cb(data, context.peerId);
      return () => { hostCommandAction.onMessage = null; };
    },
    onPeerJoin: (cb) => {
      room.onPeerJoin = (peerId: string) => {
        console.log('[StakeFriends] peer joined:', peerId);
        cb(peerId);
      };
      return () => { room.onPeerJoin = null; };
    },
    onPeerLeave: (cb) => {
      room.onPeerLeave = (peerId: string) => {
        console.log('[StakeFriends] peer left:', peerId);
        cb(peerId);
      };
      return () => { room.onPeerLeave = null; };
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
