/**
 * RunCalendar — ปฏิทินสถิติการวิ่งรายสัปดาห์
 * - Overview: heatmap ทุกครู × 13 สัปดาห์
 * - Individual: คลิกชื่อ → modal card + บันทึกเป็นภาพ
 */
import { useState, useEffect, useRef, useContext } from 'react';
import { ThemeCtx } from '@/themes/context';
import { api } from '@/api/client';
import html2canvas from 'html2canvas';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000';

/* ────────── types ────────── */
interface Person {
  strava_key: string;
  name: string;
  initials: string;
  weeks: number[];   // length 13
  total: number;
  best_week: number;
  active_weeks: number;
}
interface StatsData {
  seasonStart: string;
  refDate: string;
  isPreSeason: boolean;
  totalWeeks: number;
  goalKm: number;
  participants: Person[];
}

/* ────────── heatmap colour ────────── */
const HEAT = [
  'rgba(255,255,255,0.05)',  // 0 — no activity
  '#1e1b4b',                  // 1  < 10 km
  '#3730a3',                  // 2  10-20
  '#6d28d9',                  // 3  20-30
  '#a855f7',                  // 4  30-40
  '#ec4899',                  // 5  40+
];
function heatLevel(km: number) {
  if (!km || km <= 0) return 0;
  if (km < 10)  return 1;
  if (km < 20)  return 2;
  if (km < 30)  return 3;
  if (km < 40)  return 4;
  return 5;
}

/* ────────── save as image ────────── */
async function saveCard(el: HTMLElement, name: string, setSaving: (v: boolean) => void) {
  setSaving(true);
  try {
    const canvas = await html2canvas(el, {
      backgroundColor: '#0a0a1a',
      scale: 2,
      useCORS: true,
      logging: false,
    });
    const url = canvas.toDataURL('image/png');
    const a   = document.createElement('a');
    a.href     = url;
    a.download = `run-stats-${name.replace(/\s+/g, '-')}.png`;
    a.click();
  } finally {
    setSaving(false);
  }
}

/* ────────── daily stats type ────────── */
interface DayEntry { run_date: string; week_no: number; day_in_week: number; km: number; }
interface DailyData { refDate: string; isPreSeason: boolean; totalWeeks: number; days: DayEntry[]; }

/* ────────── sub-components ────────── */

/** กล่อง km เล็กๆ ใน overview */
function HeatCell({ km, onClick }: { km: number; onClick?: () => void }) {
  const lv  = heatLevel(km);
  const tip = km > 0 ? `${km.toFixed(1)} กม.` : 'ไม่มีข้อมูล';
  return (
    <div
      title={tip}
      onClick={onClick}
      style={{
        width: 28, height: 28, borderRadius: 4,
        background: HEAT[lv],
        border: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: onClick ? 'pointer' : 'default',
        fontSize: 8, color: lv >= 3 ? '#fff' : '#666',
        fontWeight: 600, transition: 'transform .1s',
        userSelect: 'none',
      }}
      onMouseEnter={e => { if (onClick)(e.currentTarget.style.transform = 'scale(1.25)'); }}
      onMouseLeave={e => { if (onClick)(e.currentTarget.style.transform = 'scale(1)'); }}
    >
      {km > 0 ? km.toFixed(0) : ''}
    </div>
  );
}

