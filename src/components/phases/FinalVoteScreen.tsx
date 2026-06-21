'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameState, Player, GameName } from '@/lib/types';
import { GAME_META } from '@/lib/games-meta';
import { useTimer } from '@/hooks/useTimer';
import { Sound } from '@/lib/sounds';
import { RoundTimer } from '@/components/game/RoundTimer';
import { cn } from '@/lib/utils';

interface FinalVoteScreenProps {
  state: GameState;
  self: Player | null;
  isHost: boolean;
  onVote: (game: GameName) => void;
  onAdvance: () => void;
  onLeave: () => void;
}

export function FinalVoteScreen({ state, self, isHost, onVote, onAdvance, onLeave }: FinalVoteScreenProps) {
  const [localVote, setLocalVote] = useState<GameName | undefined>(undefined);
  const remoteVote = self ? state.finalVoteChoices[self.id] : undefined;
  const selected = localVote ?? remoteVote;

  const timeRemaining = useTimer(state.timeRemaining, state.phase, () => {}, () => {
    if (isHost) onAdvance();
  });

  const handleVote = (g: GameName) => {
    setLocalVote(g);
    onVote(g);
    Sound.click();
  };

  const totalPlayers = Object.keys(state.players).length;
  const voteCount = Object.keys(state.finalVoteChoices).length;

  return (
    <div className="min-h-screen flex flex-col p-4">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-2xl mb-1" style={{ fontWeight: 500, color: 'var(--sf-text)' }}>
            Final round vote
          </h2>
          <p className="text-xs" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
            Vote for the final game. {voteCount}/{totalPlayers} voted
          </p>
        </div>
        <RoundTimer remaining={timeRemaining} total={state.roundDuration} label="Vote time" compact />
        <button
          onClick={onLeave}
          className="text-xs transition-colors"
          style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}
        >
          Leave
        </button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center gap-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <p className="text-base" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
            Which game will be the <span style={{ color: 'var(--sf-text)', fontWeight: 500 }}>final round</span>?
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
            Majority wins instantly. 50/50 tie = coinflip.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 gap-4 max-w-2xl w-full items-stretch">
          {state.finalVoteOptions.map((g, i) => {
            const meta = GAME_META[g];
            const isPicked = selected === g;
            const votes = Object.values(state.finalVoteChoices).filter((v) => v === g).length;
            const pct = totalPlayers > 0 ? (votes / totalPlayers) * 100 : 0;
            return (
              <motion.button
                key={g}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => handleVote(g)}
                className="panel p-8 text-center transition-colors relative overflow-hidden flex flex-col h-full"
                style={{
                  borderColor: isPicked ? 'var(--sf-accent)' : 'var(--sf-border)',
                  backgroundColor: isPicked ? 'var(--sf-border)' : 'var(--sf-bg-secondary)',
                }}
              >
                <div className="text-6xl mb-3">{meta.icon}</div>
                <h3 className="font-display text-2xl mb-2" style={{ fontWeight: 500, color: 'var(--sf-text)' }}>
                  {meta.label}
                </h3>
                <p className="text-sm mb-3 flex-1" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
                  {meta.description}
                </p>
                <div className="h-0.5 rounded-full overflow-hidden mt-auto" style={{ backgroundColor: 'var(--sf-bg)' }}>
                  <motion.div
                    className="h-full"
                    style={{ backgroundColor: 'var(--sf-accent)' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-xs mt-2" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
                  {votes} vote{votes !== 1 ? 's' : ''}
                </div>
              </motion.button>
            );
          })}
        </div>

        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm"
            style={{ color: 'var(--sf-text)', fontWeight: 400 }}
          >
            You voted for {GAME_META[selected].label}
          </motion.div>
        )}
      </div>
    </div>
  );
}
