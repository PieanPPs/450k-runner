import { ThemeColors } from '@/types';

export const DARK: ThemeColors = {
  bg: '#0D0A1A', bg2: '#130F24', card: 'rgba(255,255,255,0.05)',
  cardBorder: 'rgba(155,48,255,0.25)', text: '#F0EBF8',
  textMuted: 'rgba(240,235,248,0.55)', textSub: 'rgba(240,235,248,0.35)',
  accent1: '#9B30FF', accent2: '#FF2D9B', accent3: '#FF8C35',
  navBg: 'rgba(13,10,26,0.92)',
  heroGrad: 'linear-gradient(135deg,#1a0533 0%,#0D0A1A 60%,#1a0f0a 100%)',
  progressBg: 'rgba(255,255,255,0.08)', tabActive: '#9B30FF',
  tabBg: 'rgba(255,255,255,0.05)', inputBg: 'rgba(255,255,255,0.07)', altBg: 'rgba(155,48,255,0.06)',
};

export const LIGHT: ThemeColors = {
  bg: '#F4FAF4', bg2: '#EBF5EB', card: '#FFFFFF',
  cardBorder: 'rgba(46,125,50,0.2)', text: '#1A2E1A',
  textMuted: 'rgba(26,46,26,0.6)', textSub: 'rgba(26,46,26,0.4)',
  accent1: '#2E7D32', accent2: '#E65100', accent3: '#1565C0',
  navBg: 'rgba(244,250,244,0.95)',
  heroGrad: 'linear-gradient(135deg,#1b5e20 0%,#2e7d32 50%,#1565c0 100%)',
  progressBg: 'rgba(0,0,0,0.08)', tabActive: '#2E7D32',
  tabBg: 'rgba(0,0,0,0.04)', inputBg: 'rgba(0,0,0,0.04)', altBg: 'rgba(46,125,50,0.06)',
};
