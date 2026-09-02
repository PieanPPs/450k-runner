import { ThemeColors } from '@/types';

// ── Season 2 — Dawn Runner ──────────────────────────────────────────────────
// Dark: กลางคืน/รุ่งอรุณ — navy ลึก + cyan ไฟฟ้า + เขียว neon + ทอง
// Light: เช้าสดใส — ขาวฟ้า + teal + emerald + ส้มรุ่งอรุณ

export const DARK: ThemeColors = {
  bg: '#020D18', bg2: '#061828', card: 'rgba(0,229,255,0.05)',
  cardBorder: 'rgba(0,229,255,0.18)', text: '#E8F8FF',
  textMuted: 'rgba(232,248,255,0.55)', textSub: 'rgba(232,248,255,0.35)',
  heroText: '#E8F8FF', heroTextMuted: 'rgba(232,248,255,0.65)', heroTextSub: 'rgba(232,248,255,0.4)',
  accent1: '#00E5FF', accent2: '#00FF87', accent3: '#FFB800',
  navBg: 'rgba(2,13,24,0.93)',
  heroGrad: 'linear-gradient(135deg,#001a2e 0%,#020D18 55%,#001a12 100%)',
  progressBg: 'rgba(0,229,255,0.10)', tabActive: '#00E5FF',
  tabBg: 'rgba(0,229,255,0.06)', inputBg: 'rgba(0,229,255,0.06)', altBg: 'rgba(0,229,255,0.07)',
};

export const LIGHT: ThemeColors = {
  bg: '#EEF9FC', bg2: '#DDF3F8', card: '#FFFFFF',
  cardBorder: 'rgba(0,140,180,0.2)', text: '#082530',
  textMuted: 'rgba(8,37,48,0.6)', textSub: 'rgba(8,37,48,0.4)',
  heroText: '#FFFFFF', heroTextMuted: 'rgba(255,255,255,0.78)', heroTextSub: 'rgba(255,255,255,0.55)',
  accent1: '#0093AF', accent2: '#00976B', accent3: '#E05C00',
  navBg: 'rgba(238,249,252,0.95)',
  heroGrad: 'linear-gradient(135deg,#004d66 0%,#006d55 50%,#003d55 100%)',
  progressBg: 'rgba(0,147,175,0.10)', tabActive: '#0093AF',
  tabBg: 'rgba(0,147,175,0.06)', inputBg: 'rgba(0,147,175,0.05)', altBg: 'rgba(0,147,175,0.07)',
};
