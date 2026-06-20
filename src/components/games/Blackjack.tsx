'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { freshDeck, handValue, isBlackjack, type Card } from '@/lib/utils-casino';
import { Sound } from '@/lib/sounds';
import { formatMoney } from '@/lib/utils-casino';
import { BetControls } from './BetControls';
import { cn } from '@/lib/utils';

interface BlackjackProps {
  balance: number;
  onBalanceChange: (n: number) => void;
  bonusMultiplier: number;
  bailoutPenalty: boolean;
  timeRemaining: number;
  seed: number;
}

type Phase = 'idle' | 'dealing' | 'player' | 'dealer' | 'done';
type Result = 'win' | 'lose' | 'push' | 'blackjack' | null;

export function Blackjack({ balance, onBalanceChange, bonusMultiplier, timeRemaining, seed }: BlackjackProps) {
  const [bet, setBet] = useState(10);
  const [deck, setDeck] = useState<Card[]>([]);
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [dealerHand, setDealerHand] = useState<Card[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<Result>(null);
  const [winAmount, setWinAmount] = useState(0);
  const deckIndexRef = useRef(0);

  const dealCard = (): Card => {
    if (deckIndexRef.current >= deck.length) {
      // reshuffle
      const newDeck = freshDeck((seed ^ Date.now()) >>> 0);
      setDeck(newDeck);
      deckIndexRef.current = 1;
      return newDeck[0];
    }
    return deck[deckIndexRef.current++];
  };

  const startHand = async () => {
    if (balance < bet) { Sound.error(); return; }
    if (timeRemaining <= 3) { Sound.error(); return; }

    Sound.bet();
    onBalanceChange(balance - bet);
    setResult(null);
    setWinAmount(0);

    // Fresh deck
    const newDeck = freshDeck((seed ^ Date.now()) >>> 0);
    setDeck(newDeck);
    deckIndexRef.current = 0;

    setPhase('dealing');
    const p: Card[] = [];
    const d: Card[] = [];

    // Deal: player, dealer, player, dealer (face down)
    await sleep(200); p.push({ ...newDeck[deckIndexRef.current++], faceUp: true }); setPlayerHand([...p]); Sound.cardDeal();
    await sleep(400); d.push({ ...newDeck[deckIndexRef.current++], faceUp: true }); setDealerHand([...d]); Sound.cardDeal();
    await sleep(400); p.push({ ...newDeck[deckIndexRef.current++], faceUp: true }); setPlayerHand([...p]); Sound.cardDeal();
    await sleep(400); d.push({ ...newDeck[deckIndexRef.current++], faceUp: false }); setDealerHand([...d]); Sound.cardDeal();

    // Check blackjack
    const playerBJ = isBlackjack(p);
    const dealerBJ = isBlackjack(d);
    if (playerBJ || dealerBJ) {
      await sleep(300);
      // Reveal dealer's hole card
      d[1].faceUp = true;
      setDealerHand([...d]);
      Sound.cardFlip();
      await sleep(600);
      if (playerBJ && dealerBJ) {
        finishHand('push', bet);
      } else if (playerBJ) {
        finishHand('blackjack', bet * 1.5 * bonusMultiplier);
      } else {
        finishHand('lose', 0);
      }
      return;
    }

    setPhase('player');
  };

  const hit = async () => {
    if (phase !== 'player') return;
    Sound.cardDeal();
    const card = { ...deck[deckIndexRef.current++], faceUp: true };
    const newHand = [...playerHand, card];
    setPlayerHand(newHand);
    const v = handValue(newHand).total;
    if (v > 21) {
      // Bust
      await sleep(400);
      // Reveal dealer's hole card
      const d = [...dealerHand];
      d[1].faceUp = true;
      setDealerHand(d);
      Sound.cardFlip();
      await sleep(500);
      finishHand('lose', 0);
    } else if (v === 21) {
      // Auto stand
      await sleep(300);
      stand();
    }
  };

  const stand = async () => {
    if (phase !== 'player') return;
    setPhase('dealer');
    // Reveal hole card
    const d = [...dealerHand];
    d[1].faceUp = true;
    setDealerHand(d);
    Sound.cardFlip();
    await sleep(700);

    // Dealer hits on 16 or below
    let cur = d;
    while (handValue(cur).total < 17) {
      await sleep(700);
      const card = { ...deck[deckIndexRef.current++], faceUp: true };
      Sound.cardDeal();
      cur = [...cur, card];
      setDealerHand([...cur]);
    }

    await sleep(500);
    const playerTotal = handValue(playerHand).total;
    const dealerTotal = handValue(cur).total;
    if (dealerTotal > 21 || playerTotal > dealerTotal) {
      finishHand('win', bet * bonusMultiplier);
    } else if (playerTotal < dealerTotal) {
      finishHand('lose', 0);
    } else {
      finishHand('push', bet);
    }
  };

  const doubleDown = async () => {
    if (phase !== 'player') return;
    if (playerHand.length !== 2) return;
    if (balance < bet) { Sound.error(); return; }
    Sound.bet();
    onBalanceChange(balance - bet);
    const doubledBet = bet * 2;
    setBet(doubledBet);
    // Take one card then stand
    Sound.cardDeal();
    const card = { ...deck[deckIndexRef.current++], faceUp: true };
    const newHand = [...playerHand, card];
    setPlayerHand(newHand);
    await sleep(500);
    const v = handValue(newHand).total;
    if (v > 21) {
      // Bust
      const d = [...dealerHand];
      d[1].faceUp = true;
      setDealerHand(d);
      Sound.cardFlip();
      await sleep(500);
      finishHand('lose', 0);
      setBet(bet);
    } else {
      // Continue to dealer with the doubled bet
      // Stand logic but with doubled bet
      setPhase('dealer');
      const d = [...dealerHand];
      d[1].faceUp = true;
      setDealerHand(d);
      Sound.cardFlip();
      await sleep(700);
      let cur = d;
      while (handValue(cur).total < 17) {
        await sleep(700);
        const c = { ...deck[deckIndexRef.current++], faceUp: true };
        Sound.cardDeal();
        cur = [...cur, c];
        setDealerHand([...cur]);
      }
      await sleep(500);
      const playerTotal = handValue(newHand).total;
      const dealerTotal = handValue(cur).total;
      if (dealerTotal > 21 || playerTotal > dealerTotal) {
        finishHand('win', doubledBet * bonusMultiplier);
      } else if (playerTotal < dealerTotal) {
        finishHand('lose', 0);
      } else {
        finishHand('push', doubledBet);
      }
      setBet(bet);
    }
  };

  const finishHand = (res: Result, win: number) => {
    setResult(res);
    setWinAmount(win);
    if (win > 0) {
      onBalanceChange(balance + win);
      if (res === 'blackjack') Sound.winBig();
      else Sound.chipClink();
    } else if (res === 'lose') {
      Sound.lose();
    }
    setPhase('done');
    setTimeout(() => {
      setPlayerHand([]);
      setDealerHand([]);
      setResult(null);
      setWinAmount(0);
      setPhase('idle');
    }, 3000);
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const playerTotal = handValue(playerHand).total;
  const dealerTotal = handValue(dealerHand.filter((c) => c.faceUp)).total;

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4">
      <div className="text-center">
        <h2 className="font-display text-3xl text-gold mb-1">🃏 Blackjack</h2>
        <p className="text-xs text-muted-foreground">Beat the dealer to 21. Blackjack pays 3:2.</p>
      </div>

      <BetControls balance={balance} bet={bet} setBet={setBet} disabled={phase !== 'idle'} />

      {/* Dealer */}
      <div className="panel p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground uppercase tracking-widest">Dealer</span>
          {dealerHand.length > 0 && (
            <span className="font-mono text-gold text-sm">
              {dealerHand.some((c) => !c.faceUp) ? `${dealerTotal}+?` : dealerTotal}
            </span>
          )}
        </div>
        <div className="flex gap-2 min-h-[110px] items-center">
          <AnimatePresence>
            {dealerHand.map((card, i) => (
              <CardView key={i} card={card} delay={i * 0.4} />
            ))}
            {dealerHand.length === 0 && (
              <div className="text-muted-foreground text-sm">Awaiting deal...</div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Player */}
      <div className="panel p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground uppercase tracking-widest">You</span>
          {playerHand.length > 0 && (
            <span className={cn(
              'font-mono text-sm',
              playerTotal > 21 ? 'text-lose' : playerTotal === 21 ? 'text-win' : 'text-gold',
            )}>
              {playerTotal}{playerTotal > 21 ? ' BUST' : ''}
            </span>
          )}
        </div>
        <div className="flex gap-2 min-h-[110px] items-center">
          <AnimatePresence>
            {playerHand.map((card, i) => (
              <CardView key={i} card={card} delay={i * 0.4} />
            ))}
            {playerHand.length === 0 && (
              <div className="text-muted-foreground text-sm">Place your bet and deal</div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              'text-center font-display text-2xl font-bold py-2 rounded',
              result === 'win' && 'text-win bg-win bg-opacity-10',
              result === 'lose' && 'text-lose bg-lose bg-opacity-10',
              result === 'push' && 'text-muted-foreground bg-muted bg-opacity-10',
              result === 'blackjack' && 'text-gold bg-gold bg-opacity-10 flash-gold',
            )}
          >
            {result === 'win' && `WIN +${formatMoney(winAmount - bet)}`}
            {result === 'blackjack' && `BLACKJACK +${formatMoney(winAmount - bet)}`}
            {result === 'lose' && `LOST −${formatMoney(bet)}`}
            {result === 'push' && 'PUSH — bet returned'}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-2">
        {phase === 'idle' && (
          <button
            onClick={startHand}
            disabled={balance < bet || timeRemaining <= 3}
            onMouseEnter={() => Sound.hover()}
            className={cn(
              'flex-1 py-3 rounded-md font-bold transition-all',
              balance >= bet && timeRemaining > 3
                ? 'bg-gold hover:bg-gold-dark text-black glow-gold'
                : 'bg-[#2a2a2a] text-muted-foreground cursor-not-allowed',
            )}
          >
            {balance >= bet ? `Deal (−${formatMoney(bet)})` : 'Not enough balance'}
          </button>
        )}
        {phase === 'player' && (
          <>
            <button
              onClick={hit}
              onMouseEnter={() => Sound.hover()}
              className="flex-1 py-3 rounded-md font-bold bg-gold hover:bg-gold-dark text-black"
            >
              Hit
            </button>
            <button
              onClick={stand}
              onMouseEnter={() => Sound.hover()}
              className="flex-1 py-3 rounded-md font-bold bg-win hover:bg-green-700 text-white"
            >
              Stand
            </button>
            <button
              onClick={doubleDown}
              disabled={playerHand.length !== 2 || balance < bet}
              onMouseEnter={() => Sound.hover()}
              className={cn(
                'flex-1 py-3 rounded-md font-bold',
                playerHand.length === 2 && balance >= bet
                  ? 'bg-[#1a1a1a] border border-gold text-gold hover:bg-gold hover:text-black'
                  : 'bg-[#2a2a2a] text-muted-foreground cursor-not-allowed',
              )}
            >
              Double
            </button>
          </>
        )}
        {(phase === 'dealing' || phase === 'dealer') && (
          <div className="flex-1 py-3 rounded-md font-bold bg-[#1a1a1a] text-gold text-center">
            {phase === 'dealing' ? 'Dealing...' : 'Dealer playing...'}
          </div>
        )}
      </div>
    </div>
  );
}

function CardView({ card, delay = 0 }: { card: Card; delay?: number }) {
  const isRed = card.suit === '♥' || card.suit === '♦';
  return (
    <motion.div
      initial={{ y: -100, opacity: 0, rotateY: 180 }}
      animate={{ y: 0, opacity: 1, rotateY: 0 }}
      transition={{ delay, type: 'spring', stiffness: 200 }}
      className="w-16 h-24 rounded-md flex flex-col items-center justify-center bg-white shadow-lg relative"
    >
      {card.faceUp ? (
        <>
          <div className={cn('text-2xl font-bold', isRed ? 'text-lose' : 'text-black')}>
            {card.rank}
          </div>
          <div className={cn('text-2xl', isRed ? 'text-lose' : 'text-black')}>
            {card.suit}
          </div>
        </>
      ) : (
        <div className="w-full h-full rounded-md bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] flex items-center justify-center border-2 border-gold">
          <span className="text-gold text-2xl">♠</span>
        </div>
      )}
    </motion.div>
  );
}
