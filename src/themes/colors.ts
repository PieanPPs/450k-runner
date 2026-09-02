import { ThemeColors } from '@/types';

// ── Season 2 — Squid Game ───────────────────────────────────────────────────
// Dark: เขียวทีลเข้ม + ชมพู neon + มิ้นท์ + ทอง
// Light: ขาวงาช้าง + ชมพูสด + teal + ทองอ่อน

export const DARK: ThemeColors = {
  bg: '#081510', bg2: '#0D2018', card: 'rgba(255,0,102,0.06)',
  cardBorder: 'rgba(255,0,102,0.28)', text: '#F0EDE6',
  textMuted: 'rgba(240,237,230,0.55)', textSub: 'rgba(240,237,230,0.35)',
  heroText: '#F0EDE6', heroTextMuted: 'rgba(240,237,230,0.7)', heroTextSub: 'rgba(240,237,230,0.45)',
  accent1: '#FF0066', accent2: '#00D4AA', accent3: '#FFD700',
  navBg: 'rgba(8,21,16,0.94)',
  heroGrad: 'linear-gradient(135deg,#1b6b4a 0%,#0d4a32 55%,#4a1030 100%)',
  progressBg: 'rgba(255,0,102,0.13)', tabActive: '#FF0066',
  tabBg: 'rgba(255,0,102,0.08)', inputBg: 'rgba(255,0,102,0.07)', altBg: 'rgba(255,0,102,0.07)',
};

export const LIGHT: ThemeColors = {
  bg: '#F5F0E8', bg2: '#EDE8DC', card: '#FFFFFF',
  cardBorder: 'rgba(220,0,80,0.2)', text: '#1A0A0F',
  textMuted: 'rgba(26,10,15,0.6)', textSub: 'rgba(26,10,15,0.4)',
  heroText: '#FFFFFF', heroTextMuted: 'rgba(255,255,255,0.8)', heroTextSub: 'rgba(255,255,255,0.58)',
  accent1: '#DC0050', accent2: '#00A884', accent3: '#C49A00',
  navBg: 'rgba(245,240,232,0.96)',
  heroGrad: 'linear-gradient(135deg,#FF6B9D 0%,#E8005C 50%,#A8003D 100%)',
  progressBg: 'rgba(220,0,80,0.10)', tabActive: '#DC0050',
  tabBg: 'rgba(220,0,80,0.07)', inputBg: 'rgba(220,0,80,0.06)', altBg: 'rgba(220,0,80,0.07)',
};
