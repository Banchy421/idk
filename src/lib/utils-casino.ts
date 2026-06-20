// Utility functions: RNG, room codes, formatting, crash math

/** Mulberry32 — small, fast seeded PRNG. Deterministic given the same seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Generate a random 6-letter uppercase room code. */
export function generateRoomCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I, O
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += letters[Math.floor(Math.random() * letters.length)];
  }
  return code;
}

/** Generate a random integer seed. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

/** Pick N distinct items from an array. */
export function pickN<T>(arr: T[], n: number, rng: () => number = Math.random): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(rng() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

/** Format a euro amount with 2 decimals. */
export function formatMoney(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const sign = safe < 0 ? '-' : '';
  return `${sign}€${Math.abs(safe).toFixed(2)}`;
}

/** Format money with sign for delta displays. */
export function formatSignedMoney(amount: number): string {
  if (amount > 0) return `+€${amount.toFixed(2)}`;
  if (amount < 0) return `-€${Math.abs(amount).toFixed(2)}`;
  return `€0.00`;
}

/**
 * Compute a crash multiplier from a seed.
 * Uses an exponential distribution so most crashes are low, rare ones are very high.
 * The "house edge" shifts the curve slightly downward.
 */
export function crashPointFromSeed(seed: number): number {
  const rng = mulberry32(seed);
  const r = rng();
  // ~99% chance of crashing by 100x; 1% chance higher; floor of 1.00x
  // crashPoint = max(1.00, (1 - houseEdge) / (1 - r))
  const houseEdge = 0.04;
  const raw = (1 - houseEdge) / Math.max(1 - r, 1e-6);
  return Math.max(1.00, Math.min(raw, 1000));
}

/** Generate N crash points deterministically from one seed (used per round). */
export function crashPointsForRound(seed: number, n: number): number[] {
  const rng = mulberry32((seed ^ 0xC4A511) >>> 0);
  const points: number[] = [];
  for (let i = 0; i < n; i++) {
    const r = rng();
    const houseEdge = 0.04;
    const raw = (1 - houseEdge) / Math.max(1 - r, 1e-6);
    points.push(Math.max(1.00, Math.min(raw, 1000)));
  }
  return points;
}

/** Generate a keno draw: 20 unique numbers from 1..40. */
export function kenoDraw(seed: number, drawIndex: number): number[] {
  const rng = mulberry32((seed ^ (drawIndex * 7919 + 0x5ED0)) >>> 0);
  const pool = Array.from({ length: 40 }, (_, i) => i + 1);
  const drawn: number[] = [];
  for (let i = 0; i < 20; i++) {
    const idx = Math.floor(rng() * pool.length);
    drawn.push(pool.splice(idx, 1)[0]);
  }
  return drawn.sort((a, b) => a - b);
}

/** Standard mines multiplier given safe picks and total mines. */
export function minesMultiplier(safePicks: number, totalMines: number, houseEdge = 0.03): number {
  if (safePicks === 0) return 1;
  const totalTiles = 25;
  let mult = 1;
  for (let i = 0; i < safePicks; i++) {
    const safeRemaining = totalTiles - totalMines - i;
    const totalRemaining = totalTiles - i;
    mult *= totalRemaining / safeRemaining;
  }
  return mult * (1 - houseEdge);
}

/** Tower level config: multiplier & fall chance per level. */
export interface TowerLevel {
  multiplier: number;
  fallChance: number;
}

export const TOWER_LEVELS: TowerLevel[] = [
  { multiplier: 1.2, fallChance: 0.20 },
  { multiplier: 1.5, fallChance: 0.25 },
  { multiplier: 2.0, fallChance: 0.30 },
  { multiplier: 3.0, fallChance: 0.35 },
  { multiplier: 5.0, fallChance: 0.40 },
  { multiplier: 10.0, fallChance: 0.45 },
  { multiplier: 20.0, fallChance: 0.50 },
  { multiplier: 50.0, fallChance: 0.55 },
];

/** Plinko buckets — 9 buckets. */
export const PLINKO_BUCKETS = [0.2, 0.5, 1, 2, 5, 2, 1, 0.5, 0.2];

/** Slots symbols & payouts. */
export const SLOTS_SYMBOLS = ['🍒', '🍋', '🍊', '⭐', '💎', '7️⃣'] as const;
export const SLOTS_PAYOUTS: Record<string, number> = {
  '7️⃣7️⃣7️⃣': 10,
  '💎💎💎': 7,
  '⭐⭐⭐': 5,
  '🍊🍊🍊': 3,
  '🍋🍋🍋': 2,
  '🍒🍒🍒': 1.5,
};
export function slotsPayout(reels: string[]): number {
  if (reels[0] === reels[1] && reels[1] === reels[2]) {
    return SLOTS_PAYOUTS[reels.join('')] || 0;
  }
  // any 2 match
  if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
    return 0.5;
  }
  return 0;
}

/** Keno payout table by matches (0..10 of 10 picks). */
export const KENO_PAYOUTS: number[] = [
  0, 0, 0,       // 0, 1, 2 matches = 0x
  0.5,           // 3
  1,             // 4
  2,             // 5
  5,             // 6
  15,            // 7
  50,            // 8
  200,           // 9
  1000,          // 10
];

/** Coin side. */
export type CoinSide = 'heads' | 'tails';

/** Standard deck of cards for blackjack. */
export const SUITS = ['♠', '♥', '♦', '♣'] as const;
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;

export interface Card {
  rank: string;
  suit: string;
  faceUp: boolean;
}

export function freshDeck(seed: number): Card[] {
  const rng = mulberry32(seed);
  const deck: Card[] = [];
  for (const s of SUITS) {
    for (const r of RANKS) {
      deck.push({ rank: r, suit: s, faceUp: false });
    }
  }
  // Fisher-Yates
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function cardValue(rank: string): number {
  if (rank === 'A') return 11;
  if (['K', 'Q', 'J'].includes(rank)) return 10;
  return parseInt(rank, 10);
}

export function handValue(cards: Card[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += cardValue(c.rank);
    if (c.rank === 'A') aces++;
  }
  let soft = aces > 0;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
    if (aces === 0) soft = false;
  }
  return { total, soft };
}

export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21;
}

/** Promise-friendly sleep. */
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Clamp a number. */
export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
