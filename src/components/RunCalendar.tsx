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

/* ────────── save as image ──────────
 * iOS Safari ไม่รองรับ <a download> อย่างเสถียร (ลิงก์ data: URL ขนาดใหญ่
 * มักจะค้างหรือเปิดแท็บเปล่าแทนที่จะดาวน์โหลด) — ใช้ Web Share API
 * (navigator.share + File) เป็นทางเลือกหลักบน iOS แทน ส่วน PC/Android
 * ยังใช้วิธี <a download> เดิมซึ่งทำงานได้ดีอยู่แล้ว
 */
function isIOS() {
  const ua = navigator.userAgent || '';
  // iPad บน iOS 13+ รายงานตัวเป็น Mac แต่รองรับ touch — เช็คเพิ่มจาก maxTouchPoints
  const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/.test(ua) || iPadOS;
}

/* in-app browser ของ LINE / Facebook / Instagram (WKWebView ของแอปเอง)
 * — navigator.share มักไม่ implement จริงและทำให้ promise ค้างไม่ resolve
 * บน iOS ต้องเลี่ยงไปแนะนำให้เปิดใน Safari แทน ไม่งั้นจะเจออาการ "ค้าง" ซ้ำเดิม */
function isInAppBrowser() {
  const ua = navigator.userAgent || '';
  return /Line\//i.test(ua) || /FBAN|FBAV|FB_IAB/i.test(ua) || /Instagram/i.test(ua);
}

