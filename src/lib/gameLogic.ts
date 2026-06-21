// Game logic: state transitions, round lifecycle, bailout/bonus application, powers.

import type { GameMode, GameState, Phase, Player, GameName, PowerType } from './types';
import { ALL_GAMES, ALL_POWERS } from './types';
import { pickN, randomSeed, crashPointsForRound } from './utils-casino';

export function makeInitialState(hostPlayer: Player, mode: GameMode): GameState {
  const totalRounds = mode === 'standard' ? 3 : 6;
  return {
    phase: 'lobby',
    gameMode: mode,
    powersEnabled: false,
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
    powerOptions: {},
    powerSelections: {},
  };
}

export function makeDefaultPlayer(id: string, name: string, avatar: string, isHost: boolean): Player {
  return {
    id, name: name.slice(0, 16) || 'Player', avatar,
    balance: 100, roundBonus: 1.0, bailoutUsed: false, isHost, isEliminated: false,
    joinedAt: Date.now(),
    power: null, doubleOrNothing: false, goldRushUntil: 0, insured: false,
    jackpotMagnet: false, frozenUntil: 0, cursed: false, bailoutBlocked: false, mirroredBy: null,
  };
}

export function addPlayer(state: GameState, player: Player): GameState {
  if (state.players[player.id]) return state;
  return { ...state, players: { ...state.players, [player.id]: player } };
}

export function removePlayer(state: GameState, playerId: string): GameState {
  const players = { ...state.players };
  delete players[playerId];
  const playerGameChoices = { ...state.playerGameChoices };
  delete playerGameChoices[playerId];
  const finalVoteChoices = { ...state.finalVoteChoices };
  delete finalVoteChoices[playerId];
  const powerOptions = { ...state.powerOptions };
  delete powerOptions[playerId];
  const powerSelections = { ...state.powerSelections };
  delete powerSelections[playerId];
  return {
    ...state, players, playerGameChoices, finalVoteChoices, powerOptions, powerSelections,
    skipVotes: state.skipVotes.filter((id) => id !== playerId),
    bailoutPending: state.bailoutPending.filter((id) => id !== playerId),
  };
}

export function roundDurationFor(mode: GameMode, round: number): number {
  if (mode === 'standard') {
    if (round === 1) return 60;
    if (round === 2) return 90;
    return 60;
  }
  if (round === 6) return 120;
  return round % 2 === 1 ? 120 : 180;
}

// ─── Power Selection Phase ───

/** Transition lobby -> power-select (if powers enabled) or game-select (if not). */
export function startPowerSelect(state: GameState): GameState {
  // Generate 2 random powers for each active player
  const powerOptions: Record<string, PowerType[]> = {};
  for (const pid of Object.keys(state.players)) {
    if (!state.players[pid].isEliminated) {
      powerOptions[pid] = pickN(ALL_POWERS, 2);
    }
  }
  return {
    ...state,
    phase: 'power-select' as Phase,
    powerOptions,
    powerSelections: {},
    timeRemaining: 15,
    roundDuration: 15,
  };
}

/** Player selects a power from their 2 options. */
export function selectPower(state: GameState, playerId: string, power: PowerType): GameState {
  if (!state.powerOptions[playerId]?.includes(power)) return state;
  const powerSelections = { ...state.powerSelections, [playerId]: power };
  const players = { ...state.players };
  if (players[playerId]) {
    players[playerId] = { ...players[playerId], power: { type: power, used: false } };
  }
  return { ...state, powerSelections, players };
}

/** Resolve power-select -> game-select (assign random for those who didn't pick). */
export function resolvePowerSelect(state: GameState, rng: () => number = Math.random): GameState {
  const players = { ...state.players };
  for (const pid of Object.keys(players)) {
    if (players[pid].isEliminated) continue;
    if (!players[pid].power || !players[pid].power.type) {
      // Auto-assign a random power from their options
      const opts = state.powerOptions[pid];
      if (opts && opts.length > 0) {
        const chosen = opts[Math.floor(rng() * opts.length)];
        players[pid] = { ...players[pid], power: { type: chosen, used: false } };
      }
    }
  }
  return startGameSelect({ ...state, players });
}

