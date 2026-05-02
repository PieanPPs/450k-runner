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

          {/* Certificate preview */}
          <div style={{ flex: '1', minWidth: 300, maxWidth: 600 }}>
            <CertificateCard sigDirector={settings.sig_director||''} sigChair={settings.sig_chair||''} sigDirectorName={settings.sig_director_name||''} sigChairName={settings.sig_chair_name||''} />
            <p style={{ textAlign: 'center', color: t.textMuted, fontSize: 12, marginTop: 12 }}>
              ✦ ตัวอย่างเกียรติบัตร — ออกให้เมื่อวิ่งครบเป้าหมาย
            </p>
          </div>

          {/* Info side */}
          <div style={{ flex: '0 0 260px', display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Highlight box */}
            <div style={{
              background: `linear-gradient(135deg, ${t.accent1}18, ${t.accent2}12)`,
              border: `1px solid ${t.accent1}40`,
              borderRadius: 16, padding: 24,
            }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🏅</div>
              <div style={{ color: t.text, fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
                เกียรติบัตรดิจิทัล
              </div>
              <div style={{ color: t.textMuted, fontSize: 13, lineHeight: 1.7 }}>
                ออกให้โดยผู้อำนวยการโรงเรียน สำหรับผู้เข้าร่วมโครงการ
              </div>
            </div>

            {/* Conditions */}
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

            {/* Expand button */}
            <button
              onClick={() => setExpanded(true)}
              style={{
                width: '100%',
                background: `linear-gradient(135deg,${t.accent1},${t.accent2})`,
                border: 'none', borderRadius: 12, padding: '12px',
                color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Sarabun',
              }}
            >
              🔎 ดูตัวอย่างเต็มจอ
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen modal */}
      {expanded && (
        <div
          onClick={() => setExpanded(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: 24,
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: 680, width: '100%' }}>
            <CertificateCard large sigDirector={settings.sig_director||''} sigChair={settings.sig_chair||''} sigDirectorName={settings.sig_director_name||''} sigChairName={settings.sig_chair_name||''} />
            <button
              onClick={() => setExpanded(false)}
              style={{
                display: 'block', margin: '20px auto 0',
                background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 8, padding: '8px 32px', color: '#fff', cursor: 'pointer',
                fontSize: 13, fontFamily: 'Sarabun',
              }}
            >✕ ปิด</button>
          </div>
        </div>
      )}
    </section>
  );
}

export function CertificateCard({ name = 'ชื่อ – นามสกุล', km = '400', large = false, sigDirector = '', sigChair = '', sigDirectorName = '', sigChairName = '' }: { name?: string; km?: string; large?: boolean; sigDirector?: string; sigChair?: string; sigDirectorName?: string; sigChairName?: string }) {
  const p = large ? 1 : 0.78;

  return (
    <div style={{
      width: '100%',
      aspectRatio: '1.414 / 1',
      position: 'relative',
      borderRadius: 12,
      overflow: 'hidden',
      background: 'linear-gradient(160deg, #fefaf0 0%, #fdf3d8 60%, #fef7e8 100%)',
      boxShadow: large
        ? '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(201,168,76,0.3)'
        : '0 12px 40px rgba(0,0,0,0.25), 0 0 0 1px rgba(201,168,76,0.2)',
      fontFamily: 'serif',
    }}>

      {/* Outer gold border */}
      <div style={{
        position: 'absolute', inset: 10,
        border: '1.5px solid #c9a84c',
        borderRadius: 6,
        pointerEvents: 'none',
        zIndex: 2,
      }} />
      <div style={{
        position: 'absolute', inset: 13,
        border: '0.5px solid #e8cc80',
        borderRadius: 4,
        pointerEvents: 'none',
        zIndex: 2,
      }} />

      {/* Corner ornaments */}
      {[
        { top: 6, left: 6 },
        { top: 6, right: 6 },
        { bottom: 6, left: 6 },
        { bottom: 6, right: 6 },
      ].map((pos, i) => (
        <div key={i} style={{
          position: 'absolute', ...pos,
          width: 28 * p, height: 28 * p,
          zIndex: 3,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'%3E%3Cpath d='M2 2 L12 2 M2 2 L2 12' stroke='%23c9a84c' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3Ccircle cx='2' cy='2' r='1.5' fill='%23c9a84c'/%3E%3C/svg%3E")`,
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          transform: i === 1 ? 'scaleX(-1)' : i === 2 ? 'scaleY(-1)' : i === 3 ? 'scale(-1,-1)' : 'none',
        }} />
      ))}

      {/* Decorative background watermark */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none', zIndex: 1,
      }}>
        <div style={{
          fontFamily: 'Bebas Neue, serif', fontSize: 120 * p,
          color: 'rgba(201,168,76,0.045)', letterSpacing: 8,
          transform: 'rotate(-20deg)', userSelect: 'none',
          whiteSpace: 'nowrap',
        }}>400K</div>
      </div>

      {/* Main content */}
      <div style={{
        position: 'relative', zIndex: 4,
        height: '100%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: `${20 * p}px ${36 * p}px`,
        boxSizing: 'border-box',
        textAlign: 'center',
        gap: 0,
      }}>

        {/* School name */}
        <div style={{
          fontSize: 10 * p, color: '#8a6530',
          letterSpacing: 3, textTransform: 'uppercase',
          marginBottom: 6 * p,
        }}>
          โรงเรียนอนุสรณ์ศุภมาศ · จังหวัดสมุทรสาคร
        </div>

        {/* Divider top */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '70%', marginBottom: 10 * p }}>
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,transparent,#c9a84c)' }} />
          <span style={{ color: '#c9a84c', fontSize: 14 * p }}>✦</span>
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,#c9a84c,transparent)' }} />
        </div>

        {/* Main title */}
        <div style={{
          fontFamily: 'Bebas Neue, serif',
          fontSize: 28 * p, color: '#1a1200',
          letterSpacing: 6, marginBottom: 6 * p,
        }}>
          เกียรติบัตร
        </div>

        <div style={{ fontSize: 9 * p, color: '#7a5c20', letterSpacing: 2, marginBottom: 10 * p }}>
          ขอมอบเกียรติบัตรฉบับนี้เพื่อรับรองว่า
        </div>

        {/* Name placeholder */}
        <div style={{
          fontFamily: 'Sarabun, serif', fontSize: 20 * p, fontWeight: 700,
          color: '#1a1200', letterSpacing: 1,
          borderBottom: '2px solid #c9a84c',
          paddingBottom: 4, minWidth: 180 * p,
          marginBottom: 10 * p,
        }}>
          {name}
        </div>

        <div style={{ fontSize: 9 * p, color: '#5a4010', lineHeight: 2, fontFamily: 'Sarabun', marginBottom: 4 * p }}>
          ได้ปฏิบัติตนเป็นแบบอย่างที่ดีในการดูแลสุขภาพ
          <br />โดยวิ่งออกกำลังกายได้ระยะทางทั้งสิ้น
        </div>

        {/* KM highlight */}
        <div style={{ marginBottom: 8 * p }}>
          <span style={{
            fontFamily: 'Bebas Neue, serif', fontSize: 42 * p,
            color: '#b8860b', letterSpacing: 4,
            textShadow: '0 2px 8px rgba(184,134,11,0.25)',
          }}>{km}</span>
          <span style={{ fontFamily: 'Sarabun', fontSize: 13 * p, color: '#8a6530', marginLeft: 6 }}>
            กิโลเมตร
          </span>
        </div>

        <div style={{ fontSize: 9 * p, color: '#5a4010', fontFamily: 'Sarabun', lineHeight: 1.8, marginBottom: 10 * p }}>
          ในโครงการ{' '}
          <strong style={{ color: '#1a1200' }}>400K Teacher's Spirit</strong>
          <br />ระหว่างวันที่ 1 มิถุนายน — 31 สิงหาคม 2569
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '80%', marginBottom: 10 * p }}>
          <div style={{ flex: 1, height: 0.5, background: 'linear-gradient(90deg,transparent,#c9a84c60)' }} />
          <span style={{ color: '#c9a84c80', fontSize: 10 * p }}>🏃 ก้าวนี้เพื่อเด็ก ก้าวนี้เพื่อเรา 🏃</span>
          <div style={{ flex: 1, height: 0.5, background: 'linear-gradient(90deg,#c9a84c60,transparent)' }} />
        </div>

        {/* Signature */}
        <div style={{ display: 'flex', justifyContent: 'space-around', width: '80%' }}>
          {[
            { role: 'ผู้อำนวยการโรงเรียน', img: sigDirector, sigName: sigDirectorName },
            { role: 'ประธานโครงการ',        img: sigChair,    sigName: sigChairName },
          ].map(({ role, img, sigName }) => (
            <div key={role} style={{ textAlign: 'center', minWidth: 110 * p }}>
              {img
                ? <img src={img} alt={role} style={{ height: 36 * p, maxWidth: 120 * p, objectFit: 'contain', display: 'block', margin: '0 auto' }} />
                : <div style={{ height: 36 * p }} />
              }
              <div style={{ borderTop: '1px solid #c9a84c', width: 110 * p, margin: '4px auto 3px' }} />
              {sigName && <div style={{ color: '#4a3010', fontSize: 7.5 * p, fontFamily: 'Sarabun', marginBottom: 2 }}>{sigName}</div>}
              <div style={{ color: '#8a6530', fontSize: 7 * p, fontFamily: 'Sarabun' }}>{role}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Gold seal */}
      <div style={{
        position: 'absolute', bottom: 18 * p, right: 20 * p, zIndex: 5,
        width: 48 * p, height: 48 * p, borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 35%, rgba(255,220,100,0.25), rgba(201,168,76,0.1))',
        border: `1.5px solid #c9a84c66`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.4)',
      }}>
        <span style={{ fontSize: 20 * p }}>🏫</span>
      </div>
    </div>
  );
}
