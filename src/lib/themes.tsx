'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface Theme {
  id: string;
  name: string;
  icon: string;
  description: string;
  isDark: boolean;
  colors: {
    bg: string;
    bgSecondary: string;
    bgTertiary: string;
    border: string;
    accent: string;
    accentDark: string;
    accentRgb: string;
    win: string;
    lose: string;
    text: string;
    textMuted: string;
    glow: string;
  };
  gradient: string;
  panelGradient: string;
}

export const THEMES: Theme[] = [
  // 3 LIGHT THEMES
  {
    id: 'linen',
    name: 'Linen',
    icon: '○',
    description: 'Warm beige with soft neutrals',
    isDark: false,
    colors: {
      bg: '#F7F4EF',
      bgSecondary: '#EFE9E0',
      bgTertiary: '#F7F4EF',
      border: '#DDD6CA',
      accent: '#B8A898',
      accentDark: '#A39485',
      accentRgb: '184, 168, 152',
      win: '#6B8E5A',
      lose: '#B85C5C',
      text: '#2A2724',
      textMuted: '#7D756C',
      glow: 'transparent',
    },
    gradient: 'none',
    panelGradient: 'none',
  },
  {
    id: 'sage',
    name: 'Sage',
    icon: '○',
    description: 'Soft green-grey with botanical accent',
    isDark: false,
    colors: {
      bg: '#F4F5F1',
      bgSecondary: '#E8EBE2',
      bgTertiary: '#F4F5F1',
      border: '#D0D5C7',
      accent: '#9DA886',
      accentDark: '#7D8A66',
      accentRgb: '157, 168, 134',
      win: '#6B8E5A',
      lose: '#B85C5C',
      text: '#2A2D26',
      textMuted: '#7A7E6E',
      glow: 'transparent',
    },
    gradient: 'none',
    panelGradient: 'none',
  },
  {
    id: 'clay',
    name: 'Clay',
    icon: '○',
    description: 'Warm terracotta with muted clay accent',
    isDark: false,
    colors: {
      bg: '#F6F3EF',
      bgSecondary: '#EAE3DC',
      bgTertiary: '#F6F3EF',
      border: '#DBCFC4',
      accent: '#B89B86',
      accentDark: '#9A8068',
      accentRgb: '184, 155, 134',
      win: '#6B8E5A',
      lose: '#B85C5C',
      text: '#2B2620',
      textMuted: '#7D726A',
      glow: 'transparent',
    },
    gradient: 'none',
    panelGradient: 'none',
  },
  // 2 DARK THEMES
  {
    id: 'ink',
    name: 'Ink',
    icon: '○',
    description: 'Dark charcoal with muted silver accent',
    isDark: true,
    colors: {
      bg: '#2A2724',
      bgSecondary: '#33302C',
      bgTertiary: '#2A2724',
      border: '#45413C',
      accent: '#A89B8C',
      accentDark: '#8C8070',
      accentRgb: '168, 155, 140',
      win: '#7A9D6A',
      lose: '#C47070',
      text: '#E8E3DC',
      textMuted: '#9A9088',
      glow: 'transparent',
    },
    gradient: 'none',
    panelGradient: 'none',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    icon: '○',
    description: 'Deep navy with muted steel accent',
    isDark: true,
    colors: {
      bg: '#1A1D24',
      bgSecondary: '#242830',
      bgTertiary: '#1A1D24',
      border: '#353A44',
      accent: '#8B95A5',
      accentDark: '#6B7686',
      accentRgb: '139, 149, 165',
      win: '#7A9D6A',
      lose: '#C47070',
      text: '#DDE2EA',
      textMuted: '#8A909A',
      glow: 'transparent',
    },
    gradient: 'none',
    panelGradient: 'none',
  },
];

interface ThemeContextValue {
  theme: Theme;
  setThemeId: (id: string) => void;
  themes: Theme[];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Always start with 'linen' on both server and client to avoid hydration mismatch.
  // The saved theme is loaded in a useEffect after hydration completes.
  const [themeId, setThemeIdState] = useState<string>('linen');

  // Load saved theme after mount (client-only, avoids hydration mismatch)
  useEffect(() => {
    const saved = localStorage.getItem('sf-theme');
    if (saved) {
      const migrated = (saved === 'casino-gold' || saved === 'neon-cyber' || saved === 'royal-purple' || saved === 'ocean-blue' || saved === 'emerald' || saved === 'slate')
        ? 'linen'
        : saved;
      if (migrated !== 'linen' && THEMES.find((t) => t.id === migrated)) {
        queueMicrotask(() => setThemeIdState(migrated));
      }
    }
  }, []);

  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];

  const setThemeId = (id: string) => {
    setThemeIdState(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sf-theme', id);
    }
  };

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const c = theme.colors;
    root.style.setProperty('--sf-bg', c.bg);
    root.style.setProperty('--sf-bg-secondary', c.bgSecondary);
    root.style.setProperty('--sf-bg-tertiary', c.bgTertiary);
    root.style.setProperty('--sf-border', c.border);
    root.style.setProperty('--sf-accent', c.accent);
    root.style.setProperty('--sf-accent-dark', c.accentDark);
    root.style.setProperty('--sf-accent-rgb', c.accentRgb);
    root.style.setProperty('--sf-win', c.win);
    root.style.setProperty('--sf-lose', c.lose);
    root.style.setProperty('--sf-text', c.text);
    root.style.setProperty('--sf-text-muted', c.textMuted);
    root.style.setProperty('--sf-glow', c.glow);
    root.style.setProperty('--sf-gradient', theme.gradient);
    root.style.setProperty('--sf-panel-gradient', theme.panelGradient);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setThemeId, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return { theme: THEMES[0], setThemeId: () => {}, themes: THEMES };
  }
  return ctx;
}