/** Individual card — ถูก capture เป็น PNG */
function IndividualCard({
  person, seasonStart, goalKm, cardRef, dailyData, isPreSeason,
}: {
  person: Person;
  seasonStart: string;
  goalKm: number;
  cardRef: React.RefObject<HTMLDivElement>;
  dailyData: DailyData | null;
  isPreSeason: boolean;
}) {
  const pct   = Math.min(100, Math.round((person.total / goalKm) * 100));
  const today = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

  /* สร้าง grid totalWeeks × 7 จาก dailyData */
  const DAY_LABELS = ['1','2','3','4','5','6','7'];
  const numWeeks = dailyData?.totalWeeks ?? person.weeks.length;
  const grid: { km: number; date: string }[][] = Array.from({ length: numWeeks }, () =>
    Array.from({ length: 7 }, () => ({ km: 0, date: '' }))
  );
  if (dailyData) {
    for (const d of dailyData.days) {
      const wi = d.week_no - 1;
      const di = d.day_in_week; // 0-6
      if (wi >= 0 && wi < numWeeks && di >= 0 && di < 7) {
        grid[wi][di] = { km: d.km, date: d.run_date };
      }
    }
  }

  return (
    <div
      ref={cardRef}
      style={{
        background: 'linear-gradient(135deg,#0a0a1a 0%,#12082a 60%,#0a1220 100%)',
        borderRadius: 16, padding: 24, width: 620, maxWidth: '100%',
        fontFamily: "'Sarabun', sans-serif",
        boxShadow: '0 0 60px rgba(168,85,247,0.2)',
        border: '1px solid rgba(168,85,247,0.2)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: 'linear-gradient(135deg,#7c3aed,#ec4899)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontWeight: 700, color: '#fff', flexShrink: 0,
        }}>{person.initials}</div>
        <div>
          <div style={{ fontFamily: 'Bebas Neue', fontSize: 24, letterSpacing: 2, color: '#fff', lineHeight: 1 }}>
            {person.name}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>
            {isPreSeason
              ? `📅 Pre-Season · ก่อนเริ่มแข่ง 1 มิ.ย. 2569`
              : `🏆 Season 2026 · 92 วัน (1 มิ.ย.–31 ส.ค. 2569)`
            }
          </div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontFamily: 'Bebas Neue', fontSize: 30, lineHeight: 1, color: '#a855f7' }}>
            {person.total.toFixed(1)}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>กม. รวม</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>ความคืบหน้า</span>
          <span style={{ color: '#a855f7', fontSize: 11, fontWeight: 700 }}>{pct}% จาก {goalKm} กม.</span>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 999, height: 7, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${pct}%`,
            background: 'linear-gradient(90deg,#7c3aed,#ec4899)',
            borderRadius: 999, boxShadow: '0 0 10px rgba(168,85,247,0.5)',
          }} />
        </div>
      </div>

      {/* Daily heatmap */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 600, letterSpacing: 1 }}>
            กิโลเมตรรายวัน — แต่ละแถว = 1 สัปดาห์ · แต่ละช่อง = 1 วัน
          </span>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: 1, borderRadius: 999,
            padding: '2px 8px',
            background: isPreSeason ? 'rgba(251,146,60,0.2)' : 'rgba(99,102,241,0.2)',
            color: isPreSeason ? '#fb923c' : '#818cf8',
          }}>
            {isPreSeason ? `PRE-SEASON W1–W${numWeeks}` : `SEASON W1–W${numWeeks}`}
          </span>
        </div>
        {/* Column headers: day 1-7 */}
        <div style={{ display: 'grid', gridTemplateColumns: '28px repeat(7,1fr)', gap: 3, marginBottom: 3 }}>
          <div />
          {DAY_LABELS.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
              วัน{d}
            </div>
          ))}
        </div>
        {/* Rows: one per week (totalWeeks rows รวม partial week สุดท้าย) */}
        {grid.map((weekDays, wi) => (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: '28px repeat(7,1fr)', gap: 3, marginBottom: 3 }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 4 }}>
              W{wi + 1}
            </div>
            {weekDays.map((cell, di) => {
              const lv = heatLevel(cell.km);
              return (
                <div key={di}
                  title={cell.date ? `${cell.date}: ${cell.km.toFixed(1)} กม.` : 'ไม่มีข้อมูล'}
                  style={{
                    height: 26, borderRadius: 4,
                    background: HEAT[lv],
                    border: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8, color: lv >= 3 ? '#fff' : '#555', fontWeight: 600,
                  }}
                >
                  {cell.km > 0 ? cell.km.toFixed(1) : ''}
                </div>
              );
            })}
          </div>
        ))}
        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 6, justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginRight: 2 }}>น้อย</span>
          {HEAT.map((c, i) => (
            <div key={i} style={{ width: 11, height: 11, borderRadius: 2, background: c, border: '1px solid rgba(255,255,255,0.1)' }} />
          ))}
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginLeft: 2 }}>40+ กม.</span>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 16 }}>
        {[
          { label: 'รวมทั้งหมด',     value: `${person.total.toFixed(1)} กม.`,  color: '#a855f7' },
          { label: 'สัปดาห์ดีที่สุด', value: `${person.best_week.toFixed(1)} กม.`, color: '#ec4899' },
          { label: 'เฉลี่ย/สัปดาห์',  value: `${person.active_weeks > 0 ? (person.total / person.active_weeks).toFixed(1) : '0'} กม.`, color: '#818cf8' },
          { label: 'สัปดาห์ที่วิ่ง',   value: `${person.active_weeks}/${numWeeks}`,  color: '#34d399' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, padding: '8px 6px', textAlign: 'center',
          }}>
            <div style={{ color: s.color, fontWeight: 700, fontSize: 14, lineHeight: 1, marginBottom: 3 }}>{s.value}</div>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/logo.png" alt="logo"
            style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid rgba(168,85,247,0.4)' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <span style={{ fontFamily: 'Bebas Neue', fontSize: 12, color: '#a855f7', letterSpacing: 2 }}>
            450K TEACHER'S SPIRIT
          </span>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>ณ {today}</span>
      </div>
    </div>
  );
}

/* ────────── main component ────────── */
export default function RunCalendar() {
  const { theme: t } = useContext(ThemeCtx);
  const [data,      setData]      = useState<StatsData | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [selected,  setSelected]  = useState<Person | null>(null);
  const [dailyData, setDailyData] = useState<DailyData | null>(null);
  const [search,    setSearch]    = useState('');
  const [saving,    setSaving]    = useState(false);
  const cardRef = useRef<HTMLDivElement>(null!);

  useEffect(() => {
    api.weeklyStats()
      .then(setData)
      .catch(err => console.error('[RunCalendar]', err))
      .finally(() => setLoading(false));
  }, []);

  /* โหลด daily breakdown เมื่อ modal เปิด */
  useEffect(() => {
    if (!selected) { setDailyData(null); return; }
    fetch(`${BASE}/api/daily-stats?strava_key=${selected.strava_key}`)
      .then(r => r.json())
      .then(setDailyData)
      .catch(err => console.error('[daily-stats]', err));
  }, [selected]);

  const filtered = (data?.participants ?? []).filter(p =>
    search === '' || p.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalWeeks = data?.totalWeeks ?? 13;
  const weeks = Array.from({ length: totalWeeks }, (_, i) => i + 1);

  /* ─── section wrapper ─── */
  return (
    <section id="calendar" style={{ background: t.bg2, padding: '72px 24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ color: t.accent1, fontSize: 12, fontWeight: 700, letterSpacing: 4, marginBottom: 8 }}>
            RUNNING HEATMAP
          </div>
          <div style={{
            fontFamily: 'Bebas Neue', fontSize: 'clamp(28px,5vw,48px)',
            letterSpacing: 3, color: t.text, marginBottom: 8,
          }}>
            ปฏิทินสถิติการวิ่ง
          </div>
          <div style={{ color: t.textMuted, fontSize: 14, marginBottom: data?.isPreSeason ? 10 : 0 }}>
            คลิกชื่อครูเพื่อดูรายละเอียด และบันทึกเป็นภาพ
          </div>
          {data?.isPreSeason && (
            <div style={{
              display: 'inline-block', marginTop: 8,
              background: `${t.accent3}22`, border: `1px solid ${t.accent3}55`,
              borderRadius: 999, padding: '4px 14px', fontSize: 12, color: t.accent3,
            }}>
              ⏳ Pre-Season — นับจากวันที่ {new Date(data.refDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })} · กิจกรรมเริ่ม 1 มิ.ย. 2569
            </div>
          )}
        </div>

        {/* Search */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 ค้นหาชื่อครู..."
            style={{
              background: t.inputBg, border: `1px solid ${t.cardBorder}`,
              borderRadius: 999, padding: '8px 20px', color: t.text,
              fontSize: 14, fontFamily: 'Sarabun', width: 280, outline: 'none',
            }}
          />
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 24 }}>
          <span style={{ color: t.textSub, fontSize: 11 }}>ไม่มี</span>
          {HEAT.map((c, i) => (
            <div key={i} style={{ width: 16, height: 16, borderRadius: 3, background: c, border: `1px solid ${t.cardBorder}` }} />
          ))}
          <span style={{ color: t.textSub, fontSize: 11 }}>40+ กม.</span>
          <span style={{ color: t.textSub, fontSize: 11, marginLeft: 8 }}>• กดที่ชื่อเพื่อดูรายละเอียด</span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: t.textMuted, padding: 60 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <div>กำลังโหลดข้อมูล...</div>
          </div>
        ) : !data || data.participants.length === 0 ? (
          <div style={{ textAlign: 'center', color: t.textMuted, padding: 60 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
            <div>ยังไม่มีข้อมูล — กรุณา Sync Strava ก่อน หรือเริ่มกิจกรรม {data?.seasonStart ?? ''}</div>
          </div>
        ) : (
          /* ─── Overview heatmap ─── */
          <div style={{
            background: t.card, border: `1px solid ${t.cardBorder}`,
            borderRadius: 16, overflow: 'auto',
            boxShadow: `0 4px 24px rgba(0,0,0,0.1)`,
          }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 680 }}>
              <thead>
                {/* ── Phase group header ── */}
                <tr>
                  <th style={{
                    background: t.altBg, position: 'sticky', left: 0, zIndex: 2,
                    borderBottom: 'none', padding: '6px 16px', minWidth: 120,
                  }} />
                  <th
                    colSpan={totalWeeks}
                    style={{
                      textAlign: 'center', padding: '7px 4px',
                      background: data?.isPreSeason
                        ? 'rgba(251,146,60,0.07)'
                        : 'rgba(99,102,241,0.07)',
                      borderBottom: `1px dashed ${data?.isPreSeason ? 'rgba(251,146,60,0.25)' : 'rgba(99,102,241,0.25)'}`,
                    }}
                  >
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 7,
                      fontSize: 10, fontWeight: 700, letterSpacing: 2,
                      color: data?.isPreSeason ? '#fb923c' : '#818cf8',
                    }}>
                      {data?.isPreSeason ? '⏳ PRE-SEASON' : '🏆 SEASON 2026'}
                      <span style={{
                        background: data?.isPreSeason ? 'rgba(251,146,60,0.2)' : 'rgba(99,102,241,0.2)',
                        borderRadius: 999, padding: '1px 8px', fontSize: 9,
                      }}>
                        W1 – W{totalWeeks}
                      </span>
                      <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: 9, fontWeight: 400 }}>
                        {data?.isPreSeason
                          ? '· เริ่มนับ Season ใหม่ W1 วันที่ 1 มิ.ย. 2569'
                          : '· 1 มิ.ย. – 31 ส.ค. 2569 (92 วัน)'}
                      </span>
                    </span>
                  </th>
                  <th style={{
                    background: t.altBg,
                    borderBottom: 'none', padding: 0, minWidth: 64,
                  }} />
                </tr>
                {/* ── Column labels ── */}
                <tr>
                  <th style={{
                    padding: '8px 16px', textAlign: 'left',
                    color: t.textSub, fontSize: 11, fontWeight: 600,
                    borderBottom: `1px solid ${t.cardBorder}`,
                    background: t.altBg, position: 'sticky', left: 0, zIndex: 2,
                    minWidth: 120,
                  }}>
                    ชื่อ
                  </th>
                  {weeks.map(w => (
                    <th key={w} style={{
                      padding: '8px 4px', textAlign: 'center',
                      color: data?.isPreSeason ? '#fb923c' : t.textSub,
                      fontSize: 10, fontWeight: 600,
                      borderBottom: `1px solid ${t.cardBorder}`,
                      background: t.altBg, minWidth: 36,
                    }}>
                      W{w}
                    </th>
                  ))}
                  <th style={{
                    padding: '8px 12px', textAlign: 'center',
                    color: t.accent1, fontSize: 10, fontWeight: 700,
                    borderBottom: `1px solid ${t.cardBorder}`,
                    background: t.altBg, minWidth: 64,
                  }}>
                    รวม
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((person, ri) => (
                  <tr key={person.strava_key}
                    style={{ background: ri % 2 === 0 ? 'transparent' : t.altBg }}
                  >
                    {/* Name — clickable */}
                    <td style={{
                      padding: '8px 16px', position: 'sticky', left: 0, zIndex: 1,
                      background: ri % 2 === 0 ? t.card : t.altBg,
                    }}>
                      <button
                        onClick={() => setSelected(person)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: t.accent1, fontSize: 13, fontWeight: 600,
                          fontFamily: 'Sarabun', textAlign: 'left', padding: 0,
                          textDecoration: 'underline', textDecorationColor: `${t.accent1}55`,
                        }}
                      >
                        {person.name}
                      </button>
                    </td>
                    {/* Week cells */}
                    {person.weeks.map((km, wi) => (
                      <td key={wi} style={{ padding: '8px 4px', textAlign: 'center' }}>
                        <HeatCell km={km} onClick={() => setSelected(person)} />
                      </td>
                    ))}
                    {/* Total */}
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <span style={{
                        background: `${t.accent1}22`, color: t.accent1,
                        borderRadius: 999, padding: '2px 8px', fontSize: 12, fontWeight: 700,
                      }}>
                        {person.total.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Individual modal ─── */}
      {selected && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24, overflowY: 'auto',
          }}
        >
          <div style={{ position: 'relative' }}>
            {/* Close */}
            <button
              onClick={() => setSelected(null)}
              style={{
                position: 'absolute', top: -12, right: -12, zIndex: 10,
                background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '50%', width: 32, height: 32,
                cursor: 'pointer', color: '#fff', fontSize: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >✕</button>

            {/* Card */}
            <IndividualCard
              person={selected}
              seasonStart={data?.seasonStart ?? '2026-06-01'}
              goalKm={data?.goalKm ?? 450}
              cardRef={cardRef}
              dailyData={dailyData}
              isPreSeason={data?.isPreSeason ?? false}
            />

            {/* Save button */}
            <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelected(null)}
                style={{
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 999, padding: '8px 18px', cursor: 'pointer',
                  color: '#ccc', fontSize: 13, fontFamily: 'Sarabun',
                }}
              >
                ปิด
              </button>
              <button
                onClick={() => saveCard(cardRef.current, selected.name, setSaving)}
                disabled={saving}
                style={{
                  background: saving ? 'rgba(168,85,247,0.3)' : 'linear-gradient(135deg,#7c3aed,#ec4899)',
                  border: 'none', borderRadius: 999, padding: '8px 22px',
                  cursor: saving ? 'not-allowed' : 'pointer', color: '#fff',
                  fontSize: 13, fontWeight: 600, fontFamily: 'Sarabun',
                  opacity: saving ? 0.7 : 1, transition: 'opacity .2s',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {saving ? '⏳ กำลังบันทึก...' : '💾 บันทึกเป็นภาพ (.png)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
