'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
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
  const balanceRef = useRef(balance);
  useEffect(() => { balanceRef.current = balance; }, [balance]);

  const safePicks = game.revealed.size;
  const currentMult = useMemo(
    () => minesMultiplier(safePicks, game.mineCount),
    [safePicks, game.mineCount],
  );
  const cashOutAmount = bet * currentMult * bonusMultiplier;
  const profit = cashOutAmount - bet;

  const startGame = () => {
    if (balanceRef.current < bet) { Sound.error(); return; }
    if (timeRemaining <= 3) { Sound.error(); return; }
    Sound.bet();
    onBalanceChange(balanceRef.current - bet);
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
      Sound.explosion();
      setGame({ ...game, status: 'lost', revealed: newRevealed });
      setTimeout(() => {
        setGame({ status: 'idle', mineCount, minePositions: new Set(), revealed: new Set(), bet });
      }, 3000);
    } else {
      Sound.gem();
      setGame({ ...game, revealed: newRevealed });
    }
  };

  const cashOut = () => {
    if (game.status !== 'playing' || game.revealed.size === 0) return;
    onBalanceChange(balanceRef.current + cashOutAmount);
    if (currentMult >= 5) Sound.winBig();
    else Sound.winSmall();
    Sound.cashRegister();
    setGame({ ...game, status: 'won' });
    setTimeout(() => {
      setGame({ status: 'idle', mineCount, minePositions: new Set(), revealed: new Set(), bet });
    }, 2500);
  };

  const tiles = Array.from({ length: TILES }, (_, i) => ({
    idx: i,
    isMine: game.minePositions.has(i),
    isRevealed: game.revealed.has(i),
  }));

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-2.5">
      <div className="text-center">
        <h2 className="font-display text-xl mb-0.5" style={{ fontWeight: 500, color: 'var(--sf-text)' }}>Mines</h2>
        <p className="text-xs" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>Reveal gems, avoid mines. More mines = bigger multipliers.</p>
      </div>

      <BetControls balance={balance} bet={bet} setBet={setBet} disabled={game.status === 'playing'} />

      {game.status === 'idle' && (
        <div className="panel p-2.5 flex items-center gap-3">
          <span className="text-xs whitespace-nowrap" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>Mines: <span className="font-mono" style={{ color: 'var(--sf-text)' }}>{mineCount}</span></span>
          <input
            type="range"
            min={3}
            max={10}
            value={mineCount}
            onChange={(e) => { setMineCount(parseInt(e.target.value, 10)); Sound.hover(); }}
            className="flex-1"
            style={{ accentColor: 'var(--sf-accent)' }}
          />
          <span className="text-xs whitespace-nowrap font-mono" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>Next: {minesMultiplier(game.revealed.size + 1, mineCount).toFixed(2)}×</span>
        </div>
      )}

      {/* Compact inline stats for playing state */}
      {game.status === 'playing' && (
        <div className="flex gap-2">
          <div className="panel px-3 py-1.5 flex-1 flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>Mult</span>
            <span className="font-mono text-sm" style={{ color: 'var(--sf-text)', fontWeight: 500 }}>{currentMult.toFixed(2)}×</span>
            <span className="text-xs font-mono" style={{ color: 'var(--sf-win)', fontWeight: 400 }}>+{formatMoney(profit)}</span>
          </div>
        </div>
      )}

      <div className="panel p-2.5">
        <div className="grid grid-cols-5 gap-1">
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
                  'aspect-square rounded-md flex items-center justify-center text-lg transition-colors',
                  showMine && 'shake',
                )}
                style={{
                  backgroundColor: showGem ? 'var(--sf-win)' : showMine ? 'var(--sf-lose)' : 'var(--sf-bg)',
                  border: '0.5px solid var(--sf-border)',
                  color: 'var(--sf-bg)',
                }}
              >
                <AnimatePresence mode="wait">
                  {showGem && (
                    <motion.span
                      initial={{ scale: 0, rotate: -90 }}
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

      <div className="flex gap-2">
        {game.status === 'idle' && (
          <button
            onClick={startGame}
            disabled={balance < bet || timeRemaining <= 3}
            className="btn-premium flex-1 py-2.5"
            style={{ opacity: (balance < bet || timeRemaining <= 3) ? 0.5 : 1, cursor: (balance < bet || timeRemaining <= 3) ? 'not-allowed' : 'pointer' }}
          >
            {balance >= bet ? `Start (−${formatMoney(bet)})` : 'Not enough balance'}
          </button>
        )}
        {game.status === 'playing' && (
          <button
            onClick={cashOut}
            disabled={game.revealed.size === 0}
            className="flex-1 py-2.5 rounded-md transition-colors"
            style={{
              backgroundColor: game.revealed.size > 0 ? 'var(--sf-win)' : 'var(--sf-border)',
              color: 'var(--sf-bg)',
              fontWeight: 400,
              cursor: game.revealed.size > 0 ? 'pointer' : 'not-allowed',
            }}
          >
            {game.revealed.size > 0 ? `Cash out (${formatMoney(cashOutAmount)})` : 'Reveal to cash out'}
          </button>
        )}
        {game.status === 'lost' && (
          <div className="flex-1 py-2.5 rounded-md text-center" style={{ backgroundColor: 'var(--sf-lose)', color: 'var(--sf-bg)', fontWeight: 400 }}>
            Boom! Lost {formatMoney(bet)}
          </div>
        )}
        {game.status === 'won' && (
          <div className="flex-1 py-2.5 rounded-md text-center" style={{ backgroundColor: 'var(--sf-win)', color: 'var(--sf-bg)', fontWeight: 400 }}>
            Cashed out: +{formatMoney(profit)}
          </div>
        )}
      </div>
    </div>
  );
}
