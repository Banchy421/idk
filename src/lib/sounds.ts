// Sound manager: procedural Web Audio synthesis with Howler.js fallback for music.
// All sounds are generated procedurally so no external CDN dependency is needed.

import { Howl } from 'howler';

let _ctx: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!_ctx) {
    try {
      _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (_ctx.state === 'suspended') {
    void _ctx.resume().catch(() => {});
  }
  return _ctx;
}

let _muted = false;
export function setMuted(m: boolean) {
  _muted = m;
}
export function isMuted() {
  return _muted;
}

interface ToneOpts {
  freq: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  decay?: number;
  delay?: number;
  sweepTo?: number; // frequency sweep target
}

function tone({ freq, duration, type = 'sine', gain = 0.2, attack = 0.005, decay = duration, delay = 0, sweepTo }: ToneOpts): void {
  if (_muted) return;
  const ac = ctx();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (sweepTo) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, sweepTo), t0 + duration);
  }
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + delay + duration + 0.05);
}

function noise(duration: number, gain = 0.2, filterFreq = 8000, delay = 0): void {
  if (_muted) return;
  const ac = ctx();
  if (!ac) return;
  const bufferSize = Math.floor(ac.sampleRate * duration);
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(filter);
  filter.connect(g);
  g.connect(ac.destination);
  src.start(ac.currentTime + delay);
}

