'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Sound } from '@/lib/sounds';

/**
 * Countdown timer that ticks every second and calls onComplete when reaching 0.
 * Uses local time so all clients stay roughly in sync via state.timeRemaining.
 */
export function useTimer(
  timeRemaining: number,
  phase: string,
  onTick: (remaining: number) => void,
  onComplete: () => void,
) {
  const [display, setDisplay] = useState(timeRemaining);
  const onTickRef = useRef(onTick);
  const onCompleteRef = useRef(onComplete);
  const lastTickRef = useRef<number>(Date.now());
  const lastTimeRemainingRef = useRef<number>(timeRemaining);
  const lastPhaseRef = useRef<string>(phase);
  const completedRef = useRef<boolean>(false);

  useEffect(() => { onTickRef.current = onTick; }, [onTick]);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  // Reset display whenever timeRemaining/phase changes (e.g. phase transition)
  useEffect(() => {
    if (lastTimeRemainingRef.current !== timeRemaining || lastPhaseRef.current !== phase) {
      lastTimeRemainingRef.current = timeRemaining;
      lastPhaseRef.current = phase;
      lastTickRef.current = Date.now();
      completedRef.current = false;
      setDisplay(timeRemaining);
    }
  }, [timeRemaining, phase]);

  // Main ticking loop
  useEffect(() => {
    if (timeRemaining <= 0) return;
    const id = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - lastTickRef.current) / 1000);
      const next = Math.max(0, timeRemaining - elapsed);
      setDisplay((prev) => {
        if (prev === next) return prev;
        if (next <= 5 && next > 0) Sound.countdownTick();
        if (next === 0 && !completedRef.current) {
          completedRef.current = true;
          Sound.countdownEnd();
          onCompleteRef.current();
        } else if (next !== timeRemaining && next > 0) {
          onTickRef.current(next);
        }
        return next;
      });
    }, 250);
    return () => clearInterval(id);
  }, [timeRemaining, phase]);

  return display;
}