// ─── Power Activation ───

/** Activate a player's power. Returns new state. */
export function activatePower(state: GameState, playerId: string, targetId?: string): GameState {
  const players = { ...state.players };
  const player = players[playerId];
  if (!player || !player.power || player.power.used) return state;

  const powerType = player.power.type;
  const now = Date.now();

  // Mark power as used
  players[playerId] = { ...player, power: { ...player.power, used: true } };

  switch (powerType) {
    case 'heist': {
      // Steal 15% of target's balance
      if (!targetId || !players[targetId]) return state;
      const stolen = Math.round(players[targetId].balance * 0.15 * 100) / 100;
      players[targetId] = { ...players[targetId], balance: Math.round((players[targetId].balance - stolen) * 100) / 100 };
      players[playerId] = { ...players[playerId], balance: Math.round((players[playerId].balance + stolen) * 100) / 100 };
      break;
    }
    case 'swap': {
      // Swap balances with target
      if (!targetId || !players[targetId]) return state;
      const tmp = players[playerId].balance;
      players[playerId] = { ...players[playerId], balance: players[targetId].balance };
      players[targetId] = { ...players[targetId], balance: tmp };
      break;
    }
    case 'double-or-nothing': {
      players[playerId] = { ...players[playerId], doubleOrNothing: true };
      break;
    }
    case 'gold-rush': {
      players[playerId] = { ...players[playerId], goldRushUntil: now + 20000 };
      break;
    }
    case 'insurance': {
      players[playerId] = { ...players[playerId], insured: true };
      break;
    }
    case 'jackpot-magnet': {
      players[playerId] = { ...players[playerId], jackpotMagnet: true };
      break;
    }
    case 'freeze': {
      if (!targetId || !players[targetId]) return state;
      players[targetId] = { ...players[targetId], frozenUntil: now + 5000 };
      break;
    }
    case 'curse': {
      if (!targetId || !players[targetId]) return state;
      players[targetId] = { ...players[targetId], cursed: true };
      break;
    }
    case 'bailout-block': {
      if (!targetId || !players[targetId]) return state;
      players[targetId] = { ...players[targetId], bailoutBlocked: true };
      break;
    }
    case 'mirror': {
      if (!targetId || !players[targetId]) return state;
      players[targetId] = { ...players[targetId], mirroredBy: playerId };
      break;
    }
  }

  return { ...state, players };
}

// ─── Game Select ───

export function startGameSelect(state: GameState): GameState {
  const round = state.currentRound + 1;
  const isFinalRound = round === state.totalRounds;
  return {
    ...state,
    phase: 'game-select',
    currentRound: round,
    timeRemaining: 10,
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
    ...(isFinalRound ? { phase: 'final-vote' as Phase, finalVoteOptions: pickN(ALL_GAMES, 2), timeRemaining: 10 } : {}),
  };
}

export function resolveGameSelect(state: GameState, rng: () => number = Math.random): GameState {
  const choices: Record<string, GameName> = { ...state.playerGameChoices };
  for (const pid of Object.keys(state.players)) {
    if (!choices[pid]) {
      const pool = state.availableGames;
      choices[pid] = pool[Math.floor(rng() * pool.length)];
    }
  }
  const players = { ...state.players };
  for (const pid of Object.keys(players)) {
    players[pid] = { ...players[pid], roundBonus: 1.0 };
  }
  if (state.roundWinnerId && players[state.roundWinnerId]) {
    players[state.roundWinnerId] = { ...players[state.roundWinnerId], roundBonus: 1.1 };
  }
  const roundStartBalances: Record<string, number> = {};
  for (const pid of Object.keys(players)) {
    roundStartBalances[pid] = players[pid].balance;
  }
  return {
    ...state, players, playerGameChoices: choices,
    phase: 'round-active',
    timeRemaining: roundDurationFor(state.gameMode, state.currentRound),
    roundDuration: roundDurationFor(state.gameMode, state.currentRound),
    crashPoints: crashPointsForRound(state.roundSeed, 10),
    roundStartBalances, roundEndBalances: {}, lastBalanceUpdate: {},
  };
}

