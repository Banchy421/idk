'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sound } from '@/lib/sounds';
import { formatMoney } from '@/lib/utils-casino';
import { BetControls } from './BetControls';
import { cn } from '@/lib/utils';

interface TowerProps {
  balance: number;
  onBalanceChange: (n: number) => void;
  bonusMultiplier: number;
  bailoutPenalty: boolean;
  timeRemaining: number;
  seed: number;
}

type GameState = 'idle' | 'playing' | 'busted' | 'cashed';

interface LevelData {
  multiplier: number;
  bombIndex: number;
  pickedIndex: number | null;
  bombChance: number;
}

/** Multiplier per level — starts at 1.10×, grows ~1.18× per level (tapering).
 *  Much lower than before to keep the game balanced. */
function multiplierForLevel(level: number): number {
  if (level <= 0) return 1.10;
  let m = 1.10;
  for (let i = 1; i <= level; i++) {
    const growth = i < 4 ? 1.18 : i < 8 ? 1.13 : i < 12 ? 1.08 : 1.05;
    m *= growth;
  }
  return Math.round(m * 100) / 100;
}

/** Bomb chance per level — starts at 33%, increases 2% per level, capped at 85%.
 *  Gentler curve so climbing feels more rewarding. */
function bombChanceForLevel(level: number): number {
  return Math.min(0.85, 0.33 + level * 0.02);
}

