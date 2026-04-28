import { useContext, useState } from 'react';
import { ThemeCtx } from '@/themes/context';
import { SectionHeader } from '@/components/UI';

export default function Certificate() {
  const { theme: t } = useContext(ThemeCtx);
  const [name, setName] = useState('ชื่อ-นามสกุล');
  const [km, setKm] = useState('450');
  const [preview, setPreview] = useState(false);

  return (
    <section id="certificate" style={{ padding:'80px 24px', background:t.altBg }}>
      <div style={{ maxWidth:960, margin:'0 auto' }}>
        <SectionHeader tag="เกียรติบัตร" title="รางวัลแห่งความภาคภูมิใจ" />
        <p style={{ textAlign:'center', color:t.textMuted, fontSize:14, marginBottom:40, marginTop:-16 }}>
          ผู้ที่วิ่งครบเป้าหมายจะได้รับเกียรติบัตรดิจิทัล เป็นที่ระลึกถาวร
        </p>

        {/* Preview card */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:32, justifyContent:'center', alignItems:'flex-start' }}>

          {/* Certificate visual */}
          <div style={{ flex:'1', minWidth:300, maxWidth:560 }}>
            <CertificateCard name={name} km={km} />
          </div>

          {/* Side controls */}
          <div style={{ flex:'0 0 260px', display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ background:t.card, border:`1px solid ${t.cardBorder}`, borderRadius:16, padding:20 }}>
              <div style={{ color:t.accent1, fontSize:13, fontWeight:700, marginBottom:14 }}>🔍 ทดลองพิมพ์ชื่อของคุณ</div>
              <div style={{ marginBottom:12 }}>
                <label style={{ color:t.textSub, fontSize:11, display:'block', marginBottom:4 }}>ชื่อ-นามสกุล</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={{ width:'100%', background:t.altBg, border:`1px solid ${t.cardBorder}`, borderRadius:8, padding:'8px 12px', color:t.text, fontSize:13, boxSizing:'border-box' }}
                />
              </div>
              <div style={{ marginBottom:16 }}>
                <label style={{ color:t.textSub, fontSize:11, display:'block', marginBottom:4 }}>ระยะทางที่วิ่ง (km)</label>
                <input
                  value={km}
                  onChange={e => setKm(e.target.value)}
                  style={{ width:'100%', background:t.altBg, border:`1px solid ${t.cardBorder}`, borderRadius:8, padding:'8px 12px', color:t.text, fontSize:13, boxSizing:'border-box' }}
                />
              </div>
              <button
                onClick={() => setPreview(true)}
                style={{ width:'100%', background:`linear-gradient(135deg,${t.accent1},${t.accent2})`, border:'none', borderRadius:10, padding:'10px', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'Sarabun' }}
              >
                🔎 ดูตัวอย่างเต็มจอ
              </button>
            </div>

            <div style={{ background:t.card, border:`1px solid ${t.cardBorder}`, borderRadius:16, padding:20 }}>
              <div style={{ color:t.accent2, fontSize:13, fontWeight:700, marginBottom:10 }}>📋 เงื่อนไขการรับเกียรติบัตร</div>
              {[
                'วิ่งครบ 450 กม. ภายในโครงการ',
                'บันทึกกิจกรรมผ่าน Strava',
                'เป็นสมาชิก Club โรงเรียน',
                'รับเกียรติบัตรดิจิทัลได้ทันที',
              ].map((item, i) => (
                <div key={i} style={{ display:'flex', gap:8, marginBottom:8, alignItems:'flex-start' }}>
                  <span style={{ color:t.accent3, fontSize:12, marginTop:1 }}>✓</span>
                  <span style={{ color:t.textMuted, fontSize:12, lineHeight:1.5 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen modal */}
      {preview && (
        <div
          onClick={() => setPreview(false)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.9)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:24 }}
        >
          <div onClick={e => e.stopPropagation()} style={{ maxWidth:700, width:'100%' }}>
            <CertificateCard name={name} km={km} large />
            <button
              onClick={() => setPreview(false)}
              style={{ display:'block', margin:'16px auto 0', background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, padding:'8px 24px', color:'#fff', cursor:'pointer', fontSize:13, fontFamily:'Sarabun' }}
            >
              ✕ ปิด
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function CertificateCard({ name, km, large = false }: { name: string; km: string; large?: boolean }) {
  const scale = large ? 1 : 0.85;
  return (
    <div style={{
      width:'100%',
      background:'linear-gradient(160deg, #fffdf5 0%, #fdf6e3 50%, #fef9ee 100%)',
      borderRadius:16,
      padding: large ? '40px 48px' : '28px 32px',
      boxShadow:'0 20px 60px rgba(0,0,0,0.4), inset 0 0 0 8px rgba(180,140,50,0.15), inset 0 0 0 10px rgba(180,140,50,0.08)',
      position:'relative',
      overflow:'hidden',
      fontFamily:'serif',
      transform: `scale(${scale})`,
      transformOrigin: 'top center',
    }}>
      {/* Corner ornaments */}
      {['top-left','top-right','bottom-left','bottom-right'].map(pos => (
        <div key={pos} style={{
          position:'absolute',
          [pos.includes('top') ? 'top' : 'bottom']: 10,
          [pos.includes('left') ? 'left' : 'right']: 10,
          width: 40, height: 40,
          borderTop: pos.includes('top') ? '3px solid #c9a84c' : 'none',
          borderBottom: pos.includes('bottom') ? '3px solid #c9a84c' : 'none',
          borderLeft: pos.includes('left') ? '3px solid #c9a84c' : 'none',
          borderRight: pos.includes('right') ? '3px solid #c9a84c' : 'none',
          borderRadius: pos === 'top-left' ? '4px 0 0 0' : pos === 'top-right' ? '0 4px 0 0' : pos === 'bottom-left' ? '0 0 0 4px' : '0 0 4px 0',
        }} />
      ))}

      {/* Watermark */}
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
        <div style={{ fontFamily:'Bebas Neue, serif', fontSize:80, color:'rgba(180,140,50,0.05)', letterSpacing:8, transform:'rotate(-30deg)', userSelect:'none' }}>450K</div>
      </div>

      {/* Header */}
      <div style={{ textAlign:'center', marginBottom: large ? 24 : 16 }}>
        <div style={{ fontSize: large ? 13 : 11, color:'#8a6d2a', letterSpacing:3, marginBottom:8, textTransform:'uppercase' }}>
          โรงเรียนอนุสรณ์ศุภมาศ จ.สมุทรสาคร
        </div>
        <div style={{ fontSize: large ? 11 : 9, color:'#a08040', letterSpacing:2, marginBottom: large ? 16 : 10 }}>
          ขอมอบเกียรติบัตรฉบับนี้ให้แก่
        </div>

        {/* Decorative line */}
        <div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'center', marginBottom: large ? 16 : 12 }}>
          <div style={{ flex:1, height:1, background:'linear-gradient(90deg,transparent,#c9a84c)' }} />
          <span style={{ color:'#c9a84c', fontSize:16 }}>✦</span>
          <div style={{ flex:1, height:1, background:'linear-gradient(90deg,#c9a84c,transparent)' }} />
        </div>
      </div>

      {/* Name */}
      <div style={{ textAlign:'center', marginBottom: large ? 20 : 14 }}>
        <div style={{
          fontFamily:'Sarabun, serif',
          fontSize: large ? 32 : 24,
          fontWeight:700,
          color:'#1a1400',
          letterSpacing:1,
          borderBottom:'2px solid #c9a84c',
          display:'inline-block',
          paddingBottom:4,
          minWidth: 200,
        }}>
          {name || 'ชื่อ-นามสกุล'}
        </div>
      </div>

      {/* Body */}
      <div style={{ textAlign:'center', marginBottom: large ? 20 : 14 }}>
        <div style={{ fontSize: large ? 12 : 10, color:'#5a4a1a', lineHeight:2, fontFamily:'Sarabun' }}>
          ได้ปฏิบัติตนเป็นแบบอย่างที่ดีในการดูแลสุขภาพ
          <br />
          โดยวิ่งออกกำลังกายได้ระยะทางทั้งสิ้น
        </div>
        <div style={{ margin: large ? '12px 0' : '8px 0' }}>
          <span style={{ fontFamily:'Bebas Neue, serif', fontSize: large ? 48 : 36, color:'#b8860b', letterSpacing:4 }}>{km}</span>
          <span style={{ fontFamily:'Sarabun', fontSize: large ? 16 : 13, color:'#8a6d2a', marginLeft:6 }}>กิโลเมตร</span>
        </div>
        <div style={{ fontSize: large ? 12 : 10, color:'#5a4a1a', fontFamily:'Sarabun', lineHeight:2 }}>
          ในโครงการ <strong style={{ color:'#1a1400' }}>450K Teacher's Spirit</strong>
          <br />
          ระหว่างวันที่ 1 มิถุนายน — 30 กันยายน 2569
        </div>
      </div>

      {/* Decorative divider */}
      <div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'center', margin: large ? '16px 0' : '10px 0' }}>
        <div style={{ flex:1, height:1, background:'linear-gradient(90deg,transparent,#c9a84c80)' }} />
        <span style={{ color:'#c9a84c', fontSize:12 }}>🏃 ก้าวนี้เพื่อเด็ก ก้าวนี้เพื่อเรา 🏃</span>
        <div style={{ flex:1, height:1, background:'linear-gradient(90deg,#c9a84c80,transparent)' }} />
      </div>

      {/* Signature area */}
      <div style={{ display:'flex', justifyContent:'space-around', marginTop: large ? 20 : 12 }}>
        {['ผู้อำนวยการโรงเรียน', 'ประธานโครงการ'].map(role => (
          <div key={role} style={{ textAlign:'center' }}>
            <div style={{ borderBottom:'1px solid #c9a84c', width:120, margin:'0 auto 4px' }} />
            <div style={{ color:'#8a6d2a', fontSize: large ? 10 : 8, fontFamily:'Sarabun' }}>{role}</div>
          </div>
        ))}
      </div>

      {/* Seal decoration */}
      <div style={{ position:'absolute', bottom: large ? 32 : 20, right: large ? 40 : 24, width: large ? 60 : 48, height: large ? 60 : 48, borderRadius:'50%', border:'2px solid #c9a84c88', display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(201,168,76,0.08)' }}>
        <div style={{ fontSize: large ? 24 : 18 }}>🏫</div>
      </div>
    </div>
  );
}
