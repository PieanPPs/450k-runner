// Theme
export interface ThemeColors {
  bg: string; bg2: string; card: string; cardBorder: string;
  text: string; textMuted: string; textSub: string;
  heroText: string; heroTextMuted: string; heroTextSub: string;
  accent1: string; accent2: string; accent3: string;
  navBg: string; heroGrad: string; progressBg: string;
  tabActive: string; tabBg: string; inputBg: string; altBg: string;
}
export type ThemeMode = 'dark' | 'light';

// Data
export interface Participant {
  id: number; name: string; initials: string; km: number;
  steps: number; streak: number; weeklyKm: number; activityCount: number;
  ageGroup?: 'general' | 'senior';
}
export interface WeeklyData { week: string; km: number; steps: number }
export interface WeeklySnapshotEntry { id: number; name: string; initials: string; km: number; rank: number }
export interface WeeklySnapshot { weekNo: number; weekLabel: string; snappedAt: string; participants: WeeklySnapshotEntry[] }
export type SeasonStatus = 'done' | 'active' | 'upcoming' | 'pre-season';
export interface SeasonResult {
  name: string; initials: string; km: number; steps: number;
  streak: number; activity_count: number; age_group?: string;
}
export interface Season {
  id?: number; name: string; subtitle: string; dateRange: string; status: SeasonStatus;
  topKm: number; totalKm: number; participants: number; winner: string;
  results?: SeasonResult[] | null;
}
export interface ImprovementEntry {
  name: string; initials: string; currentKm: number; prevKm: number; diff: number; ageGroup?: string;
}
export interface Distance {
  km: number; label: string; icon: string; desc: string; gmapUrl: string;
}
export interface Milestone {
  km: number; reward: string; icon: string; color: string; bg: string; achievers: number;
}
