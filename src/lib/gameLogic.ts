// Game logic: state transitions, round lifecycle, bailout/bonus application.

import type { GameMode, GameState, Phase, Player, GameName } from './types';
import { ALL_GAMES } from './types';
import { pickN, randomSeed, crashPointsForRound } from './utils-casino';

export function makeInitialState(hostPlayer: Player, mode: GameMode): GameState {
  const totalRounds = mode === 'standard' ? 3 : 6;
  return {
    phase: 'lobby',
    gameMode: mode,
    currentRound: 0,
    totalRounds,
    roundDuration: 0,
    timeRemaining: 0,
    availableGames: [],
    playerGameChoices: {},
    finalVoteOptions: [],
    finalVoteChoices: {},
    coinflipResult: null,
    skipVotes: [],
    players: { [hostPlayer.id]: hostPlayer },
    hostId: hostPlayer.id,
    roundWinnerId: null,
    roundSeed: 0,
    crashPoints: [],
    kenoDraws: [],
    finalWinnerId: null,
    lastBalanceUpdate: {},
    roundEndBalances: {},
    roundStartBalances: {},
    bailoutPending: [],
    bailoutChoices: {},
    bailoutPenaltyPending: [],
  };
}

export function addPlayer(state: GameState, player: Player): GameState {
  if (state.players[player.id]) return state;
  return {
    ...state,
    players: { ...state.players, [player.id]: player },
  };
}

export function removePlayer(state: GameState, playerId: string): GameState {
  const players = { ...state.players };
  delete players[playerId];
  const playerGameChoices = { ...state.playerGameChoices };
  delete playerGameChoices[playerId];
  const finalVoteChoices = { ...state.finalVoteChoices };
  delete finalVoteChoices[playerId];
  return {
    ...state,
    players,
    playerGameChoices,
    finalVoteChoices,
    skipVotes: state.skipVotes.filter((id) => id !== playerId),
    bailoutPending: state.bailoutPending.filter((id) => id !== playerId),
  };
}

export function roundDurationFor(mode: GameMode, round: number): number {
  if (mode === 'standard') {
    if (round === 1) return 60;
    if (round === 2) return 90;
    return 60; // final round
  }
  // extended
  if (round === 6) return 120; // final round
  return round % 2 === 1 ? 120 : 180;
}

/** Transition lobby -> game-select for round N. */
export function startGameSelect(state: GameState): GameState {
  const round = state.currentRound + 1;
  const isFinalRound = round === state.totalRounds;
  return {
    ...state,
    phase: 'game-select',
    currentRound: round,
    timeRemaining: 10, // 10s to pick game
    roundDuration: 10,
    availableGames: pickN(ALL_GAMES, 3),
    playerGameChoices: {},
    finalVoteOptions: [],
    finalVoteChoices: {},
    skipVotes: [],
    roundWinnerId: null,
    bailoutPending: [],
    bailoutChoices: {},
    roundSeed: randomSeed(),
    crashPoints: [],
    kenoDraws: [],
    roundEndBalances: {},
    lastBalanceUpdate: {},
    // for the final round, use final-vote phase instead
    ...(isFinalRound ? { phase: 'final-vote' as Phase, finalVoteOptions: pickN(ALL_GAMES, 2), timeRemaining: 10 } : {}),
  };
}

