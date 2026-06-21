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
  const [localPick, setLocalPick] = useState<GameName | undefined>(undefined);
  const remotePick = self ? state.playerGameChoices[self.id] : undefined;
  const selected = localPick ?? remotePick;

  const timeRemaining = useTimer(
    state.timeRemaining,
    state.phase,
    () => {},
    () => {
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
      <header className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-2xl mb-1" style={{ fontWeight: 500, color: 'var(--sf-text)' }}>
            {state.currentRound === state.totalRounds
              ? 'Final round — pick your game'
              : `Round ${state.currentRound} — pick your game`}
          </h2>
          <p className="text-xs" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
            {pickedCount}/{playerCount} players picked
          </p>
        </div>
        <RoundTimer remaining={timeRemaining} total={state.roundDuration} label="Pick time" compact />
        <button
          onClick={onLeave}
          className="text-xs transition-colors"
          style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}
        >
          Leave
        </button>
      </header>

      <div className="flex-1 grid md:grid-cols-3 gap-3 items-stretch max-w-4xl mx-auto w-full">
        {state.availableGames.map((g, i) => {
          const meta = GAME_META[g];
          const isPicked = selected === g;
          const pickerCount = Object.values(state.playerGameChoices).filter((v) => v === g).length;
          return (
            <motion.button
              key={g}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => handlePick(g)}
              className="panel p-6 text-left transition-colors flex flex-col h-full"
              style={{
                borderColor: isPicked ? 'var(--sf-accent)' : 'var(--sf-border)',
                backgroundColor: isPicked ? 'var(--sf-border)' : 'var(--sf-bg-secondary)',
              }}
            >
              <div className="text-4xl mb-4">{meta.icon}</div>
              <h3 className="font-display text-xl mb-1.5" style={{ fontWeight: 500, color: 'var(--sf-text)' }}>
                {meta.label}
              </h3>
              <p className="text-sm mb-4 flex-1" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
                {meta.description}
              </p>
              {pickerCount > 0 && (
                <div className="text-xs" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
                  {pickerCount} player{pickerCount !== 1 ? 's' : ''} picked
                </div>
              )}
              {isPicked && (
                <div
                  className="mt-3 inline-block px-2.5 py-0.5 rounded text-xs self-start"
                  style={{ backgroundColor: 'var(--sf-accent)', color: 'var(--sf-text)', fontWeight: 400 }}
                >
                  Your pick
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-between gap-4 max-w-4xl mx-auto w-full">
        <div className="text-sm" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
          {selected
            ? `Selected: ${GAME_META[selected].label}. You can change your mind.`
            : 'Click a game to pick. If you don\'t pick, one will be assigned randomly.'}
        </div>
        {isHost && (
          <button
            onClick={onAdvance}
            disabled={!allPicked}
            className="px-5 py-2 rounded-md transition-colors"
            style={{
              backgroundColor: allPicked ? 'var(--sf-accent)' : 'var(--sf-border)',
              color: 'var(--sf-text)',
              fontWeight: 400,
              cursor: allPicked ? 'pointer' : 'not-allowed',
            }}
          >
            {allPicked ? 'Start round' : 'Waiting for picks...'}
          </button>
        )}
      </div>
    </div>
  );
}
