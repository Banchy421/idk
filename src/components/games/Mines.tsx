'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { minesMultiplier, mulberry32 } from '@/lib/utils-casino';
import { Sound } from '@/lib/sounds';
import { formatMoney } from '@/lib/utils-casino';
import { BetControls } from './BetControls';
import { cn } from '@/lib/utils';

interface MinesProps {
  balance: number;
  onBalanceChange: (n: number) => void;
  bonusMultiplier: number;
  bailoutPenalty: boolean;
  timeRemaining: number;
  seed: number;
}

interface GameState {
  status: 'idle' | 'playing' | 'won' | 'lost';
  mineCount: number;
  minePositions: Set<number>;
  revealed: Set<number>;
  bet: number;
}

const TILES = 25;

export function Mines({ balance, onBalanceChange, bonusMultiplier, timeRemaining, seed }: MinesProps) {
  const [bet, setBet] = useState(10);
  const [mineCount, setMineCount] = useState(3);
  const [game, setGame] = useState<GameState>({
    status: 'idle', mineCount: 3, minePositions: new Set(), revealed: new Set(), bet: 10,
  });

  const safePicks = game.revealed.size;
  const currentMult = useMemo(
    () => minesMultiplier(safePicks, game.mineCount),
    [safePicks, game.mineCount],
  );
  const cashOutAmount = bet * currentMult * bonusMultiplier;
  const profit = cashOutAmount - bet;

  const startGame = () => {
    if (balance < bet) { Sound.error(); return; }
    if (timeRemaining <= 3) { Sound.error(); return; }
    Sound.bet();
    onBalanceChange(balance - bet);
    // Seeded mine placement
    const rng = mulberry32((seed ^ Date.now()) >>> 0);
    const positions = new Set<number>();
    while (positions.size < mineCount) {
      positions.add(Math.floor(rng() * TILES));
    }
    setGame({
      status: 'playing',
      mineCount,
      minePositions: positions,
      revealed: new Set(),
      bet,
    });
  };

  const revealTile = (idx: number) => {
    if (game.status !== 'playing') return;
    if (game.revealed.has(idx)) return;
    const newRevealed = new Set(game.revealed);
    newRevealed.add(idx);

    if (game.minePositions.has(idx)) {
      // Hit a mine — lose
      Sound.explosion();
      setGame({ ...game, status: 'lost', revealed: newRevealed });
      setTimeout(() => {
        setGame({
          status: 'idle', mineCount, minePositions: new Set(), revealed: new Set(), bet,
        });
      }, 3000);
    } else {
      Sound.gem();
      setGame({ ...game, revealed: newRevealed });
    }
  };

  const cashOut = () => {
    if (game.status !== 'playing' || game.revealed.size === 0) return;
    onBalanceChange(balance + cashOutAmount);
    if (currentMult >= 5) Sound.winBig();
    else Sound.winSmall();
    Sound.cashRegister();
    setGame({ ...game, status: 'won' });
    setTimeout(() => {
      setGame({
        status: 'idle', mineCount, minePositions: new Set(), revealed: new Set(), bet,
      });
    }, 2500);
  };

  const tiles: { idx: number; isMine: boolean; isRevealed: boolean }[] = Array.from(
    { length: TILES },
    (_, i) => ({
      idx: i,
      isMine: game.minePositions.has(i),
      isRevealed: game.revealed.has(i),
    }),
  );

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4">
      <div className="text-center">
        <h2 className="font-display text-3xl text-gold mb-1">💣 Mines</h2>
        <p className="text-xs text-muted-foreground">Reveal gems, avoid mines. More mines = bigger multipliers.</p>
      </div>

      <BetControls balance={balance} bet={bet} setBet={setBet} disabled={game.status === 'playing'} />

      {/* Mine count selector */}
      {game.status === 'idle' && (
        <div className="panel p-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Number of Mines</span>
            <span className="text-gold font-mono">{mineCount}</span>
          </div>
          <input
            type="range"
            min={3}
            max={10}
            value={mineCount}
            onChange={(e) => { setMineCount(parseInt(e.target.value, 10)); Sound.hover(); }}
            className="w-full accent-[#C9A84C]"
          />
          <div className="text-xs text-muted-foreground text-center">
            Next safe pick: <span className="text-gold font-mono">{minesMultiplier(game.revealed.size + 1, mineCount).toFixed(2)}×</span>
          </div>
        </div>
      )}

      {/* Game grid */}
      <div className="panel p-3">
        <div className="grid grid-cols-5 gap-2">
          {tiles.map((tile) => {
            const showMine = (tile.isMine && (tile.isRevealed || game.status === 'lost'));
            const showGem = tile.isRevealed && !tile.isMine;
            return (
              <motion.button
                key={tile.idx}
                layout
                onClick={() => revealTile(tile.idx)}
                disabled={game.status !== 'playing' || tile.isRevealed}
                whileHover={game.status === 'playing' && !tile.isRevealed ? { scale: 1.05 } : {}}
                whileTap={game.status === 'playing' && !tile.isRevealed ? { scale: 0.95 } : {}}
                className={cn(
                  'aspect-square rounded-md flex items-center justify-center text-2xl border transition-all',
                  !tile.isRevealed && 'bg-[#0a0a0a] border-[#2a2a2a] hover:border-gold',
                  showGem && 'bg-win bg-opacity-20 border-win',
                  showMine && 'bg-lose bg-opacity-30 border-lose shake',
                )}
              >
                <AnimatePresence mode="wait">
                  {showGem && (
                    <motion.span
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                    >
                      💎
                    </motion.span>
                  )}
                  {showMine && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200 }}
                    >
                      💣
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {game.status === 'idle' && (
          <button
            onClick={startGame}
            disabled={balance < bet || timeRemaining <= 3}
            onMouseEnter={() => Sound.hover()}
            className={cn(
              'flex-1 py-3 rounded-md font-bold transition-all',
              balance >= bet && timeRemaining > 3
                ? 'bg-gold hover:bg-gold-dark text-black glow-gold'
                : 'bg-[#2a2a2a] text-muted-foreground cursor-not-allowed',
            )}
          >
            {balance >= bet ? `Start (−${formatMoney(bet)})` : 'Not enough balance'}
          </button>
        )}
        {game.status === 'playing' && (
          <>
            <div className="flex-1 panel p-3 text-center">
              <div className="text-xs text-muted-foreground">Current Multiplier</div>
              <div className="font-display text-2xl text-gold">{currentMult.toFixed(2)}×</div>
              <div className="text-xs text-win font-mono">+{formatMoney(profit)}</div>
            </div>
            <button
              onClick={cashOut}
              disabled={game.revealed.size === 0}
              onMouseEnter={() => Sound.hover()}
              className={cn(
                'flex-1 py-3 rounded-md font-bold transition-all',
                game.revealed.size > 0
                  ? 'bg-win hover:bg-green-700 text-white glow-win'
                  : 'bg-[#2a2a2a] text-muted-foreground cursor-not-allowed',
              )}
            >
              {game.revealed.size > 0 ? `Cash Out (${formatMoney(cashOutAmount)})` : 'Reveal to cash out'}
            </button>
          </>
        )}
        {game.status === 'lost' && (
          <div className="flex-1 py-3 rounded-md font-bold bg-lose text-white text-center">
            💥 Boom! Lost {formatMoney(bet)}
          </div>
        )}
        {game.status === 'won' && (
          <div className="flex-1 py-3 rounded-md font-bold bg-win text-white text-center">
            💰 Cashed out: +{formatMoney(profit)}
          </div>
        )}
      </div>
    </div>
  );
}