async function saveCard(el: HTMLElement, name: string, setSaving: (v: boolean) => void) {
  setSaving(true);
  try {
    // เคสที่พบบ่อย: ผู้ใช้เปิดเว็บผ่าน LINE/FB/IG in-app browser บน iOS
    // — navigator.share ใน webview พวกนี้มักไม่ implement จริง ทำให้ promise ค้าง
    // ไม่ resolve/reject เลย (ตรงกับอาการ "ค้าง" ที่ผู้ใช้แจ้ง) จึงต้องดักไว้ก่อน
    // แล้วแนะนำให้เปิดในเบราว์เซอร์จริง (Safari) แทน
    if (isIOS() && isInAppBrowser()) {
      alert(
        'ตรวจพบว่าเปิดผ่านแอป LINE/Facebook/Instagram บน iOS ครับ\n\n' +
        'การบันทึกภาพอาจค้างหรือไม่ทำงานในเบราว์เซอร์ของแอปเหล่านี้\n\n' +
        'วิธีแก้: แตะปุ่ม "···" หรือ "เปิดในเบราว์เซอร์" ที่มุมขวาบน แล้วเลือก "เปิดด้วย Safari" ' +
        'จากนั้นกลับมากดบันทึกภาพอีกครั้งครับ'
      );
      return;
    }

    const canvas = await html2canvas(el, {
      backgroundColor: '#0a0a1a',
      scale: 2,
      useCORS: true,
      logging: false,
    });
    const filename = `run-stats-${name.replace(/\s+/g, '-')}.png`;

    const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('toBlob failed');

    if (isIOS()) {
      // ทางเลือกหลักบน iOS (Safari จริง): Web Share API — เปิด sheet "บันทึกรูปภาพ" ของ iOS โดยตรง
      const file = new File([blob], filename, { type: 'image/png' });
      const canShareFiles = (navigator as any).canShare?.({ files: [file] });
      if (navigator.share && canShareFiles) {
        try {
          await navigator.share({ files: [file], title: filename });
          return;
        } catch (err: any) {
          // ผู้ใช้กดยกเลิกการแชร์ — ไม่ถือเป็น error
          if (err?.name === 'AbortError') return;
        }
      }
      // Fallback สุดท้ายบน iOS: เปิดรูปในแท็บใหม่ให้ผู้ใช้กดค้างเพื่อบันทึกเอง
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
      return;
    }

    // PC / Android: วิธีเดิม ใช้ <a download> ซึ่งทำงานได้ดี
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
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
  // refDate = วันจันทร์ → day_in_week: 0=จ 1=อ 2=พ 3=พฤ 4=ศ 5=ส 6=อา
  const DAY_LABELS = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];
  const numWeeks = dailyData?.totalWeeks ?? person.weeks.length;
  const grid: { km: number; date: string }[][] = Array.from({ length: numWeeks }, () =>
    Array.from({ length: 7 }, () => ({ km: 0, date: '' }))
  );
  if (dailyData) {
    for (const d of dailyData.days) {
      const wi = d.week_no - 1;
      const di = d.day_in_week;
      if (wi >= 0 && wi < numWeeks && di >= 0 && di < 7) {
        grid[wi][di] = { km: d.km, date: d.run_date };
      }
    }
  }

  /* สีและ text ของ cell ตาม km รายวัน — ปรับให้ contrast ชัดขึ้น */
  function cellBg(km: number) {
    if (!km || km <= 0) return 'rgba(255,255,255,0.04)';
    if (km < 5)  return '#2e1065';
    if (km < 10) return '#4c1d95';
    if (km < 20) return '#6d28d9';
    if (km < 30) return '#8b5cf6';
    if (km < 40) return '#a855f7';
    return '#e879f9';
  }
  function cellTextColor(km: number) {
    if (!km || km <= 0) return 'transparent';
    if (km < 5)  return 'rgba(255,255,255,0.55)';
    return '#fff';
  }
  /* แสดงตัวเลขอย่างกระชับ: < 10 → "9.5", ≥ 10 → "21" (ไม่มีทศนิยมประหยัดพื้นที่) */
  function cellLabel(km: number) {
    if (!km || km <= 0) return '';
    return km < 10 ? km.toFixed(1) : Math.round(km).toString();
  }

  const CELL_H  = 32;   // ความสูง cell (px)
  const CELL_GAP = 4;   // ช่องว่างระหว่าง cell (px)
  const COL_W   = '28px repeat(7,1fr) 8px 52px'; // W-label | 7 วัน | spacer | รวม

  return (
    <div
      ref={cardRef}
      style={{
        background: 'linear-gradient(160deg,#08071a 0%,#110720 55%,#07111e 100%)',
        borderRadius: 20, padding: '24px 26px 20px',
        width: 660, maxWidth: '100%',
        fontFamily: "'Sarabun', sans-serif",
        boxShadow: '0 0 0 1px rgba(139,92,246,0.25), 0 24px 80px rgba(0,0,0,0.7), 0 0 40px rgba(139,92,246,0.12)',
      }}
    >
      {/* ═══ HEADER ═══ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        {/* Avatar */}
        <div style={{
          width: 58, height: 58, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg,#7c3aed 0%,#db2777 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, fontWeight: 800, color: '#fff',
          boxShadow: '0 0 0 3px rgba(139,92,246,0.3), 0 0 20px rgba(139,92,246,0.3)',
        }}>{person.initials}</div>

        {/* Name + badge */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'Bebas Neue', fontSize: 28, letterSpacing: 2,
            color: '#fff', lineHeight: 1.05, whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {person.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
              padding: '2px 8px', borderRadius: 999,
              background: isPreSeason ? 'rgba(251,146,60,0.15)' : 'rgba(99,102,241,0.18)',
              color: isPreSeason ? '#fb923c' : '#a5b4fc',
              border: `1px solid ${isPreSeason ? 'rgba(251,146,60,0.3)' : 'rgba(99,102,241,0.35)'}`,
            }}>
              {isPreSeason ? 'PRE-SEASON' : 'SEASON 2026'}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>
              {isPreSeason ? 'ก่อนเริ่มแข่ง 1 มิ.ย. 2569' : '1 มิ.ย. – 31 ส.ค. 2569 · 92 วัน'}
            </span>
          </div>
        </div>

        {/* Total km — hero number */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{
            fontFamily: 'Bebas Neue', fontSize: 40, lineHeight: 1,
            background: 'linear-gradient(135deg,#c084fc,#f472b6)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            letterSpacing: 1,
          }}>
            {person.total.toFixed(1)}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 600, letterSpacing: 1, marginTop: 1 }}>
            กม. รวม
          </div>
        </div>
      </div>

      {/* ═══ PROGRESS BAR ═══ */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>
            ความคืบหน้า
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#c084fc' }}>
            {pct}% <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>จาก {goalKm} กม.</span>
          </span>
        </div>
        {/* Track */}
        <div style={{
          background: 'rgba(255,255,255,0.07)', borderRadius: 999, height: 10,
          overflow: 'hidden', position: 'relative',
        }}>
          <div style={{
            position: 'absolute', inset: 0, width: `${pct}%`,
            background: 'linear-gradient(90deg,#7c3aed,#a855f7,#ec4899)',
            borderRadius: 999,
            boxShadow: '0 0 12px rgba(168,85,247,0.6)',
          }} />
        </div>
        {/* Milestone ticks */}
        <div style={{ position: 'relative', height: 6, marginTop: 2 }}>
          {[25, 50, 75].map(m => (
            <div key={m} style={{
              position: 'absolute', left: `${m}%`, top: 0,
              width: 1, height: 4,
              background: pct >= m ? 'rgba(168,85,247,0.5)' : 'rgba(255,255,255,0.12)',
              transform: 'translateX(-50%)',
            }} />
          ))}
        </div>
      </div>

      {/* ═══ HEATMAP ═══ */}
      <div style={{
        background: 'rgba(0,0,0,0.2)', borderRadius: 14,
        padding: '14px 14px 10px', marginBottom: 16,
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        {/* Section label */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
        }}>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 700, letterSpacing: 1.5 }}>
            กม. รายวัน
          </span>
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>
            แถว = สัปดาห์ · ช่อง = วัน
          </span>
        </div>

        {/* Column headers */}
        <div style={{ display: 'grid', gridTemplateColumns: COL_W, gap: CELL_GAP, marginBottom: 4 }}>
          <div />
          {DAY_LABELS.map(d => (
            <div key={d} style={{
              textAlign: 'center', fontSize: 10, fontWeight: 700,
              color: 'rgba(255,255,255,0.38)', letterSpacing: 0.3,
            }}>{d}</div>
          ))}
          <div />
          <div style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#c084fc' }}>
            รวม
          </div>
        </div>

        {/* Week rows */}
        {grid.map((weekDays, wi) => {
          const weekTotal = weekDays.reduce((s, c) => s + (c.km || 0), 0);
          const hasActivity = weekTotal > 0;
          return (
            <div key={wi} style={{
              display: 'grid', gridTemplateColumns: COL_W,
              gap: CELL_GAP, marginBottom: CELL_GAP,
            }}>
              {/* Week label */}
              <div style={{
                height: CELL_H, display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                paddingRight: 4,
                fontSize: 10, fontWeight: 700,
                color: hasActivity ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.2)',
              }}>
                W{wi + 1}
              </div>

              {/* Day cells */}
              {weekDays.map((cell, di) => (
                <div key={di}
                  title={cell.date ? `${cell.date}: ${cell.km.toFixed(1)} กม.` : 'ไม่มีข้อมูล'}
                  style={{
                    height: CELL_H, borderRadius: 5,
                    background: cellBg(cell.km),
                    border: cell.km > 0
                      ? '1px solid rgba(255,255,255,0.12)'
                      : '1px solid rgba(255,255,255,0.05)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700,
                    color: cellTextColor(cell.km),
                  }}
                >
                  {cellLabel(cell.km)}
                </div>
              ))}

              {/* Visual spacer before total */}
              <div style={{ height: CELL_H }} />

              {/* Weekly total cell */}
              <div
                title={`รวมสัปดาห์ ${wi + 1}: ${weekTotal.toFixed(1)} กม.`}
                style={{
                  height: CELL_H, borderRadius: 5,
                  background: weekTotal > 0
                    ? 'linear-gradient(135deg,rgba(168,85,247,0.22),rgba(236,72,153,0.14))'
                    : 'rgba(255,255,255,0.03)',
                  border: weekTotal > 0
                    ? '1px solid rgba(192,132,252,0.35)'
                    : '1px solid rgba(255,255,255,0.04)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: weekTotal >= 100 ? 9 : 10, fontWeight: 800,
                  color: weekTotal > 0 ? '#e9d5ff' : 'transparent',
                }}
              >
                {weekTotal > 0 ? (weekTotal >= 100 ? Math.round(weekTotal) : weekTotal.toFixed(1)) : ''}
              </div>
            </div>
          );
        })}

        {/* Legend */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          marginTop: 8, justifyContent: 'flex-end',
        }}>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', marginRight: 3 }}>0</span>
          {['rgba(255,255,255,0.04)','#2e1065','#4c1d95','#8b5cf6','#a855f7','#e879f9'].map((c, i) => (
            <div key={i} style={{
              width: 14, height: 14, borderRadius: 3,
              background: c, border: '1px solid rgba(255,255,255,0.1)',
            }} />
          ))}
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', marginLeft: 3 }}>40+ กม./วัน</span>
        </div>
      </div>

      {/* ═══ STATS ROW ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 18 }}>
        {[
          {
            label: 'รวมทั้งหมด',
            value: person.total.toFixed(1),
            unit: 'กม.',
            color: '#c084fc',
            glow: 'rgba(192,132,252,0.2)',
          },
          {
            label: 'สัปดาห์ดีที่สุด',
            value: person.best_week.toFixed(1),
            unit: 'กม.',
            color: '#f472b6',
            glow: 'rgba(244,114,182,0.2)',
          },
          {
            label: 'เฉลี่ย/สัปดาห์',
            value: person.active_weeks > 0
              ? (person.total / person.active_weeks).toFixed(1)
              : '0',
            unit: 'กม.',
            color: '#818cf8',
            glow: 'rgba(129,140,248,0.2)',
          },
          {
            label: 'สัปดาห์ที่วิ่ง',
            value: `${person.active_weeks}/${numWeeks}`,
            unit: 'สัปดาห์',
            color: '#34d399',
            glow: 'rgba(52,211,153,0.2)',
          },
        ].map(s => (
          <div key={s.label} style={{
            background: `${s.glow}`,
            border: `1px solid ${s.color}30`,
            borderRadius: 10, padding: '10px 8px',
            textAlign: 'center',
          }}>
            <div style={{
              fontFamily: 'Bebas Neue',
              fontSize: 22, lineHeight: 1,
              color: s.color, marginBottom: 1,
            }}>{s.value}</div>
            <div style={{ color: s.color, opacity: 0.6, fontSize: 8, fontWeight: 700, letterSpacing: 0.5 }}>
              {s.unit}
            </div>
            <div style={{
              color: 'rgba(255,255,255,0.3)', fontSize: 9, marginTop: 3, lineHeight: 1.2,
            }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ═══ FOOTER ═══ */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 12,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/logo.png" alt="logo"
            style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid rgba(168,85,247,0.5)' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <span style={{
            fontFamily: 'Bebas Neue', fontSize: 13, color: '#a855f7',
            letterSpacing: 2.5,
          }}>
            450K TEACHER'S SPIRIT
          </span>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>ณ {today}</span>
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
