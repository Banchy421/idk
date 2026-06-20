'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TOWER_LEVELS } from '@/lib/utils-casino';
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

type TowerState = 'idle' | 'climbing' | 'fell' | 'cashed';

export function Tower({ balance, onBalanceChange, bonusMultiplier, timeRemaining }: TowerProps) {
  const [bet, setBet] = useState(10);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [towerState, setTowerState] = useState<TowerState>('idle');
  const [fallLevel, setFallLevel] = useState<number | null>(null);
  const [winAmount, setWinAmount] = useState(0);

  const canPlay = balance >= bet && towerState === 'idle' && timeRemaining > 3;

  const startClimb = () => {
    if (!canPlay) { Sound.error(); return; }
    Sound.bet();
    onBalanceChange(balance - bet);
    setCurrentLevel(-1);
    setTowerState('climbing');
    setFallLevel(null);
    setWinAmount(0);
    // First climb
    setTimeout(() => climb(0), 300);
  };

  const climb = (nextLevel: number) => {
    if (nextLevel >= TOWER_LEVELS.length) {
      // Reached the top — auto cash out
      cashOut(nextLevel);
      return;
    }
    setCurrentLevel(nextLevel);
    const level = TOWER_LEVELS[nextLevel];
    // Roll for fall
    const falls = Math.random() < level.fallChance;
    Sound.towerClimb();
    if (falls) {
      setFallLevel(nextLevel);
      setTowerState('fell');
      Sound.towerFall();
      // Reset after a delay
      setTimeout(() => {
        setTowerState('idle');
        setCurrentLevel(-1);
        setFallLevel(null);
      }, 2200);
    }
  };

  const cashOut = (level: number = currentLevel + 1) => {
    if (towerState !== 'climbing' && level === 0) return;
    const effectiveLevel = level > currentLevel ? level : currentLevel + 1;
    if (effectiveLevel <= 0) {
      // Can't cash out at level 0
      return;
    }
    const lvl = TOWER_LEVELS[effectiveLevel - 1];
    const win = bet * lvl.multiplier * bonusMultiplier;
    setWinAmount(win);
    onBalanceChange(balance + win);
    setTowerState('cashed');
    Sound.cashRegister();
    if (lvl.multiplier >= 5) Sound.winBig();
    else Sound.winSmall();
    setTimeout(() => {
      setTowerState('idle');
      setCurrentLevel(-1);
      setWinAmount(0);
    }, 2500);
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4">
      <div className="text-center">
        <h2 className="font-display text-3xl text-gold mb-1">🗼 Tower</h2>
        <p className="text-xs text-muted-foreground">Climb higher for bigger multipliers. Cash out before you fall.</p>
      </div>

      <BetControls balance={balance} bet={bet} setBet={setBet} disabled={towerState !== 'idle'} />

      {/* Tower visualization */}
      <div className="panel p-4 flex flex-col-reverse gap-2">
        {TOWER_LEVELS.map((lvl, i) => {
          const isCurrent = i === currentLevel && towerState === 'climbing';
          const isPast = i < currentLevel && towerState === 'climbing';
          const isFell = i === fallLevel;
          const isCashedAt = towerState === 'cashed' && i === currentLevel;
          return (
            <motion.div
              key={i}
              layout
              className={cn(
                'flex items-center gap-3 p-3 rounded-md border transition-all',
                isCurrent && 'bg-gold bg-opacity-20 border-gold glow-gold',
                isPast && 'bg-gold bg-opacity-10 border-gold border-opacity-50',
                isFell && 'bg-lose bg-opacity-20 border-lose shake',
                isCashedAt && 'bg-win bg-opacity-20 border-win glow-win',
                !isCurrent && !isPast && !isFell && !isCashedAt && 'bg-[#0a0a0a] border-[#2a2a2a]',
              )}
            >
              <div className="w-8 h-8 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center font-display font-bold text-gold">
                {i + 1}
              </div>
              <div className="flex-1">
                <div className="font-bold text-lg" style={{ color: isFell ? '#E53E3E' : '#C9A84C' }}>
                  {lvl.multiplier}×
                </div>
                <div className="text-xs text-muted-foreground">
                  Fall chance: {Math.round(lvl.fallChance * 100)}% · Win: {formatMoney(bet * lvl.multiplier * bonusMultiplier)}
                </div>
              </div>
              {isPast && <span className="text-win text-xl">✓</span>}
              {isFell && <span className="text-lose text-xl">💥</span>}
              {isCashedAt && <span className="text-win text-xl">💰</span>}
            </motion.div>
          );
        })}
        {/* Base */}
        <div className={cn(
          'flex items-center justify-center p-3 rounded-md border text-center font-bold',
          towerState === 'idle' ? 'bg-gold bg-opacity-10 border-gold text-gold' : 'bg-[#0a0a0a] border-[#2a2a2a] text-muted-foreground',
        )}>
          🏁 BASE
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {towerState === 'idle' && (
          <button
            onClick={startClimb}
            disabled={!canPlay}
            onMouseEnter={() => Sound.hover()}
            className={cn(
              'flex-1 py-3 rounded-md font-bold transition-all',
              canPlay ? 'bg-gold hover:bg-gold-dark text-black glow-gold' : 'bg-[#2a2a2a] text-muted-foreground cursor-not-allowed',
            )}
          >
            {balance >= bet ? `Climb (−${formatMoney(bet)})` : 'Not enough balance'}
          </button>
        )}
        {towerState === 'climbing' && (
          <button
            onClick={() => cashOut()}
            disabled={currentLevel < 0}
            onMouseEnter={() => Sound.hover()}
            className={cn(
              'flex-1 py-3 rounded-md font-bold transition-all',
              currentLevel >= 0
                ? 'bg-win hover:bg-green-700 text-white glow-win'
                : 'bg-[#2a2a2a] text-muted-foreground cursor-not-allowed',
            )}
          >
            {currentLevel >= 0
              ? `Cash Out (${formatMoney(bet * TOWER_LEVELS[currentLevel].multiplier * bonusMultiplier)})`
              : 'Climb higher to cash out'
            }
          </button>
        )}
        {towerState === 'climbing' && currentLevel < TOWER_LEVELS.length - 1 && (
          <button
            onClick={() => climb(currentLevel + 1)}
            onMouseEnter={() => Sound.hover()}
            className="flex-1 py-3 rounded-md font-bold bg-gold hover:bg-gold-dark text-black"
          >
            Climb Higher
          </button>
        )}
        {towerState === 'fell' && (
          <div className="flex-1 py-3 rounded-md font-bold bg-lose text-white text-center">
            💥 You fell! Lost {formatMoney(bet)}
          </div>
        )}
        {towerState === 'cashed' && (
          <div className="flex-1 py-3 rounded-md font-bold bg-win text-white text-center">
            💰 Cashed out: +{formatMoney(winAmount)}
          </div>
        )}
      </div>
    </div>
  );
}
