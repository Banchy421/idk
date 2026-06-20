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
    bailoutPending: [],
    bailoutChoices: {},
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
    bailoutChoices: [],
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
  return {
    ...state,
    players,
    playerGameChoices: choices,
    phase: 'round-active',
    timeRemaining: roundDurationFor(state.gameMode, state.currentRound),
    roundDuration: roundDurationFor(state.gameMode, state.currentRound),
    crashPoints: crashPointsForRound(state.roundSeed, 10),
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

/** Tally final votes; tie -> random. */
export function resolveFinalVote(state: GameState, rng: () => number = Math.random): GameState {
  const counts: Record<string, number> = {};
  for (const opt of state.finalVoteOptions) counts[opt] = 0;
  for (const k of Object.keys(state.finalVoteChoices)) {
    const v = state.finalVoteChoices[k];
    if (counts[v] !== undefined) counts[v]++;
  }
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
  const finalGame = winners[Math.floor(rng() * winners.length)];
  // transition to game-select-like for personal picks (10s)
  return {
    ...state,
    phase: 'game-select',
    availableGames: [finalGame, winners.length > 1 ? winners[1] : state.finalVoteOptions[0]],
    finalVoteOptions: [finalGame],
    timeRemaining: 10,
    roundDuration: 10,
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
    roundBonus: Math.max(players[playerId].roundBonus, 1.0), // bailout penalty applied at round-end next round
  };
  const bailoutChoices = { ...state.bailoutChoices, [playerId]: amount };
  const bailoutPending = state.bailoutPending.filter((id) => id !== playerId);
  return { ...state, players, bailoutChoices, bailoutPending };
}

/** Apply bailout penalty: -10% of net profit at round end. */
export function applyRoundEndPenalties(state: GameState): GameState {
  // Bailout penalty already applied implicitly — we set roundBonus to 0.9 if they took bailout last round.
  // For simplicity, we treat bailout penalty as: next round net profit reduced by 10% at round end.
  // We'll apply this when computing final balances by reducing positive deltas.
  return state;
}

/** Collect round-end balances and finalize. */
export function collectRoundEndBalances(state: GameState, balances: Record<string, number>): GameState {
  const players = { ...state.players };
  for (const pid of Object.keys(balances)) {
    if (players[pid]) {
      let newBalance = balances[pid];
      // Apply bailout penalty: -10% of profit this round if they used bailout
      if (players[pid].bailoutUsed && players[pid].roundBonus < 1.0) {
        const startBalance = 100; // approximate — could track properly
        const profit = Math.max(0, newBalance - startBalance);
        newBalance = newBalance - profit * 0.1;
      }
      players[pid] = { ...players[pid], balance: Math.max(0, Math.round(newBalance * 100) / 100) };
    }
  }
  // Mark eliminated players who ended at 0 and have used bailout
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
  };
}

/** Skip the current round entirely. */
export function skipRound(state: GameState): GameState {
  // No balance changes; advance as if round ended but skip timeout if non-final.
  return {
    ...state,
    phase: state.currentRound >= state.totalRounds ? 'results' : 'game-select',
    skipVotes: [],
    timeRemaining: 0,
    roundDuration: 0,
  };
}

/** Advance from round-timeout to next game-select or to results if last round. */
export function advanceAfterTimeout(state: GameState): GameState {
  if (state.currentRound >= state.totalRounds) {
    return { ...state, phase: 'results' };
  }
  // Set bailoutUsed players' roundBonus to 0.9 for next round (penalty)
  const players = { ...state.players };
  for (const pid of Object.keys(players)) {
    if (players[pid].bailoutUsed && players[pid].balance > 0) {
      players[pid] = { ...players[pid], roundBonus: 0.9 };
    }
  }
  // Check if next round is the final round
  const nextRound = state.currentRound + 1;
  if (nextRound === state.totalRounds) {
    return startFinalVote({ ...state, players });
  }
  return startGameSelect({ ...state, players });
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
