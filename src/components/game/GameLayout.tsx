'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameState, Player, GameName } from '@/lib/types';
import { Leaderboard } from './Leaderboard';
import { RoundTimer } from './RoundTimer';
import { SkipVoteButton } from './SkipVoteButton';
import { GAME_META } from '@/lib/games-meta';
import { useTimer } from '@/hooks/useTimer';
import { Sound } from '@/lib/sounds';
import { Tower } from '@/components/games/Tower';
import { Plinko } from '@/components/games/Plinko';
import { Mines } from '@/components/games/Mines';
import { Slots } from '@/components/games/Slots';
import { Blackjack } from '@/components/games/Blackjack';
import { Crash } from '@/components/games/Crash';
import { Coinflip } from '@/components/games/Coinflip';
import { Keno } from '@/components/games/Keno';
import { ThemePicker } from '@/components/theme/ThemePicker';
import { PowerButton } from './PowerButton';
import { PowerEffects } from './PowerEffects';
import { cn } from '@/lib/utils';

interface GameLayoutProps {
  state: GameState;
  self: Player | null;
  isHost: boolean;
  onSkipVote: () => void;
  onUnskipVote: () => void;
  onLiveBalance: (balance: number) => void;
  onRoundEndBalance: (balance: number) => void;
  onForceEndRound: () => void;
  onActivatePower: (targetId?: string) => void;
  onLeave: () => void;
}

interface GameProps {
  balance: number;
  onBalanceChange: (newBalance: number) => void;
  bonusMultiplier: number;
  bailoutPenalty: boolean;
  timeRemaining: number;
  seed: number;
}

const GAME_COMPONENTS: Record<GameName, React.ComponentType<GameProps>> = {
  tower: Tower,
  plinko: Plinko,
  mines: Mines,
  slots: Slots,
  blackjack: Blackjack,
  crash: Crash,
  coinflip: Coinflip,
  keno: Keno,
};

