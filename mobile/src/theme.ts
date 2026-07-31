import { Platform } from 'react-native';

/**
 * Design system Mekano — flat chic, en deux modes (clair / sombre).
 * Fond uni, typographies fortes, filets fins (hairlines) à la place des
 * cartes ombrées. Accent principal : le teal du logo, ponctué d'ambre.
 */

export const lightColors = {
  // Accents du logo
  teal: '#12717A',
  tealDark: '#0B5A62',
  tealDeep: '#074248',
  tealSoft: '#EAF3F3',
  amber: '#F0A72C',
  amberDark: '#C77F0F',
  amberSoft: '#FBF1DD',

  // Neutres — tout est blanc, séparé par des filets
  ink: '#101617',
  muted: '#5F6B6C',
  faint: '#9AA6A7',
  line: '#ECEFEF',
  bg: '#FFFFFF',
  card: '#FFFFFF',
  field: '#F4F7F7',
  white: '#FFFFFF',

  // États
  success: '#1E9E6A',
  successSoft: '#E5F5EE',
  danger: '#D64541',
  dangerSoft: '#FBE9E8',
  offline: '#8A6D1F',
  offlineBg: '#FBF3DC',
};

export type ThemeColors = typeof lightColors;

export const darkColors: ThemeColors = {
  // Accents éclaircis pour rester lisibles sur fond sombre
  teal: '#2FA8B4',
  tealDark: '#7FD5DC',
  tealDeep: '#06343A',
  tealSoft: 'rgba(47,168,180,0.14)',
  amber: '#F0A72C',
  amberDark: '#E9B45C',
  amberSoft: 'rgba(240,167,44,0.12)',

  // Neutres sombres
  ink: '#ECF2F2',
  muted: '#9DACAE',
  faint: '#66767A',
  line: '#232B2E',
  bg: '#0F1416',
  card: '#151B1E',
  field: '#1C2427',
  white: '#FFFFFF',

  // États lumineux
  success: '#34C98E',
  successSoft: 'rgba(52,201,142,0.14)',
  danger: '#F97570',
  dangerSoft: 'rgba(249,117,112,0.13)',
  offline: '#E5C15C',
  offlineBg: 'rgba(229,193,92,0.12)',
};

/**
 * Export statique (palette claire) pour les petits composants purement
 * décoratifs qui n'ont pas besoin de réagir au mode sombre.
 */
export const colors = lightColors;

export const gradients = {
  brand: ['#12717A', '#0F616A'] as const,
  hero: ['#12717A', '#0D5860'] as const,
  amber: ['#F0A72C', '#EC9E1B'] as const,
  tile: ['#12717A', '#0F616A'] as const,
  card: ['#FFFFFF', '#FFFFFF'] as const,
};

export const radii = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
};

// Design plat : pas d'ombre sur les surfaces. `float` reste minime,
// uniquement pour les overlays posés sur la carte.
export const shadow = {
  card: Platform.select({
    android: {},
    default: {},
  }),
  float: Platform.select({
    android: { elevation: 3 },
    default: {
      shadowColor: '#101617',
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
  }),
};

export const font = {
  black: '900' as const,
  extrabold: '800' as const,
  bold: '700' as const,
  semibold: '600' as const,
};
