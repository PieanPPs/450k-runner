/**
 * DataContext — ดึงข้อมูลทั้งหมดจาก backend ครั้งเดียวตอน mount
 * expose: data, loading, error, refresh (ดึงใหม่จาก API), sync (trigger Strava sync แล้วดึงใหม่)
 *
 * ถ้า backend ไม่ตอบสนอง จะ fallback ไปใช้ mock data อัตโนมัติ
 */

import {
  createContext, useCallback, useContext,
  useEffect, useRef, useState,
} from 'react';
import type { ReactNode } from 'react';
import { api } from '@/api/client';
import type { Participant, WeeklyData, Season, Distance, Milestone } from '@/types';

// ---- mock fallback ----
import {
  PARTICIPANTS, WEEKLY_DATA, SEASONS, DISTANCES, MILESTONES, GOAL_KM,
} from '@/data/mock';

// ---- types ----
export interface AppData {
  participants  : Participant[];
  weeklyData    : WeeklyData[];
  seasons       : Season[];
  distances     : Distance[];
  milestones    : Milestone[];
  totalKm       : number;
  goalKm        : number;
  pct           : number;
  lastSync      : string | null;   // ISO string หรือ null
  isMockData    : boolean;         // true = ใช้ mock, false = ข้อมูลจริงจาก API
  settings      : Record<string, string>;
}

interface DataCtxValue {
  data     : AppData;
  loading  : boolean;
  error    : string | null;
  /** ดึงข้อมูลใหม่จาก API (ไม่ trigger Strava sync) */
  refresh  : () => Promise<void>;
  /** Trigger Strava sync แล้ว refresh ข้อมูล */
  sync     : () => Promise<{ synced: number; total: number }>;
  syncing  : boolean;
}

// ---- mock snapshot ----
const MOCK_DATA: AppData = {
  participants: PARTICIPANTS,
  weeklyData  : WEEKLY_DATA,
  seasons     : SEASONS,
  distances   : DISTANCES,
  milestones  : MILESTONES,
  totalKm     : PARTICIPANTS.reduce((s, p) => s + p.km, 0),
  goalKm      : GOAL_KM,
  pct         : Math.min(100, (PARTICIPANTS.reduce((s, p) => s + p.km, 0) / GOAL_KM) * 100),
  lastSync    : null,
  isMockData  : true,
  settings    : {},
};

// ---- context ----
const DataCtx = createContext<DataCtxValue | null>(null);

export function useAppData(): DataCtxValue {
  const ctx = useContext(DataCtx);
  if (!ctx) throw new Error('useAppData must be used inside <DataProvider>');
  return ctx;
}

// ---- provider ----
export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData]       = useState<AppData>(MOCK_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const isMounted = useRef(true);

  const fetchAll = useCallback(async () => {
    try {
      const [summary, participants, weeklyData, seasons, distances, milestones, syncLog] =
        await Promise.all([
          api.summary(),
          api.participants(),
          api.weekly(),
          api.seasons(),
          api.distances(),
          api.milestones(),
          api.syncLast(),
        ]);

      // settings ดึงแยก — ถ้า fail (เช่น backend เก่ายังไม่มี route) ไม่ทำให้ข้อมูลหลักพัง
      const settings = await api.settings().catch(() => ({} as Record<string, string>));

      if (!isMounted.current) return;

      setData({
        participants,
        weeklyData,
        seasons,
        distances,
        milestones,
        totalKm  : summary.totalKm,
        goalKm   : summary.goalKm,
        pct      : summary.pct,
        lastSync : syncLog.synced_at,
        isMockData: false,
        settings,
      });
      setError(null);
    } catch (err) {
      if (!isMounted.current) return;
      // backend ไม่ตอบสนอง → ใช้ mock data + แจ้ง error
      setError((err as Error).message);
      setData(MOCK_DATA);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    fetchAll();
    return () => { isMounted.current = false; };
  }, [fetchAll]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchAll();
  }, [fetchAll]);

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await api.triggerSync();
      await fetchAll();
      return { synced: result.synced, total: result.total };
    } finally {
      setSyncing(false);
    }
  }, [fetchAll]);

  return (
    <DataCtx.Provider value={{ data, loading, error, refresh, sync, syncing }}>
      {children}
    </DataCtx.Provider>
  );
}
