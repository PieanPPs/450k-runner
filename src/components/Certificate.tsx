import { useContext, useState } from 'react';
import { ThemeCtx } from '@/themes/context';
import { SectionHeader } from '@/components/UI';
import { useAppData } from '@/context/DataContext';

export default function Certificate() {
  const { theme: t } = useContext(ThemeCtx);
  const [expanded, setExpanded] = useState(false);
  const { data } = useAppData();
  const { settings } = data;

  return (
    <section id="certificate" style={{ padding: '80px 24px', background: t.altBg }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <SectionHeader tag="เกียรติบัตร" title="รางวัลแห่งความภาคภูมิใจ" />
        <p style={{ textAlign: 'center', color: t.textMuted, fontSize: 14, marginBottom: 48, marginTop: -16 }}>
          ผู้เข้าร่วมโครงการทุกท่านจะได้รับเกียรติบัตรดิจิทัลเป็นที่ระลึกถาวร
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, justifyContent: 'center', alignItems: 'flex-start' }}>
          <div style={{ flex: '0 0 320px', maxWidth: 360 }}>
            <CertificateCard
              sigDirector={settings.sig_director || ''}
              sigChair={settings.sig_chair || ''}
              sigDirectorName={settings.sig_director_name || ''}
              sigChairName={settings.sig_chair_name || ''}
            />
            <p style={{ textAlign: 'center', color: t.textMuted, fontSize: 12, marginTop: 12 }}>
              ✦ ตัวอย่างเกียรติบัตร — ออกให้เมื่อวิ่งครบเป้าหมาย
            </p>
          </div>

          <div style={{ flex: '0 0 260px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{
              background: `linear-gradient(135deg, ${t.accent1}18, ${t.accent2}12)`,
              border: `1px solid ${t.accent1}40`,
              borderRadius: 16, padding: 24,
            }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🏅</div>
              <div style={{ color: t.text, fontWeight: 700, fontSize: 15, marginBottom: 6 }}>เกียรติบัตรดิจิทัล</div>
              <div style={{ color: t.textMuted, fontSize: 13, lineHeight: 1.7 }}>
                ออกให้โดยผู้อำนวยการโรงเรียน สำหรับผู้เข้าร่วมโครงการ
              </div>
            </div>
            <div style={{ background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 16, padding: 20 }}>
              <div style={{ color: t.accent2, fontSize: 13, fontWeight: 700, marginBottom: 12 }}>📋 เงื่อนไขการรับ</div>
              {[
                { icon: '🏃', text: 'เข้าร่วมโครงการ' },
                { icon: '📱', text: 'บันทึกกิจกรรมผ่าน Strava' },
                { icon: '🏫', text: 'เป็นสมาชิก Club โรงเรียน' },
                { icon: '✅', text: 'ผ่านการตรวจสอบจากผู้ดูแลระบบ' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 14 }}>{item.icon}</span>
                  <span style={{ color: t.textMuted, fontSize: 12, lineHeight: 1.6 }}>{item.text}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setExpanded(true)} style={{
              width: '100%',
              background: `linear-gradient(135deg,${t.accent1},${t.accent2})`,
              border: 'none', borderRadius: 12, padding: '12px',
              color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Sarabun',
            }}>
              🔎 ดูตัวอย่างเต็มจอ
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div onClick={() => setExpanded(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: 24,
        }}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: 420, width: '100%' }}>
            <CertificateCard large
              sigDirector={settings.sig_director || ''}
              sigChair={settings.sig_chair || ''}
              sigDirectorName={settings.sig_director_name || ''}
              sigChairName={settings.sig_chair_name || ''}
            />
            <button onClick={() => setExpanded(false)} style={{
              display: 'block', margin: '20px auto 0',
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 8, padding: '8px 32px', color: '#fff', cursor: 'pointer',
              fontSize: 13, fontFamily: 'Sarabun',
            }}>✕ ปิด</button>
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Corner HUD bracket (SVG) ────────────────────────────────
function HUDCorner({ size = 50, flip = [false, false] as [boolean, boolean] }) {
  const [fx, fy] = flip;
  const c = '#e91e8c';
  return (
    <svg width={size + 18} height={size + 18} style={{
      transform: `scale(${fx ? -1 : 1},${fy ? -1 : 1})`,
      transformOrigin: 'center', display: 'block',
    }}>
      <path d={`M0,${size} L0,2 L${size},2`} stroke={c} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d={`M0,${size * 0.55} L0,${size * 0.22} L${size * 0.55},${size * 0.22}`} stroke={c} strokeWidth="1" fill="none" opacity="0.6" />
      <rect x={size + 4} y={1} width={12} height={2} fill={c} opacity="0.7" />
      <rect x={1} y={size + 4} width={2} height={12} fill={c} opacity="0.7" />
    </svg>
  );
}

