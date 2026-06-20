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
      <header className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display text-2xl text-gold">🏁 Final Round Vote</h2>
          <p className="text-xs text-muted-foreground">
            Vote for the final game. {voteCount}/{totalPlayers} voted
          </p>
        </div>
        <RoundTimer remaining={timeRemaining} total={state.roundDuration} label="Vote Time" compact />
        <button onClick={onLeave} className="text-xs text-muted-foreground hover:text-lose">Leave</button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <p className="text-lg text-muted-foreground">
            Which game will be the <span className="text-gold font-bold">FINAL ROUND</span>?
          </p>
          <p className="text-xs text-muted-foreground mt-1">Majority wins. Tie = random.</p>
        </motion.div>

        <div className="grid grid-cols-2 gap-6 max-w-2xl w-full">
          {state.finalVoteOptions.map((g, i) => {
            const meta = GAME_META[g];
            const isPicked = selected === g;
            const voteCount = Object.values(state.finalVoteChoices).filter((v) => v === g).length;
            const pct = totalPlayers > 0 ? (voteCount / totalPlayers) * 100 : 0;
            return (
              <motion.button
                key={g}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.15, type: 'spring' }}
                whileHover={{ scale: 1.04, y: -4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleVote(g)}
                className={cn(
                  'panel p-8 text-center transition-all border-2 relative overflow-hidden',
                  isPicked ? 'border-gold glow-gold-strong' : 'border-[#2a2a2a] hover:border-gold',
                )}
                style={{ borderColor: isPicked ? meta.accent : undefined }}
              >
                <div className="text-7xl mb-3">{meta.icon}</div>
                <h3 className="font-display text-3xl text-gold mb-2">{meta.label}</h3>
                <p className="text-sm text-muted-foreground mb-3">{meta.description}</p>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#0a0a0a]">
                  <motion.div
                    className="h-full bg-gold"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  {voteCount} vote{voteCount !== 1 ? 's' : ''}
                </div>
              </motion.button>
            );
          })}
        </div>

        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-gold"
          >
            ✓ You voted for {GAME_META[selected].label}
          </motion.div>
        )}
      </div>
    </div>
  );
}