/** Resolve pending game selections (random for those who didn't pick). */
export function resolveGameSelect(state: GameState, rng: () => number = Math.random): GameState {
  const choices: Record<string, GameName> = { ...state.playerGameChoices };
  for (const pid of Object.keys(state.players)) {
    if (!choices[pid]) {
      const pool = state.availableGames;
      choices[pid] = pool[Math.floor(rng() * pool.length)];
    }
  }
  // Reset round bonus for everyone except previous round winner (+10%)
  const players = { ...state.players };
  for (const pid of Object.keys(players)) {
    players[pid] = { ...players[pid], roundBonus: 1.0 };
  }
  if (state.roundWinnerId && players[state.roundWinnerId]) {
    players[state.roundWinnerId] = {
      ...players[state.roundWinnerId],
      roundBonus: 1.1,
    };
  }
  // Snapshot each player's balance at the start of this round — used to compute
  // profit for the bailout penalty at round end.
  const roundStartBalances: Record<string, number> = {};
  for (const pid of Object.keys(players)) {
    roundStartBalances[pid] = players[pid].balance;
  }
  return {
    ...state,
    players,
    playerGameChoices: choices,
    phase: 'round-active',
    timeRemaining: roundDurationFor(state.gameMode, state.currentRound),
    roundDuration: roundDurationFor(state.gameMode, state.currentRound),
    crashPoints: crashPointsForRound(state.roundSeed, 10),
    roundStartBalances,
    roundEndBalances: {},
    lastBalanceUpdate: {},
  };
}

/** Final-vote phase: votes collected -> resolve -> still game-select-like for personal picks. */
export function startFinalVote(state: GameState): GameState {
  const round = state.currentRound + 1;
  return {
    ...state,
    phase: 'final-vote',
    currentRound: round,
    timeRemaining: 10,
    roundDuration: 10,
    finalVoteOptions: pickN(ALL_GAMES, 2),
    finalVoteChoices: {},
    coinflipResult: null,
    playerGameChoices: {},
    skipVotes: [],
    roundWinnerId: null,
    bailoutPending: [],
    bailoutChoices: {},
    roundSeed: randomSeed(),
    crashPoints: [],
    kenoDraws: [],
    roundEndBalances: {},
    lastBalanceUpdate: {},
  };
}

/** Tally final votes.
 *  - Clear winner (majority): go straight to round-active with that game for everyone.
 *  - 50/50 tie: go to final-coinflip phase. The host sets coinflipResult to one of the
 *    two options (random), and the FinalCoinflipScreen plays the animation, then the
 *    host calls resolveCoinflip to advance to round-active.
 */
export function resolveFinalVote(state: GameState, rng: () => number = Math.random): GameState {
  const counts: Record<string, number> = {};
  for (const opt of state.finalVoteOptions) counts[opt] = 0;
  for (const k of Object.keys(state.finalVoteChoices)) {
    const v = state.finalVoteChoices[k];
    if (counts[v] !== undefined) counts[v]++;
  }

  // Find the option(s) with the most votes
  let max = -1;
  let winners: GameName[] = [];
  for (const opt of state.finalVoteOptions) {
    if (counts[opt] > max) {
      max = counts[opt];
      winners = [opt];
    } else if (counts[opt] === max) {
      winners.push(opt);
    }
  }

  if (winners.length === 1) {
    // Clear winner — go straight to round-active with that game for everyone
    return startRoundWithGame(state, winners[0]);
  }

  // 50/50 tie — go to coinflip phase. Host will pick a random winner.
  const coinflipWinner = winners[Math.floor(rng() * winners.length)];
  return {
    ...state,
    phase: 'final-coinflip' as Phase,
    coinflipResult: coinflipWinner,
    timeRemaining: 4, // 4s for the coinflip animation
    roundDuration: 4,
  };
}

/** Resolve the coinflip — advance to round-active with the coinflip winner. */
export function resolveCoinflip(state: GameState): GameState {
  const game = state.coinflipResult;
  if (!game) return state;
  return startRoundWithGame(state, game);
}