export function Tower({ balance, onBalanceChange, bonusMultiplier, timeRemaining }: TowerProps) {
  const [bet, setBet] = useState(10);
  const [gameState, setGameState] = useState<GameState>('idle');
  const [currentLevel, setCurrentLevel] = useState(0);
  const [levels, setLevels] = useState<LevelData[]>([]);
  const [winAmount, setWinAmount] = useState(0);
  const [shakingButton, setShakingButton] = useState<number | null>(null);
  const levelsRef = useRef<LevelData[]>([]);
  levelsRef.current = levels;
  const balanceRef = useRef(balance);
  useEffect(() => { balanceRef.current = balance; }, [balance]);

  const canPlay = balance >= bet && gameState === 'idle' && timeRemaining > 3;

  const startGame = () => {
    if (!canPlay) { Sound.error(); return; }
    Sound.bet();
    onBalanceChange(balanceRef.current - bet);
    setCurrentLevel(0);
    setLevels([]);
    setWinAmount(0);
    setGameState('playing');
    generateNextLevel(0);
  };

  const generateNextLevel = (level: number) => {
    const bombChance = bombChanceForLevel(level);
    const hasBomb = Math.random() < bombChance;
    const bombIndex = hasBomb ? Math.floor(Math.random() * 3) : -1;
    const newLevel: LevelData = {
      multiplier: multiplierForLevel(level),
      bombIndex,
      pickedIndex: null,
      bombChance,
    };
    setLevels((prev) => {
      const next = [...prev];
      next[level] = newLevel;
      return next;
    });
  };

  const pickButton = (buttonIndex: number) => {
    if (gameState !== 'playing') return;
    const level = levelsRef.current[currentLevel];
    if (!level || level.pickedIndex !== null) return;

    setLevels((prev) => {
      const next = [...prev];
      if (next[currentLevel]) {
        next[currentLevel] = { ...next[currentLevel], pickedIndex: buttonIndex };
      }
      return next;
    });

    if (buttonIndex === level.bombIndex) {
      setShakingButton(buttonIndex);
      Sound.explosion();
      setGameState('busted');
      setTimeout(() => {
        setShakingButton(null);
        setGameState('idle');
        setCurrentLevel(0);
        setLevels([]);
      }, 2500);
    } else {
      Sound.gem();
      Sound.towerClimb();
      const nextLevel = currentLevel + 1;
      setCurrentLevel(nextLevel);
      generateNextLevel(nextLevel);
    }
  };

  const cashOut = () => {
    if (gameState !== 'playing' || currentLevel === 0) return;
    const lastSafeLevel = currentLevel - 1;
    const mult = multiplierForLevel(lastSafeLevel);
    const totalReturn = bet * mult * bonusMultiplier;
    const profit = totalReturn - bet;
    setWinAmount(profit);
    onBalanceChange(balanceRef.current + totalReturn);
    Sound.cashRegister();
    if (mult >= 5) Sound.winBig();
    else Sound.winSmall();
    setGameState('cashed');
    setTimeout(() => {
      setGameState('idle');
      setCurrentLevel(0);
      setLevels([]);
      setWinAmount(0);
    }, 2500);
  };

  const currentMult = multiplierForLevel(currentLevel - 1);
  const nextMult = multiplierForLevel(currentLevel);
  const cashOutAmount = currentLevel > 0 ? bet * currentMult * bonusMultiplier : 0;
  const profit = cashOutAmount - bet;

  const statStyle: React.CSSProperties = {
    backgroundColor: 'var(--sf-bg-secondary)',
    border: '0.5px solid var(--sf-border)',
    borderRadius: '6px',
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4">
      <div className="text-center">
        <h2 className="font-display text-2xl mb-1" style={{ fontWeight: 500, color: 'var(--sf-text)' }}>Tower</h2>
        <p className="text-xs" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>Pick a safe button. Avoid the bomb. Climb forever for higher multipliers.</p>
      </div>

      <BetControls balance={balance} bet={bet} setBet={setBet} disabled={gameState !== 'idle'} />

      {gameState === 'playing' && (
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2 text-center" style={statStyle}>
            <div className="text-[10px]" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>Level</div>
            <div className="font-display text-lg" style={{ color: 'var(--sf-text)', fontWeight: 500 }}>{currentLevel}</div>
          </div>
          <div className="p-2 text-center" style={statStyle}>
            <div className="text-[10px]" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>Current</div>
            <div className="font-display text-lg" style={{ color: 'var(--sf-win)', fontWeight: 500 }}>{currentMult.toFixed(2)}×</div>
          </div>
          <div className="p-2 text-center" style={statStyle}>
            <div className="text-[10px]" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>Next</div>
            <div className="font-display text-lg" style={{ color: 'var(--sf-text)', fontWeight: 500 }}>{nextMult.toFixed(2)}×</div>
          </div>
        </div>
      )}

      <div className="panel p-4 flex flex-col gap-2 max-h-[360px] overflow-y-auto casino-scroll">
        {gameState === 'idle' && (
          <div className="text-center py-10">
            <div className="text-5xl mb-3">🗼</div>
            <div className="text-sm" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>Place a bet and start climbing</div>
            <div className="text-xs mt-2" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
              3 buttons per level · 1 is a bomb · 2 are safe
            </div>
          </div>
        )}

        {gameState !== 'idle' && (
          <>
            {levels.slice(Math.max(0, currentLevel - 4), currentLevel).map((lvl, i) => {
              const actualLevel = Math.max(0, currentLevel - 4) + i;
              return (
                <div key={`done-${actualLevel}`} className="flex items-center gap-2 opacity-40">
                  <div className="w-10 text-xs text-right" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>L{actualLevel + 1}</div>
                  <div className="flex-1 flex gap-1">
                    {[0, 1, 2].map((bi) => (
                      <div
                        key={bi}
                        className={cn('flex-1 h-7 rounded flex items-center justify-center text-xs')}
                        style={{
                          backgroundColor: bi === lvl.pickedIndex && bi !== lvl.bombIndex ? 'var(--sf-win)' : 'var(--sf-bg)',
                          border: '0.5px solid var(--sf-border)',
                          color: 'var(--sf-bg)',
                          fontWeight: 400,
                        }}
                      >
                        {bi === lvl.pickedIndex && bi !== lvl.bombIndex ? '✓' : ''}
                      </div>
                    ))}
                  </div>
                  <div className="w-14 text-xs text-right font-mono" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>{lvl.multiplier.toFixed(2)}×</div>
                </div>
              );
            })}

            {levels[currentLevel] && gameState === 'playing' && (
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-2"
              >
                <div className="w-10 text-xs text-right" style={{ color: 'var(--sf-text)', fontWeight: 500 }}>L{currentLevel + 1}</div>
                <div className="flex-1 grid grid-cols-3 gap-2">
                  {[0, 1, 2].map((bi) => {
                    const lvl = levels[currentLevel];
                    const isPicked = lvl.pickedIndex === bi;
                    const isBomb = lvl.bombIndex === bi;
                    const isShaking = shakingButton === bi;
                    return (
                      <motion.button
                        key={bi}
                        onClick={() => pickButton(bi)}
                        disabled={lvl.pickedIndex !== null}
                        whileHover={!isPicked ? { scale: 1.03, y: -1 } : {}}
                        whileTap={!isPicked ? { scale: 0.97 } : {}}
                        animate={isShaking ? { x: [-6, 6, -6, 6, 0] } : {}}
                        transition={isShaking ? { duration: 0.4 } : {}}
                        className="h-14 rounded-md text-base transition-colors"
                        style={{
                          backgroundColor: !isPicked ? 'var(--sf-bg)' : isBomb ? 'var(--sf-lose)' : 'var(--sf-win)',
                          border: '0.5px solid var(--sf-border)',
                          color: isPicked ? 'var(--sf-bg)' : 'var(--sf-text-muted)',
                          fontWeight: 400,
                        }}
                      >
                        {!isPicked && '?'}
                        {isPicked && !isBomb && '✓'}
                        {isPicked && isBomb && '✕'}
                      </motion.button>
                    );
                  })}
                </div>
                <div className="w-14 text-xs text-right font-mono" style={{ color: 'var(--sf-text)', fontWeight: 500 }}>
                  {levels[currentLevel].multiplier.toFixed(2)}×
                </div>
              </motion.div>
            )}

            {gameState === 'playing' && levels[currentLevel] && (
              <div className="text-center text-xs mt-1" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>
                Bomb chance: <span className="font-mono" style={{ color: 'var(--sf-lose)' }}>{Math.round(levels[currentLevel].bombChance * 100)}%</span>
              </div>
            )}

            {gameState === 'busted' && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center py-4"
              >
                <div className="font-display text-xl mb-1" style={{ fontWeight: 500, color: 'var(--sf-lose)' }}>Busted</div>
                <div className="text-sm" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>Lost {formatMoney(bet)}</div>
              </motion.div>
            )}
            {gameState === 'cashed' && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center py-4"
              >
                <div className="font-display text-xl mb-1" style={{ fontWeight: 500, color: 'var(--sf-win)' }}>Cashed out</div>
                <div className="text-sm" style={{ color: 'var(--sf-win)', fontWeight: 400 }}>+{formatMoney(profit)}</div>
              </motion.div>
            )}
          </>
        )}
      </div>

      <div className="flex gap-2">
        {gameState === 'idle' && (
          <button
            onClick={startGame}
            disabled={!canPlay}
            className="btn-premium flex-1 py-3"
          >
            {balance >= bet ? `Climb (−${formatMoney(bet)})` : 'Not enough balance'}
          </button>
        )}
        {gameState === 'playing' && (
          <button
            onClick={cashOut}
            disabled={currentLevel === 0}
            className="flex-1 py-3 rounded-md transition-colors"
            style={{
              backgroundColor: currentLevel > 0 ? 'var(--sf-win)' : 'var(--sf-border)',
              color: 'var(--sf-bg)',
              fontWeight: 400,
              cursor: currentLevel > 0 ? 'pointer' : 'not-allowed',
            }}
          >
            {currentLevel > 0
              ? `Cash out (${formatMoney(cashOutAmount)})`
              : 'Pick a button to climb'
            }
          </button>
        )}
        {(gameState === 'busted' || gameState === 'cashed') && (
          <div
            className="flex-1 py-3 rounded-md text-center"
            style={{
              backgroundColor: gameState === 'busted' ? 'var(--sf-lose)' : 'var(--sf-win)',
              color: 'var(--sf-bg)',
              fontWeight: 400,
            }}
          >
            {gameState === 'busted' ? 'Busted' : `+${formatMoney(profit)}`}
          </div>
        )}
      </div>
    </div>
  );
}