export function GameLayout({
  state, self, isHost, onSkipVote, onUnskipVote, onLiveBalance, onRoundEndBalance, onForceEndRound, onActivatePower, onLeave,
}: GameLayoutProps) {
  const [isMobile, setIsMobile] = useState(false);
  // Initialize from the authoritative balance in game state (not 100).
  // self?.balance comes from the host's broadcast state and is always current.
  // We use `state.currentRound` in the key to force re-mount per round, which
  // re-initializes liveBalance from the latest self.balance.
  const initialBalance = self?.balance ?? state.players[self?.id ?? '']?.balance ?? 100;
  const [liveBalance, setLiveBalance] = useState(initialBalance);
  const liveBalanceRef = useRef(liveBalance);
  useEffect(() => { liveBalanceRef.current = liveBalance; }, [liveBalance]);

  // Sync liveBalance when the authoritative player balance changes from power effects
  // (Heist, Swap modify balance directly on state.players, not via onBalanceChange)
  const stateBalance = self?.balance ?? 0;
  const prevPowerUsed = useRef(false);
  useEffect(() => {
    if (self?.power?.used && !prevPowerUsed.current) {
      prevPowerUsed.current = true;
      queueMicrotask(() => setLiveBalance(stateBalance));
    } else if (!self?.power?.used) {
      prevPowerUsed.current = false;
    }
  }, [stateBalance, self?.power?.used]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const timeRemaining = useTimer(
    state.timeRemaining,
    state.phase,
    () => {},
    () => {
      // When timer hits 0, send final balance to host
      onRoundEndBalance(liveBalanceRef.current);
      Sound.countdownEnd();
    },
  );

  // Periodic live balance broadcast (every 2s)
  useEffect(() => {
    if (state.phase !== 'round-active') return;
    const id = setInterval(() => {
      onLiveBalance(liveBalanceRef.current);
    }, 2000);
    return () => clearInterval(id);
  }, [state.phase, onLiveBalance]);

  // Final live balance + round-end balance when 1s left
  useEffect(() => {
    if (state.phase !== 'round-active') return;
    if (timeRemaining <= 1 && timeRemaining > 0) {
      onLiveBalance(liveBalanceRef.current);
    }
  }, [timeRemaining, state.phase, onLiveBalance]);

  const myGame: GameName | null = self ? (state.playerGameChoices[self.id] ?? null) : null;
  const GameComponent = myGame ? GAME_COMPONENTS[myGame] : null;
  const gameMeta = myGame ? GAME_META[myGame] : null;

  const bonusMultiplier = self?.roundBonus ?? 1.0;
  const bailoutPenalty = (self?.bailoutUsed ?? false) && (self?.roundBonus ?? 1.0) < 1.0;

  const handleBalanceChange = (newBalance: number) => {
    const rounded = Math.max(0, Math.round(newBalance * 100) / 100);
    setLiveBalance(rounded);
  };

  // Build live balances for leaderboard
  const liveBalances = useMemo(() => {
    const out: Record<string, number> = {};
    for (const pid of Object.keys(state.players)) {
      out[pid] = state.lastBalanceUpdate[pid] ?? state.players[pid].balance;
    }
    if (self) out[self.id] = liveBalance;
    return out;
  }, [state.lastBalanceUpdate, state.players, self, liveBalance]);

  const skipVoted = self ? state.skipVotes.includes(self.id) : false;
  const activePlayerCount = Object.values(state.players).filter((p) => !p.isEliminated).length;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar — always visible */}
      <header
        className="px-4 py-2.5 flex items-center justify-between gap-2 border-b"
        style={{ backgroundColor: 'var(--sf-bg-secondary)', borderColor: 'var(--sf-border)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          {isMobile && (
            <span className="text-xs" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
              {state.currentRound}/{state.totalRounds}
            </span>
          )}
          {!isMobile && (
            <>
              <span className="text-xs" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>Round</span>
              <span className="font-display text-base" style={{ color: 'var(--sf-text)', fontWeight: 500 }}>
                {state.currentRound}/{state.totalRounds}
              </span>
              {gameMeta && (
                <span className="text-sm ml-2" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
                  {gameMeta.label}
                </span>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {bonusMultiplier > 1 && (
            <span
              className="text-xs px-2 py-0.5 rounded"
              style={{ backgroundColor: 'var(--sf-border)', color: 'var(--sf-text)', fontWeight: 400 }}
            >
              +{Math.round((bonusMultiplier - 1) * 100)}% bonus
            </span>
          )}
          {bailoutPenalty && (
            <span
              className="text-xs px-2 py-0.5 rounded"
              style={{ backgroundColor: 'var(--sf-border)', color: 'var(--sf-lose)', fontWeight: 400 }}
            >
              −10% bailout penalty
            </span>
          )}
          <SkipVoteButton
            voted={skipVoted}
            count={state.skipVotes.length}
            total={activePlayerCount}
            onVote={onSkipVote}
            onUnvote={onUnskipVote}
          />
          {isHost && (
            <button
              onClick={onForceEndRound}
              className="text-xs px-2.5 py-1.5 rounded-md border transition-colors"
              style={{
                backgroundColor: 'var(--sf-bg)',
                borderColor: 'var(--sf-border)',
                color: 'var(--sf-text-muted)',
                fontWeight: 400,
              }}
              title="Force-end this round immediately (use if round is stuck)"
            >
              Force end
            </button>
          )}
          <ThemePicker compact />
          <button
            onClick={onLeave}
            className="text-xs transition-colors"
            style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}
          >
            Leave
          </button>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Sidebar — desktop only */}
        {!isMobile && (
          <aside
            className="w-72 p-4 flex flex-col gap-4 border-r"
            style={{ borderColor: 'var(--sf-border)' }}
          >
            <RoundTimer remaining={timeRemaining} total={state.roundDuration} label="Time left" />
            <div className="flex-1 min-h-0">
              <Leaderboard
                players={state.players}
                selfId={self?.id ?? ''}
                liveBalances={liveBalances}
              />
            </div>
          </aside>
        )}

        {/* Main game area */}
        <main className="flex-1 p-4 flex flex-col min-w-0">
          {isMobile && (
            <>
              <RoundTimer remaining={timeRemaining} total={state.roundDuration} compact />
              <Leaderboard
                players={state.players}
                selfId={self?.id ?? ''}
                liveBalances={liveBalances}
                collapsed
              />
            </>
          )}

          <div className="flex-1 flex items-center justify-center min-h-0">
            <AnimatePresence mode="wait">
              {GameComponent && self ? (
                <motion.div
                  key={myGame}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full h-full flex items-center justify-center"
                >
                  <GameComponent
                    balance={liveBalance}
                    onBalanceChange={handleBalanceChange}
                    bonusMultiplier={bonusMultiplier}
                    bailoutPenalty={bailoutPenalty}
                    timeRemaining={timeRemaining}
                    seed={state.roundSeed}
                  />
                </motion.div>
              ) : (
                <div className="text-center">
                  <div className="font-display text-xl mb-1.5" style={{ color: 'var(--sf-text)', fontWeight: 500 }}>
                    Waiting for game assignment...
                  </div>
                  <div className="text-sm" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
                    The host will assign you a game shortly.
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Floating power button — only if powers are enabled and player has a power */}
      {state.powersEnabled && self?.power && (
        <PowerButton state={state} self={self} onActivate={onActivatePower} />
      )}

      {/* Power effect overlays — visual effects for active powers */}
      {state.powersEnabled && self && (
        <PowerEffects state={state} self={self} />
      )}
    </div>
  );
}
