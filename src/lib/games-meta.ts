// Game metadata: names, icons, descriptions, colors.

import type { GameName } from './types';

export interface GameMeta {
  name: GameName;
  label: string;
  icon: string;
  description: string;
  accent: string;
}

export const GAME_META: Record<GameName, GameMeta> = {
  tower: {
    name: 'tower',
    label: 'Tower',
    icon: '🗼',
    description: 'Climb the tower for higher multipliers. Cash out before you fall.',
    accent: '#C9A84C',
  },
  plinko: {
    name: 'plinko',
    label: 'Plinko',
    icon: '🔵',
    description: 'Drop the ball through a peg grid. Land in a high-multiplier bucket.',
    accent: '#4a90e2',
  },
  mines: {
    name: 'mines',
    label: 'Mines',
    icon: '💣',
    description: 'Reveal gems, avoid mines. More mines = bigger multipliers.',
    accent: '#E53E3E',
  },
  slots: {
    name: 'slots',
    label: 'Slots',
    icon: '🎰',
    description: 'Spin 3 reels. Match symbols to win up to 10x.',
    accent: '#C9A84C',
  },
  blackjack: {
    name: 'blackjack',
    label: 'Blackjack',
    icon: '🃏',
    description: 'Classic 21 vs the dealer. Blackjack pays 3:2.',
    accent: '#38A169',
  },
  crash: {
    name: 'crash',
    label: 'Crash',
    icon: '🚀',
    description: 'Watch the multiplier rise. Cash out before it crashes.',
    accent: '#E53E3E',
  },
  coinflip: {
    name: 'coinflip',
    label: 'Coin Flip',
    icon: '🪙',
    description: 'Heads or tails. 1:1 payout, fast action.',
    accent: '#C9A84C',
  },
  keno: {
    name: 'keno',
    label: 'Keno',
    icon: '🔢',
    description: 'Pick 10 numbers. Match the draw for up to 1000x.',
    accent: '#9b59b6',
  },
};
