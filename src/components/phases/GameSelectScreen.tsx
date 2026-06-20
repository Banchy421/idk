'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameState, Player, GameName } from '@/lib/types';
import { GAME_META } from '@/lib/games-meta';
import { useTimer } from '@/hooks/useTimer';
import { Sound } from '@/lib/sounds';
import { RoundTimer } from '@/components/game/RoundTimer';
import { cn } from '@/lib/utils';

interface GameSelectScreenProps {
  state: GameState;
  self: Player | null;
  isHost: boolean;
  onSelect: (game: GameName) => void;
  onAdvance: () => void;
  onLeave: () => void;
}

export function GameSelectScreen({ state, self, isHost, onSelect, onAdvance, onLeave }: GameSelectScreenProps) {
  // Local override for pick — falls back to what host has recorded
  const [localPick, setLocalPick] = useState<GameName | undefined>(undefined);
  const remotePick = self ? state.playerGameChoices[self.id] : undefined;
  const selected = localPick ?? remotePick;

  const timeRemaining = useTimer(
    state.timeRemaining,
    state.phase,
    () => {},
    () => {
      // Time's up — host auto-advances
      if (isHost) onAdvance();
    },
  );

  const handlePick = (g: GameName) => {
    if (timeRemaining <= 0) return;
    setLocalPick(g);
    onSelect(g);
    Sound.click();
  };

  const allPicked = Object.keys(state.players).every((pid) => state.playerGameChoices[pid]);
  const playerCount = Object.keys(state.players).length;
  const pickedCount = Object.keys(state.playerGameChoices).length;

  return (
    <div className="min-h-screen flex flex-col p-4">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display text-2xl text-gold">
            {state.currentRound === state.totalRounds
              ? 'Final Round — Pick Your Game'
              : `Round ${state.currentRound} — Pick Your Game`}
          </h2>
          <p className="text-xs text-muted-foreground">
            {pickedCount}/{playerCount} players picked
          </p>
        </div>
        <RoundTimer remaining={timeRemaining} total={state.roundDuration} label="Pick Time" compact />
        <button onClick={onLeave} className="text-xs text-muted-foreground hover:text-lose">Leave</button>
      </header>

      <div className="flex-1 grid md:grid-cols-3 gap-4 items-center">
        {state.availableGames.map((g, i) => {
          const meta = GAME_META[g];
          const isPicked = selected === g;
          const pickerCount = Object.values(state.playerGameChoices).filter((v) => v === g).length;
          return (
            <motion.button
              key={g}
              initial={{ opacity: 0, y: 30, rotate: -2 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              transition={{ delay: i * 0.1, type: 'spring' }}
              whileHover={{ scale: 1.04, y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handlePick(g)}
              className={cn(
                'panel p-6 text-left transition-all border-2',
                isPicked
                  ? 'border-gold glow-gold-strong bg-gold bg-opacity-5'
                  : 'border-[#2a2a2a] hover:border-gold',
              )}
              style={{ borderColor: isPicked ? meta.accent : undefined }}
            >
              <div className="text-6xl mb-3">{meta.icon}</div>
              <h3 className="font-display text-2xl text-gold mb-2">{meta.label}</h3>
              <p className="text-sm text-muted-foreground mb-3">{meta.description}</p>
              {pickerCount > 0 && (
                <div className="text-xs text-muted-foreground">
                  {pickerCount} player{pickerCount !== 1 ? 's' : ''} picked
                </div>
              )}
              {isPicked && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="mt-3 inline-block px-3 py-1 bg-gold text-black text-xs font-bold rounded"
                >
                  ✓ YOUR PICK
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          {selected
            ? `Selected: ${GAME_META[selected].label}. You can change your mind.`
            : 'Click a game to pick. If you don\'t pick, one will be assigned randomly.'}
        </div>
        {isHost && (
          <button
            onClick={onAdvance}
            disabled={!allPicked}
            onMouseEnter={() => Sound.hover()}
            className={cn(
              'px-6 py-2.5 rounded-md font-bold transition-all',
              allPicked
                ? 'bg-gold hover:bg-gold-dark text-black'
                : 'bg-[#2a2a2a] text-muted-foreground cursor-not-allowed',
            )}
          >
            {allPicked ? 'Start Round' : 'Waiting for picks...'}
          </button>
        )}
      </div>
    </div>
  );
}
