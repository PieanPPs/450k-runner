import { useContext, useEffect, useState } from 'react';
import { ThemeCtx } from '@/themes/context';
import { useAppData } from '@/context/DataContext';
import { SectionHeader } from '@/components/UI';
import { api } from '@/api/client';
import type { WeeklySnapshot } from '@/types';

// ---- medal colors ----
const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function WeeklyGraph() {
  const { theme: t } = useContext(ThemeCtx);
  const { data } = useAppData();
  const { participants } = data;

  const [tab, setTab] = useState<'current' | 'history'>('current');
  const [snapshots, setSnapshots] = useState<WeeklySnapshot[]>([]);
  const [loadingSnap, setLoadingSnap] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);

  // sort participants by weeklyKm
  const current = [...participants].sort((a, b) => b.weeklyKm - a.weeklyKm);
  const maxKm = Math.max(...current.map(p => p.weeklyKm), 0.1);

  useEffect(() => {
    if (tab !== 'history') return;
    setLoadingSnap(true);
    api.weeklySnapshots()
      .then(d => {
        setSnapshots(d);
        if (d.length > 0 && selectedWeek === null) setSelectedWeek(d[0].weekNo);
      })
      .catch(() => setSnapshots([]))
      .finally(() => setLoadingSnap(false));
  }, [tab]);

  const selectedSnap = snapshots.find(s => s.weekNo === selectedWeek);

  return (
    <section id="weekly" style={{ padding: '80px 24px', background: t.altBg }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <SectionHeader tag="รายสัปดาห์" title="ผลการแข่งขันประจำสัปดาห์" />

        {/* tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
          {([['current', 'สัปดาห์ปัจจุบัน'], ['history', 'ผลย้อนหลัง']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              style={{
                padding: '8px 20px', borderRadius: 999, cursor: 'pointer',
                fontFamily: 'Sarabun', fontSize: 14, fontWeight: 600,
                background: tab === key ? `linear-gradient(135deg,${t.accent1},${t.accent2})` : t.card,
                color: tab === key ? '#fff' : t.textMuted,
                border: tab !== key ? `1px solid ${t.cardBorder}` : 'none',
                transition: 'all 0.2s',
              }}
            >{label}</button>
          ))}
        </div>

        {/* ---- current week ---- */}
        {tab === 'current' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {current.length === 0 && (
              <div style={{ color: t.textMuted, textAlign: 'center', padding: 40, fontSize: 14 }}>
                ยังไม่มีข้อมูล — กด Sync Strava เพื่อโหลดข้อมูล
              </div>
            )}
            {current.map((p, i) => {
              const pct = maxKm > 0 ? (p.weeklyKm / maxKm) * 100 : 0;
              const isTop3 = i < 3;
              return (
                <div key={p.id} style={{
                  background: t.card, border: `1px solid ${isTop3 ? t.accent1 + '44' : t.cardBorder}`,
                  borderRadius: 14, padding: '14px 18px',
                  display: 'flex', alignItems: 'center', gap: 14,
                  boxShadow: isTop3 ? `0 0 12px ${t.accent1}22` : 'none',
                  transition: 'transform 0.15s',
                }}>
                  {/* rank */}
                  <div style={{ minWidth: 32, textAlign: 'center', fontFamily: 'Bebas Neue', fontSize: 22, color: isTop3 ? t.accent1 : t.textSub, lineHeight: 1 }}>
                    {MEDAL[i + 1] ?? <span style={{ fontSize: 16 }}>{i + 1}</span>}
                  </div>
                  {/* avatar */}
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                    background: `linear-gradient(135deg,${t.accent1},${t.accent2})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 700, fontSize: 13,
                  }}>{p.initials || p.name.slice(0, 2)}</div>
                  {/* name + bar */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ color: t.text, fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                      <span style={{ color: t.accent1, fontWeight: 700, fontSize: 14, fontFamily: 'Bebas Neue', letterSpacing: 1, flexShrink: 0, marginLeft: 8 }}>
                        {p.weeklyKm.toFixed(1)} <span style={{ fontSize: 10, color: t.textSub, fontFamily: 'Sarabun', fontWeight: 400 }}>km</span>
                      </span>
                    </div>
                    <div style={{ background: t.progressBg, borderRadius: 999, height: 7, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 999, transition: 'width 1s ease',
                        width: `${pct}%`,
                        background: isTop3
                          ? `linear-gradient(90deg,${t.accent1},${t.accent2})`
                          : `linear-gradient(90deg,${t.accent2},${t.accent3})`,
                        boxShadow: isTop3 ? `0 0 8px ${t.accent1}80` : 'none',
                      }} />
                    </div>
                  </div>
                </div>
              );
            })}
            <div style={{ marginTop: 12, color: t.textSub, fontSize: 11, textAlign: 'center' }}>
              * ผลรายสัปดาห์จะถูกบันทึกอัตโนมัติทุกวันอาทิตย์ 23:59 เพื่อเก็บเป็นประวัติ
            </div>
          </div>
        )}

        {/* ---- history ---- */}
        {tab === 'history' && (
          <div>
            {loadingSnap && (
              <div style={{ color: t.textMuted, textAlign: 'center', padding: 40, fontSize: 14 }}>กำลังโหลด...</div>
            )}
            {!loadingSnap && snapshots.length === 0 && (
              <div style={{
                background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 16,
                padding: '40px 24px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📅</div>
                <div style={{ color: t.text, fontWeight: 600, fontSize: 16, marginBottom: 8 }}>ยังไม่มีผลย้อนหลัง</div>
                <div style={{ color: t.textMuted, fontSize: 13, lineHeight: 1.6 }}>
                  ผลประจำสัปดาห์จะถูกบันทึกอัตโนมัติทุกวันอาทิตย์ 23:59<br />
                  หลังจากนั้นจะแสดงผลแต่ละสัปดาห์ที่นี่
                </div>
              </div>
            )}
            {!loadingSnap && snapshots.length > 0 && (
              <>
                {/* week selector */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                  {snapshots.map(s => (
                    <button key={s.weekNo} onClick={() => setSelectedWeek(s.weekNo)}
                      style={{
                        padding: '6px 14px', borderRadius: 999, cursor: 'pointer',
                        fontFamily: 'Sarabun', fontSize: 13, fontWeight: 600,
                        background: selectedWeek === s.weekNo
                          ? `linear-gradient(135deg,${t.accent1},${t.accent2})`
                          : t.card,
                        color: selectedWeek === s.weekNo ? '#fff' : t.textMuted,
                        border: selectedWeek !== s.weekNo ? `1px solid ${t.cardBorder}` : 'none',
                      }}
                    >{s.weekLabel}</button>
                  ))}
                </div>

                {/* snapshot table */}
                {selectedSnap && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ color: t.textSub, fontSize: 11, marginBottom: 4 }}>
                      บันทึกเมื่อ {new Date(selectedSnap.snappedAt).toLocaleDateString('th-TH', { dateStyle: 'medium' })}
                    </div>
                    {selectedSnap.participants.map(p => (
                      <div key={p.id} style={{
                        background: t.card, border: `1px solid ${p.rank <= 3 ? t.accent1 + '44' : t.cardBorder}`,
                        borderRadius: 12, padding: '12px 16px',
                        display: 'flex', alignItems: 'center', gap: 12,
                      }}>
                        <div style={{ minWidth: 28, textAlign: 'center', fontFamily: 'Bebas Neue', fontSize: 20, color: p.rank <= 3 ? t.accent1 : t.textSub }}>
                          {MEDAL[p.rank] ?? p.rank}
                        </div>
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%',
                          background: `linear-gradient(135deg,${t.accent1},${t.accent2})`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0,
                        }}>{p.initials || p.name.slice(0, 2)}</div>
                        <div style={{ flex: 1 }}>
                          <span style={{ color: t.text, fontWeight: 600, fontSize: 14 }}>{p.name}</span>
                        </div>
                        <div style={{ color: t.accent1, fontWeight: 700, fontFamily: 'Bebas Neue', fontSize: 18, letterSpacing: 1 }}>
                          {p.km.toFixed(1)} <span style={{ fontSize: 10, color: t.textSub, fontFamily: 'Sarabun', fontWeight: 400 }}>km</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
