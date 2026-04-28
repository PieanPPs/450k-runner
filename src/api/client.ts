/**
 * Frontend API client — fetch ข้อมูลจาก backend Express
 * Base URL อ่านจาก VITE_API_URL (หรือ default http://localhost:4000)
 */

import type { Participant, WeeklyData, WeeklySnapshot, Season, Distance, Milestone } from '@/types';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${path} → ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

// ---------- endpoints ----------

export const api = {
  summary    : ()  => get<{ totalKm: number; goalKm: number; participantCount: number; pct: number }>('/api/summary'),
  participants: ()  => get<Participant[]>('/api/participants'),
  leaderboard : (metric = 'km') => get<{ metric: string; rows: Participant[] }>(`/api/leaderboard?metric=${metric}`),
  weekly      : ()  => get<WeeklyData[]>('/api/weekly'),
  seasons     : ()  => get<Season[]>('/api/seasons'),
  distances   : ()  => get<Distance[]>('/api/distances'),
  milestones  : ()  => get<Milestone[]>('/api/milestones'),
  authStatus  : ()  => get<{ id: number; name: string; initials: string; connected: number }[]>('/api/auth/status'),
  syncLast    : ()  => get<{ synced_at: string | null; status: string }>('/api/sync/last'),

  weeklySnapshots: () => get<WeeklySnapshot[]>('/api/weekly-snapshots'),

  /** Trigger full Strava sync */
  triggerSync : async () => {
    const res = await fetch(`${BASE}/api/sync`, { method: 'POST' });
    if (!res.ok) throw new Error(`Sync failed: ${res.status}`);
    return res.json() as Promise<{ ok: boolean; synced: number; total: number }>;
  },

  /** Project settings (public) */
  settings: () => get<Record<string, string>>('/api/settings'),

  /** สร้าง Strava connect URL สำหรับผู้เข้าร่วม */
  stravaConnectUrl: (participantId: number) =>
    `${BASE}/api/auth/strava?participant_id=${participantId}`,
};