// ─── CertificateCard ──────────────────────────────────────────
export function CertificateCard({
  name = 'ชื่อ – นามสกุล',
  km = '400',
  large = false,
  sigDirector = '',
  sigChair = '',
  sigDirectorName = '',
  sigChairName = '',
}: {
  name?: string; km?: string; large?: boolean;
  sigDirector?: string; sigChair?: string;
  sigDirectorName?: string; sigChairName?: string;
}) {
  const p = large ? 1 : 0.6;

  return (
    <div style={{
      width: '100%',
      aspectRatio: '1 / 1.414',
      position: 'relative',
      borderRadius: 8 * p,
      overflow: 'hidden',
      background: '#0d0818',
      fontFamily: 'Sarabun, sans-serif',
      boxShadow: large
        ? '0 0 60px rgba(233,30,140,0.4), 0 0 120px rgba(233,30,140,0.15)'
        : '0 8px 32px rgba(233,30,140,0.3)',
    }}>

      {/* Centre purple glow */}
      <div style={{
        position: 'absolute', top: '15%', left: '5%', right: '5%', height: '50%',
        background: 'radial-gradient(ellipse, rgba(140,0,120,0.35) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* Pink border inner */}
      <div style={{
        position: 'absolute', inset: 6 * p,
        border: `${1.5 * p}px solid #e91e8c`,
        borderRadius: 6 * p, pointerEvents: 'none', zIndex: 2,
        boxShadow: 'inset 0 0 12px rgba(233,30,140,0.15)',
      }} />
      <div style={{
        position: 'absolute', inset: 10 * p,
        border: `${0.5 * p}px solid rgba(233,30,140,0.3)`,
        borderRadius: 4 * p, pointerEvents: 'none', zIndex: 2,
      }} />

      {/* Corner decorations */}
      {([
        { top: 0,    left: 0,    flip: [false, false] },
        { top: 0,    right: 0,   flip: [true,  false] },
        { bottom: 0, left: 0,    flip: [false, true]  },
        { bottom: 0, right: 0,   flip: [true,  true]  },
      ] as any[]).map((pos, i) => (
        <div key={i} style={{ position: 'absolute', ...pos, zIndex: 3 }}>
          <HUDCorner size={50 * p} flip={pos.flip} />
        </div>
      ))}

      {/* Main content */}
      <div style={{
        position: 'relative', zIndex: 4,
        height: '100%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center',
        padding: `${56 * p}px ${28 * p}px ${28 * p}px`,
        boxSizing: 'border-box', textAlign: 'center',
      }}>

        {/* Badge top */}
        <div style={{
          marginBottom: 10 * p,
          width: 70 * p, height: 70 * p,
          border: `${2 * p}px solid #e91e8c`,
          borderRadius: '50%',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 16px rgba(233,30,140,0.5)',
          background: 'rgba(233,30,140,0.08)',
          gap: 2,
        }}>
          <div style={{ fontSize: 18 * p }}>🏃</div>
          <div style={{ color: '#e91e8c', fontSize: 5 * p, fontWeight: 700, letterSpacing: 0.5, lineHeight: 1.2 }}>
            THE TEACHER'S<br />GAME
          </div>
        </div>

        {/* Title */}
        <div style={{ lineHeight: 1, marginBottom: 4 * p }}>
          <div style={{ color: '#fff', fontSize: 16 * p, fontStyle: 'italic', fontFamily: '"Bebas Neue",serif', letterSpacing: 4 }}>THE</div>
          <div style={{
            fontFamily: '"Bebas Neue",serif',
            fontSize: 42 * p,
            letterSpacing: 3,
            background: 'linear-gradient(180deg, #ff66cc 0%, #e91e8c 50%, #c2185b 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            lineHeight: 1,
          }}>TEACHER'S</div>
          <div style={{ color: '#e8e0ff', fontFamily: '"Bebas Neue",serif', fontSize: 34 * p, letterSpacing: 6, lineHeight: 1 }}>GAME</div>
        </div>

        {/* Tagline */}
        <div style={{ color: '#e91e8c', fontSize: 8 * p, letterSpacing: 2, marginBottom: 10 * p, fontWeight: 600 }}>
          {'>>> RUN TOGETHER, WIN TOGETHER <<<'}
        </div>

        {/* Thai title */}
        <div style={{
          color: '#ff3399', fontWeight: 700, fontSize: 16 * p,
          fontFamily: 'Sarabun, sans-serif', letterSpacing: 0.5,
          textShadow: '0 0 20px rgba(255,51,153,0.6)',
          marginBottom: 4 * p,
        }}>
          เกียรติบัตรแห่งความสำเร็จ
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 * p }}>
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,transparent,rgba(233,30,140,0.6))' }} />
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 6.5 * p, letterSpacing: 2 }}>CERTIFICATE OF ACHIEVEMENT</div>
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,rgba(233,30,140,0.6),transparent)' }} />
        </div>
        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 7.5 * p, marginBottom: 10 * p }}>
          ขอมอบเกียรติบัตรฉบับนี้ไว้เพื่อแสดงว่า
        </div>

        {/* Name box */}
        <div style={{
          width: '85%',
          border: `${1.5 * p}px solid #e91e8c`,
          borderRadius: 4 * p,
          padding: `${12 * p}px ${16 * p}px`,
          background: 'rgba(233,30,140,0.06)',
          boxShadow: '0 0 20px rgba(233,30,140,0.2)',
          marginBottom: 10 * p,
        }}>
          <div style={{
            color: '#fff', fontWeight: 700, fontSize: 14 * p,
            fontFamily: 'Sarabun, sans-serif',
          }}>{name}</div>
          <div style={{ color: '#e91e8c', fontSize: 8 * p, marginTop: 3 * p }}>
            วิ่ง {km} กิโลเมตร
          </div>
        </div>

        {/* Body */}
        <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 7 * p, marginBottom: 4 * p }}>ได้เข้าร่วมกิจกรรม</div>
        <div style={{ color: '#ff3399', fontStyle: 'italic', fontSize: 11 * p, fontWeight: 700, fontFamily: '"Bebas Neue",serif', letterSpacing: 2 }}>
          THE TEACHER'S GAME
        </div>
        <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 7.5 * p, marginBottom: 6 * p }}>RUN CHALLENGE</div>
        <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 6.5 * p, lineHeight: 1.7, marginBottom: 8 * p }}>
          และสามารถพิชิตเป้าหมายด้วยความมุ่งมั่น<br />
          ขอชื่นชมในความพยายามและความตั้งใจในการดูแลสุขภาพ<br />
          <span style={{ color: '#ffcc44' }}>คุณคือ "ครูต้นแบบ" ที่ไม่หยุดพัฒนา</span>
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '60%', marginBottom: 12 * p }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(233,30,140,0.4)' }} />
          <div style={{ color: '#e91e8c', fontSize: 8 * p }}>◆</div>
          <div style={{ flex: 1, height: 1, background: 'rgba(233,30,140,0.4)' }} />
        </div>

        {/* Signature */}
        {sigDirector
          ? <img src={sigDirector} alt="ลายเซ็น" style={{ height: 30 * p, maxWidth: 120 * p, objectFit: 'contain', marginBottom: 4 * p }} />
          : <div style={{ height: 30 * p }} />
        }
        <div style={{ width: 120 * p, height: 1, background: 'rgba(255,255,255,0.4)', marginBottom: 6 * p }} />
        {sigDirectorName && (
          <div style={{ color: '#ffcc44', fontWeight: 700, fontSize: 9 * p, marginBottom: 2 * p }}>{sigDirectorName}</div>
        )}
        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 7.5 * p }}>ผู้อำนวยการโรงเรียนอนุสรณ์ศุภมาศ</div>
      </div>
    </div>
  );
}