export function startFinalVote(state: GameState): GameState {
  const round = state.currentRound + 1;
  return {
    ...state, phase: 'final-vote', currentRound: round,
    timeRemaining: 10, roundDuration: 10,
    finalVoteOptions: pickN(ALL_GAMES, 2), finalVoteChoices: {},
    coinflipResult: null, playerGameChoices: {}, skipVotes: [],
    roundWinnerId: null, bailoutPending: [], bailoutChoices: {},
    roundSeed: randomSeed(), crashPoints: [], kenoDraws: [],
    roundEndBalances: {}, lastBalanceUpdate: {},
  };
}

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
    if (counts[opt] > max) { max = counts[opt]; winners = [opt]; }
    else if (counts[opt] === max) { winners.push(opt); }
  }
  if (winners.length === 1) return startRoundWithGame(state, winners[0]);
  const coinflipWinner = winners[Math.floor(rng() * winners.length)];
  return { ...state, phase: 'final-coinflip' as Phase, coinflipResult: coinflipWinner, timeRemaining: 4, roundDuration: 4 };
}

export function resolveCoinflip(state: GameState): GameState {
  const game = state.coinflipResult;
  if (!game) return state;
  return startRoundWithGame(state, game);
}

function startRoundWithGame(state: GameState, game: GameName): GameState {
  const choices: Record<string, GameName> = {};
  const activePlayers = Object.keys(state.players).filter((id) => !state.players[id].isEliminated);
  for (const pid of activePlayers) choices[pid] = game;
  const players = { ...state.players };
  for (const pid of Object.keys(players)) players[pid] = { ...players[pid], roundBonus: 1.0 };
  if (state.roundWinnerId && players[state.roundWinnerId]) {
    players[state.roundWinnerId] = { ...players[state.roundWinnerId], roundBonus: 1.1 };
  }
  const roundStartBalances: Record<string, number> = {};
  for (const pid of Object.keys(players)) roundStartBalances[pid] = players[pid].balance;
  return {
    ...state, players, playerGameChoices: choices,
    availableGames: [game], finalVoteOptions: [game],
    phase: 'round-active' as Phase,
    timeRemaining: roundDurationFor(state.gameMode, state.currentRound),
    roundDuration: roundDurationFor(state.gameMode, state.currentRound),
    crashPoints: crashPointsForRound(state.roundSeed, 10),
    roundStartBalances, roundEndBalances: {}, lastBalanceUpdate: {}, coinflipResult: null,
  };
}

export function startRoundTimeout(state: GameState): GameState {
  const players = { ...state.players };
  const bailoutPending: string[] = [];
  for (const pid of Object.keys(players)) {
    const p = players[pid];
    if (p.balance <= 0 && !p.isEliminated && !p.bailoutUsed && !p.bailoutBlocked) {
      bailoutPending.push(pid);
    }
  }
  let winnerId: string | null = null;
  let max = -Infinity;
  for (const pid of Object.keys(players)) {
    if (players[pid].isEliminated) continue;
    if (players[pid].balance > max) { max = players[pid].balance; winnerId = pid; }
  }
  return { ...state, phase: 'round-timeout', timeRemaining: 10, roundDuration: 10, roundWinnerId: winnerId, bailoutPending, bailoutChoices: {} };
}