export const Sound = {
  click() {
    tone({ freq: 800, duration: 0.04, type: 'square', gain: 0.08 });
  },
  tick() {
    tone({ freq: 1200, duration: 0.025, type: 'square', gain: 0.05 });
  },
  hover() {
    tone({ freq: 600, duration: 0.03, type: 'sine', gain: 0.04 });
  },
  bet() {
    tone({ freq: 440, duration: 0.08, type: 'square', gain: 0.1 });
    tone({ freq: 660, duration: 0.08, type: 'square', gain: 0.08, delay: 0.05 });
  },
  winSmall() {
    tone({ freq: 660, duration: 0.1, type: 'sine', gain: 0.12 });
    tone({ freq: 880, duration: 0.12, type: 'sine', gain: 0.1, delay: 0.08 });
  },
  winBig() {
    [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, duration: 0.18, type: 'triangle', gain: 0.15, delay: i * 0.08 }));
    [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f * 2, duration: 0.18, type: 'sine', gain: 0.08, delay: i * 0.08 + 0.05 }));
  },
  lose() {
    tone({ freq: 200, duration: 0.4, type: 'sawtooth', gain: 0.12, sweepTo: 80 });
    tone({ freq: 150, duration: 0.5, type: 'square', gain: 0.08, sweepTo: 50, delay: 0.05 });
  },
  chipClink() {
    tone({ freq: 2400, duration: 0.06, type: 'triangle', gain: 0.1 });
    tone({ freq: 1800, duration: 0.08, type: 'triangle', gain: 0.08, delay: 0.02 });
  },
  coinSpin() {
    tone({ freq: 1200, duration: 0.5, type: 'sine', gain: 0.05, sweepTo: 800 });
  },
  coinLand() {
    tone({ freq: 900, duration: 0.1, type: 'triangle', gain: 0.15 });
    noise(0.08, 0.08, 4000);
  },
  cashRegister() {
    tone({ freq: 1568, duration: 0.06, type: 'square', gain: 0.12 });
    tone({ freq: 2093, duration: 0.1, type: 'square', gain: 0.1, delay: 0.05 });
  },
  cardDeal() {
    noise(0.08, 0.1, 6000);
    tone({ freq: 300, duration: 0.06, type: 'square', gain: 0.05 });
  },
  cardFlip() {
    tone({ freq: 500, duration: 0.05, type: 'sine', gain: 0.08, sweepTo: 800 });
  },
  reveal() {
    tone({ freq: 600, duration: 0.08, type: 'triangle', gain: 0.1 });
    tone({ freq: 900, duration: 0.1, type: 'triangle', gain: 0.08, delay: 0.04 });
  },
  gem() {
    tone({ freq: 880, duration: 0.08, type: 'sine', gain: 0.1 });
    tone({ freq: 1320, duration: 0.1, type: 'sine', gain: 0.08, delay: 0.04 });
  },
  explosion() {
    noise(0.5, 0.3, 800);
    tone({ freq: 80, duration: 0.6, type: 'sawtooth', gain: 0.15, sweepTo: 30 });
  },
  crashBoom() {
    noise(0.6, 0.35, 600);
    tone({ freq: 100, duration: 0.7, type: 'sawtooth', gain: 0.18, sweepTo: 40 });
  },
  reelSpin() {
    tone({ freq: 200, duration: 0.6, type: 'sawtooth', gain: 0.06, sweepTo: 350 });
  },
  reelStop() {
    tone({ freq: 400, duration: 0.08, type: 'square', gain: 0.12 });
    noise(0.04, 0.08, 4000);
  },
  plinkoTick() {
    tone({ freq: 1500, duration: 0.025, type: 'square', gain: 0.06 });
  },
  plinkoLand() {
    tone({ freq: 200, duration: 0.2, type: 'sine', gain: 0.15 });
    noise(0.1, 0.1, 500);
  },
  towerClimb() {
    tone({ freq: 440, duration: 0.12, type: 'triangle', gain: 0.1 });
    tone({ freq: 660, duration: 0.12, type: 'triangle', gain: 0.08, delay: 0.06 });
  },
  towerFall() {
    tone({ freq: 400, duration: 0.6, type: 'sawtooth', gain: 0.15, sweepTo: 80 });
    noise(0.4, 0.2, 1000);
  },
  bailout() {
    tone({ freq: 300, duration: 0.15, type: 'sine', gain: 0.1 });
    tone({ freq: 450, duration: 0.2, type: 'sine', gain: 0.1, delay: 0.1 });
  },
  countdownTick() {
    tone({ freq: 800, duration: 0.06, type: 'square', gain: 0.08 });
  },
  countdownEnd() {
    tone({ freq: 1200, duration: 0.2, type: 'sine', gain: 0.15 });
    tone({ freq: 1600, duration: 0.3, type: 'sine', gain: 0.12, delay: 0.1 });
  },
  fanfare() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ freq: f, duration: 0.25, type: 'triangle', gain: 0.15, delay: i * 0.1 }));
  },
  join() {
    tone({ freq: 523, duration: 0.1, type: 'sine', gain: 0.1 });
    tone({ freq: 784, duration: 0.12, type: 'sine', gain: 0.1, delay: 0.06 });
  },
  leave() {
    tone({ freq: 400, duration: 0.15, type: 'sine', gain: 0.08, sweepTo: 300 });
  },
  skip() {
    tone({ freq: 300, duration: 0.1, type: 'square', gain: 0.08 });
  },
  fanfareBig() {
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone({ freq: f, duration: 0.3, type: 'triangle', gain: 0.18, delay: i * 0.1 }));
    [261, 329, 392, 523, 659, 784].forEach((f, i) => tone({ freq: f, duration: 0.3, type: 'sine', gain: 0.1, delay: i * 0.1 }));
  },
  error() {
    tone({ freq: 200, duration: 0.2, type: 'square', gain: 0.1 });
    tone({ freq: 150, duration: 0.3, type: 'square', gain: 0.08, delay: 0.05 });
  },
};

// Optional: try to load ambient casino music from a CDN; if it fails, no problem.
let _ambient: Howl | null = null;
let _ambientStarted = false;
export function startAmbientMusic() {
  if (_ambientStarted) return;
  _ambientStarted = true;
  try {
    _ambient = new Howl({
      src: ['https://cdn.pixabay.com/download/audio/2022/03/15/audio_945ef41be1.mp3'],
      loop: true,
      volume: 0.15,
      html5: true,
    });
    _ambient.play();
  } catch {
    // ignore — procedural sounds are enough
  }
}
export function stopAmbientMusic() {
  if (_ambient) {
    _ambient.fade(_ambient.volume(), 0, 500);
    setTimeout(() => _ambient?.unload(), 600);
    _ambient = null;
  }
}

// Need to resume audio context on first user gesture
export function unlockAudio() {
  const ac = ctx();
  if (ac && ac.state === 'suspended') {
    void ac.resume().catch(() => {});
  }
}