/** Start the round with a specific game assigned to all players. Skips game-select. */
function startRoundWithGame(state: GameState, game: GameName): GameState {
  const choices: Record<string, GameName> = {};
  const activePlayers = Object.keys(state.players).filter((id) => !state.players[id].isEliminated);
  for (const pid of activePlayers) {
    choices[pid] = game;
  }
  // Reset round bonus for everyone except previous round winner (+10%)
  const players = { ...state.players };
  for (const pid of Object.keys(players)) {
    players[pid] = { ...players[pid], roundBonus: 1.0 };
  }
  if (state.roundWinnerId && players[state.roundWinnerId]) {
    players[state.roundWinnerId] = {
      ...players[state.roundWinnerId],
      roundBonus: 1.1,
    };
  }
  // Snapshot start-of-round balances for bailout penalty calc
  const roundStartBalances: Record<string, number> = {};
  for (const pid of Object.keys(players)) {
    roundStartBalances[pid] = players[pid].balance;
  }
  return {
    ...state,
    players,
    playerGameChoices: choices,
    availableGames: [game],
    finalVoteOptions: [game],
    phase: 'round-active' as Phase,
    timeRemaining: roundDurationFor(state.gameMode, state.currentRound),
    roundDuration: roundDurationFor(state.gameMode, state.currentRound),
    crashPoints: crashPointsForRound(state.roundSeed, 10),
    roundStartBalances,
    roundEndBalances: {},
    lastBalanceUpdate: {},
    coinflipResult: null,
  };
}

/** Apply bailout penalty & advance to round-timeout (10s) after a round ends. */
export function startRoundTimeout(state: GameState): GameState {
  const players = { ...state.players };
  const bailoutPending: string[] = [];
  for (const pid of Object.keys(players)) {
    const p = players[pid];
    if (p.balance <= 0 && !p.isEliminated && !p.bailoutUsed) {
      bailoutPending.push(pid);
    }
  }
  // Mark eliminated for players who have bailoutUsed and balance 0
  for (const pid of bailoutPending) {
    // They get a chance during the timeout to pick bailout.
  }
  // Determine round winner — highest balance (excluding eliminated)
  let winnerId: string | null = null;
  let max = -Infinity;
  for (const pid of Object.keys(players)) {
    if (players[pid].isEliminated) continue;
    if (players[pid].balance > max) {
      max = players[pid].balance;
      winnerId = pid;
    }
  }
  return {
    ...state,
    phase: 'round-timeout',
    timeRemaining: 10,
    roundDuration: 10,
    roundWinnerId: winnerId,
    bailoutPending,
    bailoutChoices: {},
  };
}

/** Apply bailout choice for a player. */
export function applyBailout(state: GameState, playerId: string, amount: number): GameState {
  const players = { ...state.players };
  if (!players[playerId]) return state;
  players[playerId] = {
    ...players[playerId],
    balance: players[playerId].balance + amount,
    bailoutUsed: true,
  };
  const bailoutChoices = { ...state.bailoutChoices, [playerId]: amount };
  const bailoutPending = state.bailoutPending.filter((id) => id !== playerId);
  // Queue the -10% profit penalty for the NEXT round. It will be applied in
  // collectRoundEndBalances using the round-start balance snapshot.
  const bailoutPenaltyPending = state.bailoutPenaltyPending.includes(playerId)
    ? state.bailoutPenaltyPending
    : [...state.bailoutPenaltyPending, playerId];
  return { ...state, players, bailoutChoices, bailoutPending, bailoutPenaltyPending };
}

/** Apply bailout penalty: -10% of net profit at round end. */
export function applyRoundEndPenalties(state: GameState): GameState {
  // Bailout penalty already applied implicitly — we set roundBonus to 0.9 if they took bailout last round.
  // For simplicity, we treat bailout penalty as: next round net profit reduced by 10% at round end.
  // We'll apply this when computing final balances by reducing positive deltas.
  return state;
}

/** Collect round-end balances and finalize. Applies bailout penalty (-10% of profit) for
 *  players who took a bailout in a previous round-timeout and haven't served the penalty yet. */