export function applyBailout(state: GameState, playerId: string, amount: number): GameState {
  const players = { ...state.players };
  if (!players[playerId]) return state;
  players[playerId] = { ...players[playerId], balance: players[playerId].balance + amount, bailoutUsed: true };
  const bailoutChoices = { ...state.bailoutChoices, [playerId]: amount };
  const bailoutPending = state.bailoutPending.filter((id) => id !== playerId);
  const bailoutPenaltyPending = state.bailoutPenaltyPending.includes(playerId)
    ? state.bailoutPenaltyPending : [...state.bailoutPenaltyPending, playerId];
  return { ...state, players, bailoutChoices, bailoutPending, bailoutPenaltyPending };
}

export function collectRoundEndBalances(state: GameState, balances: Record<string, number>): GameState {
  const players = { ...state.players };
  const penaltyServed: string[] = [];
  for (const pid of Object.keys(balances)) {
    if (players[pid]) {
      let newBalance = balances[pid];
      if (state.bailoutPenaltyPending.includes(pid)) {
        const startBalance = state.roundStartBalances[pid] ?? players[pid].balance;
        const profit = Math.max(0, newBalance - startBalance);
        newBalance = newBalance - profit * 0.1;
        penaltyServed.push(pid);
      }
      // Clear consumed power effects at round end
      players[pid] = {
        ...players[pid],
        balance: Math.max(0, Math.round(newBalance * 100) / 100),
        doubleOrNothing: false,
        insured: false,
        jackpotMagnet: false,
        cursed: false,
        bailoutBlocked: false,
        mirroredBy: null,
        goldRushUntil: 0,
        frozenUntil: 0,
      };
    }
  }
  const remainingPenalty = state.bailoutPenaltyPending.filter((id) => !penaltyServed.includes(id));
  for (const pid of penaltyServed) {
    if (players[pid]) players[pid] = { ...players[pid], bailoutUsed: false };
  }
  for (const pid of Object.keys(players)) {
    if (players[pid].balance <= 0 && players[pid].bailoutUsed) {
      players[pid] = { ...players[pid], isEliminated: true, balance: 0 };
    }
  }
  return { ...state, players, roundEndBalances: balances, lastBalanceUpdate: balances, bailoutPenaltyPending: remainingPenalty };
}

export function skipRound(state: GameState): GameState {
  const players = { ...state.players };
  for (const pid of Object.keys(players)) {
    const liveBalance = state.lastBalanceUpdate[pid];
    if (liveBalance !== undefined && !players[pid].isEliminated) {
      players[pid] = { ...players[pid], balance: liveBalance };
    }
  }
  if (state.currentRound >= state.totalRounds) {
    return { ...state, players, skipVotes: [], phase: 'results' as Phase };
  }
  return startRoundTimeout({ ...state, players, skipVotes: [] });
}

export function endRound(state: GameState, balances: Record<string, number>): GameState {
  const collected = collectRoundEndBalances(state, balances);
  if (collected.currentRound >= collected.totalRounds) {
    return { ...collected, phase: 'results' as Phase };
  }
  return startRoundTimeout(collected);
}

export function advanceAfterTimeout(state: GameState): GameState {
  if (state.currentRound >= state.totalRounds) {
    return { ...state, phase: 'results' as Phase };
  }
  const nextRound = state.currentRound + 1;
  if (nextRound === state.totalRounds) return startFinalVote({ ...state });
  return startGameSelect({ ...state });
}

export function sortedPlayers(state: GameState): Player[] {
  return Object.values(state.players).sort((a, b) => b.balance - a.balance);
}

export function resetForPlayAgain(state: GameState): GameState {
  const players: Record<string, Player> = {};
  for (const pid of Object.keys(state.players)) {
    players[pid] = {
      ...state.players[pid],
      balance: 100, roundBonus: 1.0, bailoutUsed: false, isEliminated: false,
      power: null, doubleOrNothing: false, goldRushUntil: 0, insured: false,
      jackpotMagnet: false, frozenUntil: 0, cursed: false, bailoutBlocked: false, mirroredBy: null,
    };
  }
  return {
    ...makeInitialState(players[state.hostId], state.gameMode),
    players, phase: 'lobby', powersEnabled: state.powersEnabled,
  };
}
