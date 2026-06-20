'use client';

import { useState, useRef, useEffect } from 'react';
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
  const [playerHand, setPlayerHand] = useState<{ card: Card; id: number }[]>([]);
  const [dealerHand, setDealerHand] = useState<{ card: Card; id: number }[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<Result>(null);
  const [winAmount, setWinAmount] = useState(0);
  const deckIndexRef = useRef(0);
  const cardIdRef = useRef(0);
  const balanceRef = useRef(balance);

  // Keep balanceRef in sync with the latest balance prop
  useEffect(() => { balanceRef.current = balance; }, [balance]);

  const nextCardId = () => ++cardIdRef.current;

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const startHand = async () => {
    if (balance < bet) { Sound.error(); return; }
    if (timeRemaining <= 3) { Sound.error(); return; }
    Sound.bet();
    onBalanceChange(balance - bet);
    setResult(null);
    setWinAmount(0);
    setPlayerHand([]);
    setDealerHand([]);
    const newDeck = freshDeck((seed ^ Date.now()) >>> 0);
    setDeck(newDeck);
    deckIndexRef.current = 0;
    setPhase('dealing');
    const p: { card: Card; id: number }[] = [];
    const d: { card: Card; id: number }[] = [];
    await sleep(200);
    p.push({ card: { ...newDeck[deckIndexRef.current++], faceUp: true }, id: nextCardId() });
    setPlayerHand([...p]); Sound.cardDeal();
    await sleep(400);
    d.push({ card: { ...newDeck[deckIndexRef.current++], faceUp: true }, id: nextCardId() });
    setDealerHand([...d]); Sound.cardDeal();
    await sleep(400);
    p.push({ card: { ...newDeck[deckIndexRef.current++], faceUp: true }, id: nextCardId() });
    setPlayerHand([...p]); Sound.cardDeal();
    await sleep(400);
    d.push({ card: { ...newDeck[deckIndexRef.current++], faceUp: false }, id: nextCardId() });
    setDealerHand([...d]); Sound.cardDeal();
    const playerBJ = isBlackjack(p.map(c => c.card));
    const dealerBJ = isBlackjack(d.map(c => c.card));
    if (playerBJ || dealerBJ) {
      await sleep(300);
      // Flip dealer's hole card
      const dFlipped = d.map((c, i) => i === 1 ? { ...c, card: { ...c.card, faceUp: true } } : c);
      setDealerHand(dFlipped);
      Sound.cardFlip();
      await sleep(600);
      if (playerBJ && dealerBJ) { finishHand('push', bet); }
      else if (playerBJ) { finishHand('blackjack', bet + bet * 1.5 * bonusMultiplier); }
      else { finishHand('lose', 0); }
      return;
    }
    setPhase('player');
  };

  const hit = async () => {
    if (phase !== 'player') return;
    Sound.cardDeal();
    const card = { ...deck[deckIndexRef.current++], faceUp: true };
    const newHand = [...playerHand, { card, id: nextCardId() }];
    setPlayerHand(newHand);
    const v = handValue(newHand.map(c => c.card)).total;
    if (v > 21) {
      await sleep(400);
      // Flip dealer's hole card
      const dFlipped = dealerHand.map((c, i) => i === 1 ? { ...c, card: { ...c.card, faceUp: true } } : c);
      setDealerHand(dFlipped);
      Sound.cardFlip();
      await sleep(500);
      finishHand('lose', 0);
    } else if (v === 21) {
      await sleep(300);
      stand();
    }
  };

  const stand = async () => {
    if (phase !== 'player') return;
    setPhase('dealer');
    // Flip dealer's hole card
    const dFlipped = dealerHand.map((c, i) => i === 1 ? { ...c, card: { ...c.card, faceUp: true } } : c);
    setDealerHand(dFlipped);
    Sound.cardFlip();
    await sleep(700);
    let cur = dFlipped;
    while (handValue(cur.map(c => c.card)).total < 17) {
      await sleep(700);
      const card = { ...deck[deckIndexRef.current++], faceUp: true };
      Sound.cardDeal();
      cur = [...cur, { card, id: nextCardId() }];
      setDealerHand([...cur]);
    }
    await sleep(500);
    const playerTotal = handValue(playerHand.map(c => c.card)).total;
    const dealerTotal = handValue(cur.map(c => c.card)).total;
    if (dealerTotal > 21 || playerTotal > dealerTotal) { finishHand('win', bet + bet * bonusMultiplier); }
    else if (playerTotal < dealerTotal) { finishHand('lose', 0); }
    else { finishHand('push', bet); }
  };

  const doubleDown = async () => {
    if (phase !== 'player') return;
    if (playerHand.length !== 2) return;
    if (balanceRef.current < bet) { Sound.error(); return; }
    Sound.bet();
    onBalanceChange(balanceRef.current - bet);
    const doubledBet = bet * 2;
    setBet(doubledBet);
    Sound.cardDeal();
    const card = { ...deck[deckIndexRef.current++], faceUp: true };
    const newHand = [...playerHand, { card, id: nextCardId() }];
    setPlayerHand(newHand);
    await sleep(500);
    const v = handValue(newHand.map(c => c.card)).total;
    if (v > 21) {
      const dFlipped = dealerHand.map((c, i) => i === 1 ? { ...c, card: { ...c.card, faceUp: true } } : c);
      setDealerHand(dFlipped);
      Sound.cardFlip();
      await sleep(500);
      finishHand('lose', 0);
      setBet(bet);
    } else {
      setPhase('dealer');
      const dFlipped = dealerHand.map((c, i) => i === 1 ? { ...c, card: { ...c.card, faceUp: true } } : c);
      setDealerHand(dFlipped);
      Sound.cardFlip();
      await sleep(700);
      let cur = dFlipped;
      while (handValue(cur.map(c => c.card)).total < 17) {
        await sleep(700);
        const c = { ...deck[deckIndexRef.current++], faceUp: true };
        Sound.cardDeal();
        cur = [...cur, { card: c, id: nextCardId() }];
        setDealerHand([...cur]);
      }
      await sleep(500);
      const playerTotal = handValue(newHand.map(c => c.card)).total;
      const dealerTotal = handValue(cur.map(c => c.card)).total;
      if (dealerTotal > 21 || playerTotal > dealerTotal) { finishHand('win', doubledBet + doubledBet * bonusMultiplier); }
      else if (playerTotal < dealerTotal) { finishHand('lose', 0); }
      else { finishHand('push', doubledBet); }
      setBet(bet);
    }
  };

  /** finishHand — `totalReturn` is the TOTAL amount returned to the player
   *  (original bet + profit). For a push, it's just the bet. For a loss, it's 0. */
  const finishHand = (res: Result, totalReturn: number) => {
    setResult(res);
    setWinAmount(totalReturn);
    if (totalReturn > 0) {
      // balanceRef.current is the live balance (after bet deduction).
      // Add the total return (bet + profit) to get the final balance.
      onBalanceChange(balanceRef.current + totalReturn);
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

  const playerTotal = handValue(playerHand.map(c => c.card)).total;
  const dealerTotal = handValue(dealerHand.filter(c => c.card.faceUp).map(c => c.card)).total;

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4">
      <div className="text-center">
        <h2 className="font-display text-2xl mb-1" style={{ fontWeight: 500, color: 'var(--sf-text)' }}>Blackjack</h2>
        <p className="text-xs" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>Beat the dealer to 21. Blackjack pays 3:2.</p>
      </div>

      <BetControls balance={balance} bet={bet} setBet={setBet} disabled={phase !== 'idle'} />

      <div className="panel p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>Dealer</span>
          {dealerHand.length > 0 && (
            <span className="font-mono text-sm" style={{ color: 'var(--sf-text)', fontWeight: 400 }}>
              {dealerHand.some(c => !c.card.faceUp) ? `${dealerTotal}+?` : dealerTotal}
            </span>
          )}
        </div>
        <div className="flex gap-2 min-h-[100px] items-center">
          <AnimatePresence mode="popLayout">
            {dealerHand.map(({ card, id }) => (
              <CardView key={id} card={card} />
            ))}
          </AnimatePresence>
          {dealerHand.length === 0 && (
            <div className="text-sm" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>Awaiting deal...</div>
          )}
        </div>
      </div>

      <div className="panel p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>You</span>
          {playerHand.length > 0 && (
            <span className="font-mono text-sm" style={{
              color: playerTotal > 21 ? 'var(--sf-lose)' : playerTotal === 21 ? 'var(--sf-win)' : 'var(--sf-text)',
              fontWeight: 400,
            }}>
              {playerTotal}{playerTotal > 21 ? ' bust' : ''}
            </span>
          )}
        </div>
        <div className="flex gap-2 min-h-[100px] items-center">
          <AnimatePresence mode="popLayout">
            {playerHand.map(({ card, id }) => (
              <CardView key={id} card={card} />
            ))}
          </AnimatePresence>
          {playerHand.length === 0 && (
            <div className="text-sm" style={{ color: 'var(--sf-text-muted)', fontWeight: 400 }}>Place your bet and deal</div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-center font-display text-xl py-2"
            style={{
              color: result === 'win' || result === 'blackjack' ? 'var(--sf-win)' : result === 'lose' ? 'var(--sf-lose)' : 'var(--sf-text-muted)',
              fontWeight: 500,
            }}
          >
            {result === 'win' && `Win +${formatMoney(winAmount - bet)}`}
            {result === 'blackjack' && `Blackjack +${formatMoney(winAmount - bet)}`}
            {result === 'lose' && `Lost −${formatMoney(bet)}`}
            {result === 'push' && 'Push — bet returned'}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-2">
        {phase === 'idle' && (
          <button
            onClick={startHand}
            disabled={balance < bet || timeRemaining <= 3}
            className="btn-premium flex-1 py-3"
            style={{ opacity: (balance < bet || timeRemaining <= 3) ? 0.5 : 1, cursor: (balance < bet || timeRemaining <= 3) ? 'not-allowed' : 'pointer' }}
          >
            {balance >= bet ? `Deal (−${formatMoney(bet)})` : 'Not enough balance'}
          </button>
        )}
        {phase === 'player' && (
          <>
            <button onClick={hit} className="btn-premium flex-1 py-3">Hit</button>
            <button
              onClick={stand}
              className="flex-1 py-3 rounded-md transition-colors"
              style={{ backgroundColor: 'var(--sf-win)', color: 'var(--sf-bg)', fontWeight: 400 }}
            >
              Stand
            </button>
            <button
              onClick={doubleDown}
              disabled={playerHand.length !== 2 || balance < bet}
              className="flex-1 py-3 rounded-md border transition-colors"
              style={{
                backgroundColor: 'var(--sf-bg)',
                borderColor: 'var(--sf-border)',
                color: 'var(--sf-text)',
                fontWeight: 400,
                cursor: (playerHand.length !== 2 || balance < bet) ? 'not-allowed' : 'pointer',
                opacity: (playerHand.length !== 2 || balance < bet) ? 0.4 : 1,
              }}
            >
              Double
            </button>
          </>
        )}
        {(phase === 'dealing' || phase === 'dealer') && (
          <div className="flex-1 py-3 rounded-md text-center" style={{ backgroundColor: 'var(--sf-bg-secondary)', border: '0.5px solid var(--sf-border)', color: 'var(--sf-text-muted)', fontWeight: 400 }}>
            {phase === 'dealing' ? 'Dealing...' : 'Dealer playing...'}
          </div>
        )}
      </div>
    </div>
  );
}

function CardView({ card }: { card: Card }) {
  const isRed = card.suit === '♥' || card.suit === '♦';
  return (
    <motion.div
      layout
      initial={{ y: -50, opacity: 0, scale: 0.9 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: -30, opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 250, damping: 20 }}
      className="w-14 h-20 rounded-md flex flex-col items-center justify-center flex-shrink-0"
      style={{
        backgroundColor: card.faceUp ? 'var(--sf-bg)' : 'var(--sf-bg-secondary)',
        border: '0.5px solid var(--sf-border)',
      }}
    >
      <AnimatePresence mode="wait">
        {card.faceUp ? (
          <motion.div
            key="face"
            initial={{ rotateY: 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: -90, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col items-center justify-center"
          >
            <div className="text-xl" style={{ color: isRed ? 'var(--sf-lose)' : 'var(--sf-text)', fontWeight: 500 }}>
              {card.rank}
            </div>
            <div className="text-xl" style={{ color: isRed ? 'var(--sf-lose)' : 'var(--sf-text)' }}>
              {card.suit}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="back"
            initial={{ rotateY: 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: -90, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full h-full rounded-md flex items-center justify-center"
            style={{ backgroundColor: 'var(--sf-bg-secondary)' }}
          >
            <span style={{ color: 'var(--sf-text-muted)' }}>♠</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