export function collectRoundEndBalances(state: GameState, balances: Record<string, number>): GameState {
  const players = { ...state.players };
  const penaltyServed: string[] = [];
  for (const pid of Object.keys(balances)) {
    if (players[pid]) {
      let newBalance = balances[pid];
      // Apply bailout penalty: -10% of THIS ROUND's profit (not total profit).
      // Uses the balance snapshot taken at round start (roundStartBalances).
      if (state.bailoutPenaltyPending.includes(pid)) {
        const startBalance = state.roundStartBalances[pid] ?? players[pid].balance;
        const profit = Math.max(0, newBalance - startBalance);
        newBalance = newBalance - profit * 0.1;
        penaltyServed.push(pid);
      }
      players[pid] = { ...players[pid], balance: Math.max(0, Math.round(newBalance * 100) / 100) };
    }
  }
  // Clear the penalty flag for players who served it this round
  const remainingPenalty = state.bailoutPenaltyPending.filter((id) => !penaltyServed.includes(id));
  for (const pid of penaltyServed) {
    if (players[pid]) {
      players[pid] = { ...players[pid], bailoutUsed: false };
    }
  }
  // Mark eliminated players who ended at 0 and have already used their bailout
  for (const pid of Object.keys(players)) {
    if (players[pid].balance <= 0 && players[pid].bailoutUsed) {
      players[pid] = { ...players[pid], isEliminated: true, balance: 0 };
    }
  }
  return {
    ...state,
    players,
    roundEndBalances: balances,
    lastBalanceUpdate: balances,
    bailoutPenaltyPending: remainingPenalty,
  };
}

/** Skip the current round. Money won/lost DURING the round (before the skip) is
 *  preserved — we collect the latest live balances into state.players. But the skip
 *  itself doesn't change any money (no bailout penalty, no round-end collection).
 *  Still show the 10s round-timeout pause (winner announcement / bailout offer). */
export function skipRound(state: GameState): GameState {
  // Collect the latest live balances so money won/lost during the round is preserved.
  // Without this, state.players[pid].balance would still be the round-start value,
  // and the next round would start with the old balance (looks like a "reset to 100").
  const players = { ...state.players };
  for (const pid of Object.keys(players)) {
    const liveBalance = state.lastBalanceUpdate[pid];
    if (liveBalance !== undefined && !players[pid].isEliminated) {
      players[pid] = { ...players[pid], balance: liveBalance };
    }
  }
  // If this is the last round, go straight to results (no pause)
  if (state.currentRound >= state.totalRounds) {
    return { ...state, players, skipVotes: [], phase: 'results' as Phase };
  }
  return startRoundTimeout({ ...state, players, skipVotes: [] });
}

/** Collect round-end balances and advance to the next phase.
 *  - If this is the last round, go STRAIGHT to results (no 10s round-timeout pause).
 *  - Otherwise, show the 10s round-timeout (winner announcement + bailout offer). */
export function endRound(state: GameState, balances: Record<string, number>): GameState {
  const collected = collectRoundEndBalances(state, balances);
  // If this is the last round, skip the pause and go straight to results
  if (collected.currentRound >= collected.totalRounds) {
    return { ...collected, phase: 'results' as Phase };
  }
  return startRoundTimeout(collected);
}

/** Advance from round-timeout to next game-select or to results if last round. */
export function advanceAfterTimeout(state: GameState): GameState {
  if (state.currentRound >= state.totalRounds) {
    return { ...state, phase: 'results' as Phase };
  }
  // The bailout penalty is now tracked via bailoutPenaltyPending (set in applyBailout)
  // and applied in collectRoundEndBalances. No roundBonus manipulation needed here.
  // Check if next round is the final round
  const nextRound = state.currentRound + 1;
  if (nextRound === state.totalRounds) {
    return startFinalVote({ ...state });
  }
  return startGameSelect({ ...state });
}

/** Sort players by balance descending (for leaderboard / results). */
export function sortedPlayers(state: GameState): Player[] {
  return Object.values(state.players).sort((a, b) => b.balance - a.balance);
}

/** Reset for play-again. */
export function resetForPlayAgain(state: GameState): GameState {
  const players: Record<string, Player> = {};
  for (const pid of Object.keys(state.players)) {
    players[pid] = {
      ...state.players[pid],
      balance: 100,
      roundBonus: 1.0,
      bailoutUsed: false,
      isEliminated: false,
    };
  }
  return {
    ...makeInitialState(players[state.hostId], state.gameMode),
    players,
    phase: 'lobby',
  };
}
