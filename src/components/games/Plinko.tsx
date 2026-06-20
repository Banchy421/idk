'use client';

import { useState, useEffect, useRef } from 'react';
import Matter from 'matter-js';
import { motion, AnimatePresence } from 'framer-motion';
import { PLINKO_BUCKETS, mulberry32 } from '@/lib/utils-casino';
import { Sound } from '@/lib/sounds';
import { formatMoney } from '@/lib/utils-casino';
import { BetControls } from './BetControls';
import { cn } from '@/lib/utils';

interface PlinkoProps {
  balance: number;
  onBalanceChange: (n: number) => void;
  bonusMultiplier: number;
  bailoutPenalty: boolean;
  timeRemaining: number;
  seed: number;
}

interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  trail: { x: number; y: number }[];
  landed: boolean;
  bucket: number | null;
}

const ROWS = 8;
const PEGS_PER_ROW = 9;
const WIDTH = 400;
const HEIGHT = 520;
const BUCKET_COUNT = 9;

export function Plinko({ balance, onBalanceChange, bonusMultiplier, timeRemaining }: PlinkoProps) {
  const [bet, setBet] = useState(10);
  const [balls, setBalls] = useState<Ball[]>([]);
  const [landedBucket, setLandedBucket] = useState<number | null>(null);
  const [lastWin, setLastWin] = useState(0);
  const [lastWinBucket, setLastWinBucket] = useState<number | null>(null);
  const ballIdRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const engineRef = useRef<Matter.Engine | null>(null);
  const ballBodiesRef = useRef<Map<number, { body: Matter.Body; ball: Ball }>>(new Map());
  const pegsRef = useRef<Matter.Body[]>([]);
  const wallsRef = useRef<Matter.Body[]>([]);

  // Set up Matter.js engine once
  useEffect(() => {
    const engine = Matter.Engine.create();
    engine.gravity.y = 1;
    engineRef.current = engine;

    // Create pegs in a triangular grid
    const pegs: Matter.Body[] = [];
    const startY = 60;
    const rowSpacing = 50;
    const pegSpacing = 40;
    for (let row = 0; row < ROWS; row++) {
      const count = Math.min(PEGS_PER_ROW, 3 + row);
      const totalWidth = (count - 1) * pegSpacing;
      const startX = (WIDTH - totalWidth) / 2;
      for (let i = 0; i < count; i++) {
        const peg = Matter.Bodies.circle(startX + i * pegSpacing, startY + row * rowSpacing, 5, {
          isStatic: true,
          restitution: 0.6,
          friction: 0.1,
          label: 'peg',
        });
        pegs.push(peg);
      }
    }
    Matter.Composite.add(engine.world, pegs);
    pegsRef.current = pegs;

    // Walls
    const wallOpts = { isStatic: true, restitution: 0.5 };
    const leftWall = Matter.Bodies.rectangle(-5, HEIGHT / 2, 10, HEIGHT, wallOpts);
    const rightWall = Matter.Bodies.rectangle(WIDTH + 5, HEIGHT / 2, 10, HEIGHT, wallOpts);
    const floor = Matter.Bodies.rectangle(WIDTH / 2, HEIGHT + 20, WIDTH, 20, { isStatic: true });
    Matter.Composite.add(engine.world, [leftWall, rightWall, floor]);
    wallsRef.current = [leftWall, rightWall, floor];

    // Bucket dividers (visual only — physics floor handles landing)
    const dividerY = HEIGHT - 30;
    const dividerW = 2;
    for (let i = 1; i < BUCKET_COUNT; i++) {
      const x = (WIDTH / (BUCKET_COUNT - 1)) * (i - 0.5) + WIDTH / (BUCKET_COUNT) / 2;
      const divider = Matter.Bodies.rectangle(
        (WIDTH / BUCKET_COUNT) * i, dividerY, dividerW, 60,
        { isStatic: true, restitution: 0.3, label: 'divider' },
      );
      Matter.Composite.add(engine.world, divider);
    }

    // Collision events for sounds
    Matter.Events.on(engine, 'collisionStart', (e) => {
      for (const pair of e.pairs) {
        const labels = [pair.bodyA.label, pair.bodyB.label];
        if (labels.includes('peg') && labels.includes('ball')) {
          Sound.plinkoTick();
        }
      }
    });

    return () => {
      Matter.Engine.clear(engine);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastTime = performance.now();
    const render = (now: number) => {
      const dt = Math.min(33, now - lastTime);
      lastTime = now;

      if (engineRef.current) {
        Matter.Engine.update(engineRef.current, dt);
      }

      // Update ball trails + check landed
      const newBalls: Ball[] = [];
      for (const [id, { body, ball }] of ballBodiesRef.current) {
        ball.x = body.position.x;
        ball.y = body.position.y;
        ball.vx = body.velocity.x;
        ball.vy = body.velocity.y;
        ball.trail.push({ x: ball.x, y: ball.y });
        if (ball.trail.length > 20) ball.trail.shift();

        // Check landed (near floor and slow)
        if (!ball.landed && ball.y > HEIGHT - 50 && Math.abs(ball.vy) < 1.5) {
          ball.landed = true;
          const bucketIndex = Math.max(0, Math.min(BUCKET_COUNT - 1, Math.floor((ball.x / WIDTH) * BUCKET_COUNT)));
          ball.bucket = bucketIndex;
          // Resolve win
          const mult = PLINKO_BUCKETS[bucketIndex];
          const win = bet * mult * bonusMultiplier;
          // Update state outside loop
          setTimeout(() => {
            setLastWin(win);
            setLastWinBucket(bucketIndex);
            setLandedBucket(bucketIndex);
            onBalanceChange(balance + win);
            if (mult >= 5) Sound.winBig();
            else if (mult >= 1) Sound.winSmall();
            else Sound.lose();
            Sound.plinkoLand();
            setTimeout(() => {
              setLandedBucket(null);
              setLastWinBucket(null);
            }, 2000);
          }, 100);
        }

        if (ball.y < HEIGHT + 100) {
          newBalls.push(ball);
        } else {
          // Remove body
          if (engineRef.current) {
            Matter.Composite.remove(engineRef.current.world, body);
          }
          ballBodiesRef.current.delete(id);
        }
      }
      setBalls([...newBalls]);

      // Draw
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // Draw pegs
      ctx.fillStyle = '#C9A84C';
      for (const peg of pegsRef.current) {
        ctx.beginPath();
        ctx.arc(peg.position.x, peg.position.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw buckets at bottom
      const bucketW = WIDTH / BUCKET_COUNT;
      for (let i = 0; i < BUCKET_COUNT; i++) {
        const mult = PLINKO_BUCKETS[i];
        const x = i * bucketW;
        const isLanded = landedBucket === i || lastWinBucket === i;
        const color = mult >= 5 ? '#E53E3E' : mult >= 2 ? '#C9A84C' : mult >= 1 ? '#38A169' : '#666';
        ctx.fillStyle = isLanded ? color : '#1a1a1a';
        ctx.fillRect(x + 2, HEIGHT - 30, bucketW - 4, 28);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 2, HEIGHT - 30, bucketW - 4, 28);
        ctx.fillStyle = isLanded ? '#fff' : color;
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${mult}×`, x + bucketW / 2, HEIGHT - 12);
      }

      // Draw balls + trails
      for (const [_, { ball }] of ballBodiesRef.current) {
        // Trail
        for (let i = 0; i < ball.trail.length; i++) {
          const t = ball.trail[i];
          const alpha = (i / ball.trail.length) * 0.4;
          ctx.fillStyle = `rgba(201, 168, 76, ${alpha})`;
          ctx.beginPath();
          ctx.arc(t.x, t.y, 3 * (i / ball.trail.length), 0, Math.PI * 2);
          ctx.fill();
        }
        // Ball
        ctx.fillStyle = '#fff5cc';
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#C9A84C';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [bet, bonusMultiplier, balance, onBalanceChange, landedBucket, lastWinBucket]);

  const dropBall = () => {
    if (balance < bet) { Sound.error(); return; }
    if (timeRemaining <= 3) { Sound.error(); return; }
    Sound.bet();
    onBalanceChange(balance - bet);

    const id = ballIdRef.current++;
    const startX = WIDTH / 2 + (Math.random() - 0.5) * 20;
    const startY = 10;
    const ball: Ball = {
      id, x: startX, y: startY, vx: 0, vy: 0, trail: [], landed: false, bucket: null,
    };
    const body = Matter.Bodies.circle(startX, startY, 7, {
      restitution: 0.5,
      friction: 0.005,
      frictionAir: 0.005,
      density: 0.01,
      label: 'ball',
    });
    Matter.Body.setVelocity(body, { x: (Math.random() - 0.5) * 2, y: 0 });
    if (engineRef.current) {
      Matter.Composite.add(engineRef.current.world, body);
    }
    ballBodiesRef.current.set(id, { body, ball });
    setBalls((b) => [...b, ball]);
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4">
      <div className="text-center">
        <h2 className="font-display text-3xl text-gold mb-1">🔵 Plinko</h2>
        <p className="text-xs text-muted-foreground">Drop the ball. Watch physics decide your fate.</p>
      </div>

      <BetControls balance={balance} bet={bet} setBet={setBet} presets={[5, 10, 25, 50]} />

      <div className="panel p-2 flex justify-center">
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          className="max-w-full h-auto"
          style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}
        />
      </div>

      <AnimatePresence>
        {lastWin > 0 && lastWinBucket !== null && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className={cn(
              'text-center font-display text-2xl font-bold py-2 rounded',
              lastWin >= bet ? 'text-win' : 'text-lose',
            )}
          >
            {PLINKO_BUCKETS[lastWinBucket]}× — {lastWin >= bet ? '+' : ''}{formatMoney(lastWin - bet)}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={dropBall}
        disabled={balance < bet || timeRemaining <= 3}
        onMouseEnter={() => Sound.hover()}
        className={cn(
          'py-3 rounded-md font-bold transition-all',
          balance >= bet && timeRemaining > 3
            ? 'bg-gold hover:bg-gold-dark text-black glow-gold'
            : 'bg-[#2a2a2a] text-muted-foreground cursor-not-allowed',
        )}
      >
        {balance >= bet ? `Drop Ball (−${formatMoney(bet)})` : 'Not enough balance'}
      </button>
    </div>
  );
}
