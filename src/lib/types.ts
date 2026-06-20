// Core type definitions for StakeFriends

export type Phase =
  | 'lobby'
  | 'game-select'
  | 'round-active'
  | 'round-timeout'
  | 'final-vote'
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

export interface Player {
  id: string;
  name: string;
  avatar: string;
  balance: number;
  roundBonus: number;       // multiplier bonus for this round (default 1.0)
  bailoutUsed: boolean;
  isHost: boolean;
  isEliminated: boolean;
  joinedAt: number;
}

export interface GameState {
  phase: Phase;
  gameMode: GameMode;
  currentRound: number;
  totalRounds: number;
  roundDuration: number;     // seconds for the active round
  timeRemaining: number;
  availableGames: GameName[];
  playerGameChoices: Record<string, GameName>;
  finalVoteOptions: GameName[];
  finalVoteChoices: Record<string, GameName>;
  skipVotes: string[];
  players: Record<string, Player>;
  hostId: string;
  roundWinnerId: string | null;
  // Host-seeded RNG for fairness (broadcast before each round)
  roundSeed: number;
  crashPoints: number[];     // crash game results for this round (10 entries per round)
  kenoDraws: number[][];     // keno draws for this round
  finalWinnerId: string | null;
  lastBalanceUpdate: Record<string, number>; // live balance syncs every 2s
  roundEndBalances: Record<string, number>; // collected at round end
  roundStartBalances: Record<string, number>; // balance at start of round (for profit calc)
  bailoutPending: string[]; // player ids who need to choose bailout
  bailoutChoices: Record<string, number>; // playerId -> amount chosen
  bailoutPenaltyPending: string[]; // player ids who must serve -10% profit penalty this round
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
  | { type: 'start-game'; mode: GameMode }
  | { type: 'play-again' };

export type HostCommand =
  | { type: 'state'; state: GameState }
  | { type: 'request-round-end-balance' }
  | { type: 'request-live-balance' };
