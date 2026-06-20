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
import { cn } from '@/lib/utils';

interface GameLayoutProps {
  state: GameState;
  self: Player | null;
  isHost: boolean;
  onSkipVote: () => void;
  onUnskipVote: () => void;
  onLiveBalance: (balance: number) => void;
  onRoundEndBalance: (balance: number) => void;
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
  state, self, isHost, onSkipVote, onUnskipVote, onLiveBalance, onRoundEndBalance, onLeave,
}: GameLayoutProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [liveBalance, setLiveBalance] = useState(self?.balance ?? 100);
  const liveBalanceRef = useRef(liveBalance);
  useEffect(() => { liveBalanceRef.current = liveBalance; }, [liveBalance]);

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
      <header className="border-b border-[#2a2a2a] bg-[#1a1a1a] bg-opacity-50 backdrop-blur px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {isMobile && (
            <span className="text-xs text-muted-foreground">#{state.currentRound}/{state.totalRounds}</span>
          )}
          {!isMobile && (
            <>
              <span className="text-xs text-muted-foreground uppercase tracking-widest">Round</span>
              <span className="font-display font-bold text-gold text-lg">{state.currentRound}/{state.totalRounds}</span>
              {gameMeta && (
                <span className="text-sm text-muted-foreground ml-3">
                  <span className="mr-1">{gameMeta.icon}</span>{gameMeta.label}
                </span>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          {bonusMultiplier > 1 && (
            <span className="text-xs px-2 py-1 bg-gold bg-opacity-20 text-gold rounded">
              +{Math.round((bonusMultiplier - 1) * 100)}% bonus
            </span>
          )}
          {bailoutPenalty && (
            <span className="text-xs px-2 py-1 bg-lose bg-opacity-20 text-lose rounded">
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
          <button onClick={onLeave} className="text-xs text-muted-foreground hover:text-lose">
            Leave
          </button>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Sidebar — desktop only */}
        {!isMobile && (
          <aside className="w-72 p-3 border-r border-[#2a2a2a] flex flex-col gap-3">
            <RoundTimer remaining={timeRemaining} total={state.roundDuration} label="Time Left" />
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
        <main className="flex-1 p-3 flex flex-col min-w-0">
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
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
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
                <div className="text-center text-muted-foreground">
                  <div className="font-display text-2xl mb-2">Waiting for game assignment...</div>
                  <div className="text-sm">The host will assign you a game shortly.</div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
