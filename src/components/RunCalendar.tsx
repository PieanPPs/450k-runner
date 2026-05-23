/**
 * RunCalendar — ปฏิทินสถิติการวิ่งรายสัปดาห์
 * - Overview: heatmap ทุกครู × 13 สัปดาห์
 * - Individual: คลิกชื่อ → modal card + บันทึกเป็นภาพ
 */
import { useState, useEffect, useRef, useContext } from 'react';
import { ThemeCtx } from '@/themes/context';
import { api } from '@/api/client';
import html2canvas from 'html2canvas';

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
  person, seasonStart, goalKm, cardRef,
}: {
  person: Person;
  seasonStart: string;
  goalKm: number;
  cardRef: React.RefObject<HTMLDivElement>;
}) {
  const pct    = Math.min(100, Math.round((person.total / goalKm) * 100));
  const today  = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
  const weeks  = Array.from({ length: 13 }, (_, i) => i + 1);

  return (
    <div
      ref={cardRef}
      style={{
        background: 'linear-gradient(135deg,#0a0a1a 0%,#12082a 60%,#0a1220 100%)',
        borderRadius: 16, padding: 28, width: 540, maxWidth: '100%',
        fontFamily: "'Sarabun', sans-serif",
        boxShadow: '0 0 60px rgba(168,85,247,0.2)',
        border: '1px solid rgba(168,85,247,0.2)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'linear-gradient(135deg,#7c3aed,#ec4899)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, fontWeight: 700, color: '#fff', flexShrink: 0,
        }}>
          {person.initials}
        </div>
        <div>
          <div style={{ fontFamily: 'Bebas Neue', fontSize: 26, letterSpacing: 2, color: '#fff', lineHeight: 1 }}>
            {person.name}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 2 }}>
            สถิติการวิ่ง 92 วัน · เริ่ม {new Date(seasonStart).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{
            fontFamily: 'Bebas Neue', fontSize: 32, lineHeight: 1,
            background: 'linear-gradient(90deg,#a855f7,#ec4899)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            {person.total.toFixed(1)}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, letterSpacing: 1 }}>กม. รวม</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>ความคืบหน้า</span>
          <span style={{ color: '#a855f7', fontSize: 11, fontWeight: 700 }}>{pct}% จาก {goalKm} กม.</span>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 999, height: 8, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${pct}%`,
            background: 'linear-gradient(90deg,#7c3aed,#ec4899)',
            borderRadius: 999, transition: 'width 1s ease',
            boxShadow: '0 0 10px rgba(168,85,247,0.6)',
          }} />
        </div>
      </div>

      {/* Heatmap grid */}
      <div style={{ marginBottom: 18 }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(13, 1fr)',
          gap: 4, marginBottom: 4,
        }}>
          {weeks.map(w => (
            <div key={w} style={{ textAlign: 'center', fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
              W{w}
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(13, 1fr)', gap: 4 }}>
          {person.weeks.map((km, i) => {
            const lv = heatLevel(km);
            return (
              <div key={i} title={`สัปดาห์ ${i+1}: ${km.toFixed(1)} กม.`} style={{
                height: 32, borderRadius: 5,
                background: HEAT[lv],
                border: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, color: lv >= 3 ? '#fff' : '#666',
                fontWeight: 600,
              }}>
                {km > 0 ? km.toFixed(0) : ''}
              </div>
            );
          })}
        </div>
        {/* color legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginRight: 2 }}>น้อย</span>
          {HEAT.map((c, i) => (
            <div key={i} style={{ width: 12, height: 12, borderRadius: 2, background: c, border: '1px solid rgba(255,255,255,0.1)' }} />
          ))}
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginLeft: 2 }}>มาก</span>
        </div>
      </div>

      {/* Stats row */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
        marginBottom: 20,
      }}>
        {[
          { label: 'รวมทั้งหมด', value: `${person.total.toFixed(1)} กม.`, color: '#a855f7' },
          { label: 'สัปดาห์ดีที่สุด', value: `${person.best_week.toFixed(1)} กม.`, color: '#ec4899' },
          { label: 'เฉลี่ย/สัปดาห์', value: `${person.active_weeks > 0 ? (person.total / person.active_weeks).toFixed(1) : '0'} กม.`, color: '#818cf8' },
          { label: 'สัปดาห์ที่วิ่ง', value: `${person.active_weeks}/13`, color: '#34d399' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, padding: '10px 8px', textAlign: 'center',
          }}>
            <div style={{ color: s.color, fontWeight: 700, fontSize: 15, lineHeight: 1, marginBottom: 4 }}>{s.value}</div>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.08)',
        paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/logo.png" alt="logo"
            style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid rgba(168,85,247,0.4)' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <span style={{ fontFamily: 'Bebas Neue', fontSize: 13, color: '#a855f7', letterSpacing: 2 }}>
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
  const [data,     setData]     = useState<StatsData | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState<Person | null>(null);
  const [search,   setSearch]   = useState('');
  const [saving,   setSaving]   = useState(false);
  const cardRef = useRef<HTMLDivElement>(null!);

  useEffect(() => {
    api.weeklyStats()
      .then(setData)
      .catch(err => console.error('[RunCalendar]', err))
      .finally(() => setLoading(false));
  }, []);

  const filtered = (data?.participants ?? []).filter(p =>
    search === '' || p.name.toLowerCase().includes(search.toLowerCase())
  );

  const weeks = Array.from({ length: 13 }, (_, i) => i + 1);

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
                <tr>
                  <th style={{
                    padding: '12px 16px', textAlign: 'left',
                    color: t.textSub, fontSize: 11, fontWeight: 600,
                    borderBottom: `1px solid ${t.cardBorder}`,
                    background: t.altBg, position: 'sticky', left: 0, zIndex: 2,
                    minWidth: 120,
                  }}>
                    ชื่อ
                  </th>
                  {weeks.map(w => (
                    <th key={w} style={{
                      padding: '12px 4px', textAlign: 'center',
                      color: t.textSub, fontSize: 10, fontWeight: 600,
                      borderBottom: `1px solid ${t.cardBorder}`,
                      background: t.altBg, minWidth: 36,
                    }}>
                      W{w}
                    </th>
                  ))}
                  <th style={{
                    padding: '12px 12px', textAlign: 'center',
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
