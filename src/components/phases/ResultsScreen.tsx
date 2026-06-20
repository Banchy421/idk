'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameState, Player } from '@/lib/types';
import { Sound } from '@/lib/sounds';
import { formatMoney } from '@/lib/utils-casino';
import { cn } from '@/lib/utils';

interface ResultsScreenProps {
  state: GameState;
  self: Player | null;
  isHost: boolean;
  onPlayAgain: () => void;
  onLeave: () => void;
}

export function ResultsScreen({ state, self, isHost, onPlayAgain, onLeave }: ResultsScreenProps) {
  const ranked = useMemo(
    () => Object.values(state.players).sort((a, b) => b.balance - a.balance),
    [state.players],
  );
  const [revealedCount, setRevealedCount] = useState(0);
  const [showFinal, setShowFinal] = useState(false);
  const lastRevealCount = useRef(0);

  // Reveal one by one, bottom to top, with 2s delay
  useEffect(() => {
    if (ranked.length === 0) return;
    // Start from last place
    let idx = 0;
    const reveal = () => {
      if (idx >= ranked.length) {
        setShowFinal(true);
        Sound.fanfareBig();
        return;
      }
      setRevealedCount(idx + 1);
      const p = ranked[idx];
      if (idx === ranked.length - 1) {
        // Winner!
        Sound.fanfareBig();
      } else if (idx === 0) {
        Sound.lose();
      } else {
        Sound.reveal();
      }
      idx++;
      setTimeout(reveal, 2000);
    };
    const startId = setTimeout(reveal, 800);
    return () => clearTimeout(startId);
  }, [ranked]);

  const revealedPlayers = ranked.slice(0, revealedCount);
  const winner = ranked[0];

  return (
    <div className="min-h-screen flex flex-col p-4 relative overflow-hidden">
      {showFinal && <Confetti />}
      <header className="flex items-center justify-between mb-4">
        <h2 className="font-display text-3xl text-gold">Final Results</h2>
        <button onClick={onLeave} className="text-xs text-muted-foreground hover:text-lose">Leave</button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center gap-4 max-w-3xl mx-auto w-full">
        {!showFinal ? (
          <div className="w-full space-y-3">
            <AnimatePresence mode="popLayout">
              {revealedPlayers.slice().reverse().map((p, idxFromBottom) => {
                const realRank = ranked.length - 1 - idxFromBottom;
                const isWinner = realRank === 0;
                const isSelf = p.id === self?.id;
                return (
                  <motion.div
                    key={p.id}
                    layout
                    initial={{ opacity: 0, x: -100, scale: 0.8 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                    className={cn(
                      'panel p-4 flex items-center gap-4',
                      isWinner ? 'border-2 border-gold glow-gold-strong' : 'border-[#2a2a2a]',
                      isSelf && 'border-gold',
                    )}
                  >
                    <div className={cn(
                      'font-display font-bold text-3xl w-12 text-center',
                      isWinner ? 'text-gold' : realRank === 1 ? 'text-gray-300' : realRank === 2 ? 'text-amber-600' : 'text-muted-foreground',
                    )}>
                      {isWinner ? '👑' : `#${realRank + 1}`}
                    </div>
                    <div className="text-4xl">{p.avatar}</div>
                    <div className="flex-1">
                      <div className="font-display text-xl text-white">
                        {p.name} {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {isWinner ? 'CHAMPION' : realRank === ranked.length - 1 ? 'Last Place' : `Rank ${realRank + 1}`}
                      </div>
                    </div>
                    <div className={cn(
                      'font-mono text-2xl font-bold',
                      p.balance > 100 ? 'text-win' : p.balance < 100 ? 'text-lose' : 'text-gold',
                    )}>
                      {formatMoney(p.balance)}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {revealedCount < ranked.length && (
              <div className="text-center text-muted-foreground text-sm pt-4">
                Revealing rank #{ranked.length - revealedCount}...
              </div>
            )}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring' }}
            className="w-full text-center"
          >
            {/* Winner spotlight */}
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="panel p-8 mb-6 border-2 border-gold glow-gold-strong"
            >
              <div className="text-xs text-muted-foreground uppercase tracking-widest mb-2">
                👑 CHAMPION 👑
              </div>
              <div className="text-8xl mb-3">{winner?.avatar}</div>
              <div className="font-display text-4xl text-gold mb-2">{winner?.name}</div>
              <div className="font-mono text-2xl text-win">{formatMoney(winner?.balance ?? 0)}</div>
            </motion.div>

            {/* Full leaderboard */}
            <div className="panel p-3 mb-6 text-left">
              <div className="text-xs text-muted-foreground uppercase tracking-widest mb-2 text-center">
                Final Standings
              </div>
              <div className="space-y-1.5">
                {ranked.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className={cn(
                      'flex items-center gap-3 p-2 rounded-md bg-[#0a0a0a]',
                      i === 0 && 'bg-gold bg-opacity-10',
                      p.id === self?.id && 'border border-gold',
                    )}
                  >
                    <div className={cn(
                      'w-8 text-center font-display font-bold',
                      i === 0 ? 'text-gold' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-muted-foreground',
                    )}>
                      {i + 1}
                    </div>
                    <div className="text-xl">{p.avatar}</div>
                    <div className="flex-1 text-sm">
                      {p.name} {p.id === self?.id && <span className="text-xs text-muted-foreground">(you)</span>}
                    </div>
                    <div className={cn(
                      'font-mono text-sm',
                      p.balance > 100 ? 'text-win' : p.balance < 100 ? 'text-lose' : 'text-muted-foreground',
                    )}>
                      {formatMoney(p.balance)}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {isHost ? (
              <button
                onClick={onPlayAgain}
                onMouseEnter={() => Sound.hover()}
                className="px-8 py-3 bg-gold hover:bg-gold-dark text-black font-bold rounded-md glow-gold-strong"
              >
                Play Again
              </button>
            ) : (
              <div className="text-sm text-muted-foreground">
                Waiting for host to start a new game...
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 100 }, () => ({
    id: Math.random(),
    left: Math.random() * 100,
    delay: Math.random() * 4,
    color: ['#C9A84C', '#E53E3E', '#38A169', '#fff', '#fff5cc'][Math.floor(Math.random() * 5)],
    size: 6 + Math.random() * 10,
  })), []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            animationDelay: `${p.delay}s`,
            backgroundColor: p.color,
            width: p.size,
            height: p.size,
            borderRadius: Math.random() > 0.5 ? '50%' : '0',
          }}
        />
      ))}
    </div>
  );
}
