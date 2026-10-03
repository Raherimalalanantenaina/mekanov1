import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  darkColors,
  gradients as defaultGradients,
  lightColors,
  type ThemeColors,
} from '../theme';
import { DEFAULT_CONFIG, useAppConfig } from '../appConfig';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'mekano-theme-mode';

type Gradient = readonly [string, string];
export type ThemeGradients = { brand: Gradient; hero: Gradient; amber: Gradient };

type ThemeContextValue = {
  mode: ThemeMode;
  colors: ThemeColors;
  gradients: ThemeGradients;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'light',
  colors: lightColors,
  gradients: defaultGradients,
  setMode: () => {},
});

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mélange `hex` avec `target` (0 = hex, 1 = target). */
function mix(hex: string, target: string, amount: number): string {
  const a = hexToRgb(hex);
  const b = hexToRgb(target);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * amount));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Palette dérivée des couleurs choisies dans le site super admin. */
function buildTheme(mode: ThemeMode, primary: string, accent: string) {
  const isDefault =
    primary.toLowerCase() === DEFAULT_CONFIG.colors.primary.toLowerCase() &&
    accent.toLowerCase() === DEFAULT_CONFIG.colors.accent.toLowerCase();
  if (isDefault) {
    return {
      colors: mode === 'dark' ? darkColors : lightColors,
      gradients: defaultGradients as ThemeGradients,
    };
  }
  const colors: ThemeColors =
    mode === 'dark'
      ? {
          ...darkColors,
          teal: mix(primary, '#FFFFFF', 0.3),
          tealDark: mix(primary, '#FFFFFF', 0.6),
          tealDeep: mix(primary, '#000000', 0.55),
          tealSoft: rgba(mix(primary, '#FFFFFF', 0.3), 0.14),
          amber: accent,
          amberDark: mix(accent, '#FFFFFF', 0.25),
          amberSoft: rgba(accent, 0.12),
        }
      : {
          ...lightColors,
          teal: primary,
          tealDark: mix(primary, '#000000', 0.2),
          tealDeep: mix(primary, '#000000', 0.4),
          tealSoft: mix(primary, '#FFFFFF', 0.92),
          amber: accent,
          amberDark: mix(accent, '#000000', 0.18),
          amberSoft: mix(accent, '#FFFFFF', 0.88),
        };
  return {
    colors,
    gradients: {
      brand: [primary, mix(primary, '#000000', 0.15)] as const,
      hero: [primary, mix(primary, '#000000', 0.25)] as const,
      amber: [accent, mix(accent, '#000000', 0.06)] as const,
    },
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light');
  const { primary, accent } = useAppConfig().config.colors;

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === 'dark' || saved === 'light') setModeState(saved);
    });
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const value = useMemo(
    () => ({ mode, ...buildTheme(mode, primary, accent), setMode }),
    [mode, primary, accent, setMode]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
