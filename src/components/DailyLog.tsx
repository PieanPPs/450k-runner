import { useContext, useEffect, useState, useCallback } from 'react';
import { ThemeCtx } from '@/themes/context';
import { SectionHeader } from '@/components/UI';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000';

interface Activity {
  strava_key: string;
  name: string;
  initials: string;
  activity_name: string;
  distance_km: number;
  elapsed_time: number;
  first_seen: string;
}

interface DayInfo {
  day: string;
  count: number;
  total_km: number;
  runners: number;
}

function fmtPace(distKm: number, elapsed: number): string {
  if (!distKm || !elapsed) return '—';
  const paceMin = (elapsed / 60) / distKm;
  const m = Math.floor(paceMin);
  const s = Math.round((paceMin - m) * 60).toString().padStart(2, '0');
  return `${m}:${s}/km`;
}

function fmtDuration(elapsed: number): string {
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  if (h > 0) return `${h}ชม. ${m}น.`;
  return `${m} น.`;
}

export default function DailyLog() {
  const { theme: t } = useContext(ThemeCtx);
  const todayBkk = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }).slice(0, 10);

  const [date, setDate]       = useState(todayBkk);
  const [activities, setActs] = useState<Activity[]>([]);
  const [days, setDays]       = useState<DayInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/daily?date=${d}`);
      const json = await res.json();
      setActs(json.activities ?? []);
      setDays(json.days ?? []);
    } catch { setActs([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(date); }, [date, load]);

  const totalKm = activities.reduce((s, a) => s + a.distance_km, 0);

  // display date in Thai format
  const displayDate = new Date(date + 'T12:00:00').toLocaleDateString('th-TH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <section id="daily" style={{ padding: '80px 24px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <SectionHeader tag="บันทึกกิจกรรม" title="Daily Log" />

        {/* ── date tabs (30 วันล่าสุด) ── */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24, overflowX: 'auto', paddingBottom: 4 }}>
          {days.map((d: any) => (
            <button key={d.day} onClick={() => setDate(d.day)} style={{
              padding: '6px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
              fontFamily: 'Sarabun', fontSize: 12, fontWeight: 600, flexShrink: 0,
              background: date === d.day ? t.tabActive : t.tabBg,
              color: date === d.day ? '#fff' : t.textMuted,
              transition: 'all 0.2s',
              outline: d.baseline_count > 0 ? '1px solid #f59e0b55' : 'none',
            }}>
              {d.day.slice(5)}
              <span style={{ display: 'block', fontSize: 10, opacity: 0.8 }}>
                {d.total_km > 0 ? `${d.total_km} km` : '—'}
                {d.baseline_count > 0 ? ' 📋' : ''}
              </span>
            </button>
          ))}
        </div>

        {/* ── header วันที่เลือก ── */}
        <div style={{
          background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 16,
          padding: '16px 20px', marginBottom: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 2 }}>📆 วันที่</div>
            <div style={{ fontFamily: 'Bebas Neue', fontSize: 20, color: t.text, letterSpacing: 1 }}>{displayDate}</div>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            {[
              { label: `${activities.length} กิจกรรม`, icon: '⚡' },
              { label: `${new Set(activities.map(a => a.strava_key)).size} คน`, icon: '🏃' },
              { label: `${Math.round(totalKm * 10) / 10} km รวม`, icon: '📏' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18 }}>{s.icon}</div>
                <div style={{ fontSize: 13, color: t.text, fontWeight: 700 }}>{s.label}</div>
              </div>
            ))}
          </div>
          {/* date picker */}
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{
              background: t.tabBg, border: `1px solid ${t.cardBorder}`, borderRadius: 8,
              padding: '6px 10px', color: t.text, fontSize: 13, fontFamily: 'Sarabun', cursor: 'pointer',
            }} />
        </div>

        {/* ── list ── */}
        {loading ? (
          <div style={{ textAlign: 'center', color: t.textMuted, padding: 48 }}>กำลังโหลด...</div>
        ) : activities.length === 0 ? (
          <div style={{
            background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 16,
            padding: 48, textAlign: 'center', color: t.textMuted,
          }}>
            ไม่มีกิจกรรมในวันที่ {date}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activities.map((a, i) => {
              const initials = a.initials || (a.name?.slice(0, 2).toUpperCase() ?? '??');
              return (
                <div key={i} style={{
                  background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 14,
                  padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14,
                  transition: 'transform 0.15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateX(4px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateX(0)'}>

                  {/* avatar */}
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                    background: `linear-gradient(135deg,${t.accent1},${t.accent2})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'Bebas Neue', fontSize: 15, color: '#fff', letterSpacing: 1,
                  }}>{initials}</div>

                  {/* name + activity */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {a.name}
                    </div>
                    <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                      {a.activity_name || 'กิจกรรมวิ่ง'} · {a.first_seen?.slice(11, 16) ?? ''}
                    </div>
                  </div>

                  {/* stats */}
                  <div style={{ display: 'flex', gap: 20, flexShrink: 0, textAlign: 'right' }}>
                    <div>
                      <div style={{ fontFamily: 'Bebas Neue', fontSize: 20, color: t.accent1, letterSpacing: 1 }}>
                        {a.distance_km.toFixed(2)}
                      </div>
                      <div style={{ fontSize: 10, color: t.textMuted }}>km</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{fmtPace(a.distance_km, a.elapsed_time)}</div>
                      <div style={{ fontSize: 10, color: t.textMuted }}>{fmtDuration(a.elapsed_time)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
