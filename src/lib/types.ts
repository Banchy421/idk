// Core type definitions for StakeFriends

export type Phase =
  | 'lobby'
  | 'power-select'
  | 'game-select'
  | 'round-active'
  | 'round-timeout'
  | 'final-vote'
  | 'final-coinflip'
  | 'final-round'
  | 'results';

export type GameMode = 'standard' | 'extended';

export type GameName =
  | 'tower'
  | 'plinko'
  | 'mines'
  | 'slots'
  | 'blackjack'
  | 'crash'
  | 'coinflip'
  | 'keno';

export const ALL_GAMES: GameName[] = [
  'tower', 'plinko', 'mines', 'slots', 'blackjack', 'crash', 'coinflip', 'keno',
];

export const AVATARS = [
  '🦊', '🐯', '🦁', '🐺', '🐉', '🦅', '🐍', '🦈',
] as const;

// ─── Powers ───
export type PowerType =
  | 'heist'             // Steal 15% of target's balance
  | 'double-or-nothing' // Next win ×2, next loss ×2
  | 'freeze'            // Freeze target's game for 5s
  | 'mirror'            // Copy target's next bet outcome
  | 'bailout-block'     // Target can't bailout next round-timeout
  | 'gold-rush'         // Winnings ×1.5 for 20s
  | 'curse'             // Target gets 50% of next win
  | 'insurance'         // Next loss costs 50%
  | 'jackpot-magnet'    // RNG +20% next bet
  | 'swap';             // Swap balance with target

export const ALL_POWERS: PowerType[] = [
  'heist', 'double-or-nothing', 'freeze', 'mirror', 'bailout-block',
  'gold-rush', 'curse', 'insurance', 'jackpot-magnet', 'swap',
];

export interface PowerMeta {
  type: PowerType;
  label: string;
  icon: string;
  description: string;
  targeted: boolean; // requires selecting a target player
}

export const POWER_META: Record<PowerType, PowerMeta> = {
  'heist': {
    type: 'heist', label: 'Heist', icon: '💰',
    description: 'Steal 15% of any one player\'s balance instantly',
    targeted: true,
  },
  'double-or-nothing': {
    type: 'double-or-nothing', label: 'Double or Nothing', icon: '🎲',
    description: 'Next win doubled, next loss doubled',
    targeted: false,
  },
  'freeze': {
    type: 'freeze', label: 'Freeze', icon: '🧊',
    description: 'Freeze one player\'s game for 5 seconds',
    targeted: true,
  },
  'mirror': {
    type: 'mirror', label: 'Mirror', icon: '🪞',
    description: 'Copy your target\'s next bet outcome',
    targeted: true,
  },
  'bailout-block': {
    type: 'bailout-block', label: 'Bailout Block', icon: '🚫',
    description: 'Target cannot use bailout between the next round timeout only',
    targeted: true,
  },
  'gold-rush': {
    type: 'gold-rush', label: 'Gold Rush', icon: '✨',
    description: 'All your winnings ×1.5 for 20 seconds',
    targeted: false,
  },
  'curse': {
    type: 'curse', label: 'Curse', icon: '诅咒',
    description: 'Target only gets 50% of their next win',
    targeted: true,
  },
  'insurance': {
    type: 'insurance', label: 'Insurance', icon: '🛡️',
    description: 'Your next loss only costs you 50% of the bet',
    targeted: false,
  },
  'jackpot-magnet': {
    type: 'jackpot-magnet', label: 'Jackpot Magnet', icon: '🧲',
    description: 'RNG nudged 20% in your favor on next bet',
    targeted: false,
  },
  'swap': {
    type: 'swap', label: 'Swap', icon: '🔄',
    description: 'Swap your balance with any one player',
    targeted: true,
  },
};

export interface Player {
  id: string;
  name: string;
  avatar: string;
  balance: number;
  roundBonus: number;
  bailoutUsed: boolean;
  isHost: boolean;
  isEliminated: boolean;
  joinedAt: number;
  // Powers
  power: { type: PowerType; used: boolean } | null;
  // Active power effects (set when a power is activated, cleared when consumed)
  doubleOrNothing: boolean;      // next win ×2, next loss ×2
  goldRushUntil: number;         // timestamp: winnings ×1.5 until this time
  insured: boolean;              // next loss costs 50%
  jackpotMagnet: boolean;        // RNG +20% next bet
  frozenUntil: number;           // timestamp: game frozen until this time
  cursed: boolean;               // next win only 50%
  bailoutBlocked: boolean;       // can't bailout next round-timeout
  mirroredBy: string | null;     // playerId who is mirroring this player
}

export interface GameState {
  phase: Phase;
  gameMode: GameMode;
  powersEnabled: boolean;
  currentRound: number;
  totalRounds: number;
  roundDuration: number;
  timeRemaining: number;
  availableGames: GameName[];
  playerGameChoices: Record<string, GameName>;
  finalVoteOptions: GameName[];
  finalVoteChoices: Record<string, GameName>;
  coinflipResult: GameName | null;
  skipVotes: string[];
  players: Record<string, Player>;
  hostId: string;
  roundWinnerId: string | null;
  roundSeed: number;
  crashPoints: number[];
  kenoDraws: number[][];
  finalWinnerId: string | null;
  lastBalanceUpdate: Record<string, number>;
  roundEndBalances: Record<string, number>;
  roundStartBalances: Record<string, number>;
  bailoutPending: string[];
  bailoutChoices: Record<string, number>;
  bailoutPenaltyPending: string[];
  // Powers
  powerOptions: Record<string, PowerType[]>; // 2 random powers offered to each player
  powerSelections: Record<string, PowerType>; // which power each player chose
}

export type PlayerAction =
  | { type: 'join'; name: string; avatar: string }
  | { type: 'select-game'; game: GameName }
  | { type: 'final-vote'; game: GameName }
  | { type: 'final-pick'; game: GameName }
  | { type: 'skip-vote' }
  | { type: 'skip-unvote' }
  | { type: 'live-balance'; balance: number }
  | { type: 'round-end-balance'; balance: number }
  | { type: 'bailout-choice'; amount: number }
  | { type: 'start-game'; mode: GameMode; powersEnabled: boolean }
  | { type: 'select-power'; power: PowerType }
  | { type: 'activate-power'; targetId?: string }
  | { type: 'play-again' };

export type HostCommand =
  | { type: 'state'; state: GameState }
  | { type: 'request-round-end-balance' }
  | { type: 'request-live-balance' };
