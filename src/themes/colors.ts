import { ThemeColors } from '@/types';

// ── Season 2 — Race Day ─────────────────────────────────────────────────────
// Dark: ถ่านสดใส + ส้มพลังงาน + ฟ้าสด + lime เขียว
// Light: ขาวฟ้าใส + ส้มสด + teal + เขียวสด

export const DARK: ThemeColors = {
  bg: '#111827', bg2: '#1A2535', card: 'rgba(255,255,255,0.06)',
  cardBorder: 'rgba(249,115,22,0.25)', text: '#F9FAFB',
  textMuted: 'rgba(249,250,251,0.55)', textSub: 'rgba(249,250,251,0.35)',
  heroText: '#F9FAFB', heroTextMuted: 'rgba(249,250,251,0.7)', heroTextSub: 'rgba(249,250,251,0.45)',
  accent1: '#F97316', accent2: '#06B6D4', accent3: '#A3E635',
  navBg: 'rgba(17,24,39,0.93)',
  heroGrad: 'linear-gradient(135deg,#1c0a00 0%,#111827 55%,#001420 100%)',
  progressBg: 'rgba(249,115,22,0.12)', tabActive: '#F97316',
  tabBg: 'rgba(249,115,22,0.08)', inputBg: 'rgba(249,115,22,0.07)', altBg: 'rgba(249,115,22,0.07)',
};

export const LIGHT: ThemeColors = {
  bg: '#F0F9FF', bg2: '#E0F2FE', card: '#FFFFFF',
  cardBorder: 'rgba(2,132,199,0.2)', text: '#0C1A2E',
  textMuted: 'rgba(12,26,46,0.6)', textSub: 'rgba(12,26,46,0.4)',
  heroText: '#FFFFFF', heroTextMuted: 'rgba(255,255,255,0.8)', heroTextSub: 'rgba(255,255,255,0.58)',
  accent1: '#EA580C', accent2: '#0284C7', accent3: '#65A30D',
  navBg: 'rgba(240,249,255,0.95)',
  heroGrad: 'linear-gradient(135deg,#c2410c 0%,#0369a1 60%,#15803d 100%)',
  progressBg: 'rgba(234,88,12,0.10)', tabActive: '#EA580C',
  tabBg: 'rgba(234,88,12,0.07)', inputBg: 'rgba(234,88,12,0.06)', altBg: 'rgba(234,88,12,0.07)',
};
