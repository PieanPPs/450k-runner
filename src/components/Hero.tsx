import { useContext } from 'react';
import { ThemeCtx, useCountdown } from '@/themes/context';
import { useAppData } from '@/context/DataContext';
import { fmtKm } from '@/utils/fmt';
import { Reveal, CountUp, stagger } from '@/motion/Motion';

export default function Hero() {
  const { theme: t } = useContext(ThemeCtx);
  const { data, loading } = useAppData();
  const ready = !loading;
  const { participants, totalKm, goalKm, pct, settings } = data;
  const seasonStart  = settings.season_start || '2026-06-01';
  const seasonEnd    = settings.season_end   || '2026-08-31';
  const projectName  = settings.project_name || '450K TEACHER\'S SPIRIT';
  const subtitle     = settings.project_subtitle || 'ก้าวนี้เพื่อเด็ก ก้าวนี้เพื่อเรา';
  const goalPerPerson = settings.goal_km_per_person || '450';

  const now       = new Date();
  const startDate = new Date(seasonStart);
  const endDate   = new Date(seasonEnd);
  endDate.setHours(23, 59, 59); // นับถึงสิ้นวัน

  const seasonStatus = now < startDate ? 'pre' : now <= endDate ? 'active' : 'done';
  // countdown ไปยัง target ตาม phase
  const countdownTarget = seasonStatus === 'pre'
    ? `${seasonStart}T00:00:00`
    : `${seasonEnd}T23:59:59`;
  const cd = useCountdown(countdownTarget);

  return (
    <section style={{
      minHeight:'100vh', background:t.heroGrad,
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      position:'relative', overflow:'hidden', padding:'80px 24px 48px',
    }}>
      <div style={{ position:'absolute', top:'10%', left:'5%', width:400, height:400, borderRadius:'50%', background:`radial-gradient(circle,${t.accent1}22 0%,transparent 70%)`, pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:'15%', right:'5%', width:320, height:320, borderRadius:'50%', background:`radial-gradient(circle,${t.accent2}22 0%,transparent 70%)`, pointerEvents:'none' }} />

      {/* โลโก้: pop-scale ตอนเข้า + glow-pulse ต่อเนื่อง */}
      <Reveal variant="group" style={{ marginBottom:24 }}>
        <div className="m-pop">
          <img src="/logo.png" alt="AS-Run Logo" className="m-glow"
            style={{ width:160, height:160, borderRadius:'50%', objectFit:'cover', border:`3px solid ${t.accent1}`, boxShadow:`0 0 40px ${t.accent1}66`, display:'block', ['--m-glow' as string]:`${t.accent1}77` }} />
        </div>
      </Reveal>

      <div style={{ textAlign:'center', maxWidth:720 }}>
        <Reveal variant="soft-rise" delay={150} style={{ fontFamily:'Bebas Neue', fontSize:'clamp(42px,7vw,96px)', letterSpacing:4, lineHeight:1, marginBottom:8 }}>
          <span style={{ color:'#FFFFFF', textShadow:'0 2px 24px rgba(0,0,0,0.25)' }}>{projectName}</span>
        </Reveal>
        <Reveal variant="fade-slide" delay={450} style={{ color:t.heroText, fontSize:'clamp(16px,2.5vw,22px)', fontWeight:600, marginBottom:4 }}>{subtitle}</Reveal>
        <Reveal variant="fade-slide" delay={600} style={{ color:t.heroTextMuted, fontSize:15, marginBottom:32 }}>Healthy Teacher, Happy School · {goalPerPerson} กิโลเมตร · โรงเรียนอนุสรณ์ศุภมาศ</Reveal>

        <Reveal variant="group" style={{ marginBottom:36 }}>
          <div className="m-item" style={stagger(10, { color:t.heroTextSub, fontSize:12, fontWeight:600, letterSpacing:3, marginBottom:12 })}>
            {seasonStatus === 'pre'  && `เริ่มกิจกรรม ${startDate.toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'})}`}
            {seasonStatus === 'active' && `🏃 กำลังดำเนินอยู่ · สิ้นสุด ${endDate.toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'})}`}
            {seasonStatus === 'done' && '🏁 สิ้นสุดโครงการแล้ว'}
          </div>
          {seasonStatus !== 'done' && (
          <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
            {[{v:cd.d,l:'วัน'},{v:cd.h,l:'ชั่วโมง'},{v:cd.m,l:'นาที'},{v:cd.s,l:'วินาที'}].map(({v,l},i)=>(
              <div key={l} className="m-item" style={stagger(11 + i, { background:t.card, border:`1px solid ${t.cardBorder}`, borderRadius:12, padding:'12px 16px', minWidth:68, textAlign:'center', backdropFilter:'blur(8px)', overflow:'hidden' })}>
                {/* スナップイン — ตัวเลขใหม่เลื่อนเข้าทุกครั้งที่เปลี่ยน */}
                <div className="m-num" style={{ fontFamily:'Bebas Neue', fontSize:40, color: seasonStatus==='active' ? t.accent2 : t.accent1, lineHeight:1 }}>
                  <span key={v} className="m-tick">{String(v ?? 0).padStart(2,'0')}</span>
                </div>
                <div style={{ color:t.heroTextSub, fontSize:10, fontWeight:600, letterSpacing:1 }}>{l}</div>
              </div>
            ))}
          </div>
          )}
        </Reveal>

        <Reveal delay={900} style={{ background:t.card, border:`1px solid ${t.cardBorder}`, borderRadius:20, padding:28, backdropFilter:'blur(12px)', maxWidth:500, margin:'0 auto' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
            <span style={{ color:t.text, fontWeight:700, fontSize:16 }}>ความคืบหน้ารวม</span>
            <span style={{ color:t.accent1, fontWeight:800, fontSize:16, fontFamily:'Bebas Neue', letterSpacing:1 }}>
              <CountUp value={totalKm} format={fmtKm} ready={ready} duration={1400} /> / {goalKm} KM
            </span>
          </div>
          <div style={{ background:t.progressBg, borderRadius:999, height:12, overflow:'hidden', marginBottom:8 }}>
            <div className="m-fill m-light-sweep" style={{ height:'100%', width:`${pct}%`, background:`linear-gradient(90deg,${t.accent1},${t.accent2})`, borderRadius:999, transition:'width 1.5s cubic-bezier(.33,1,.68,1)', boxShadow:`0 0 12px ${t.accent2}80`, ['--i' as string]: 18 }} />
          </div>
          <div style={{ display:'flex', justifyContent:'space-between' }}>
            <span style={{ color:t.textSub, fontSize:12 }}><CountUp value={participants.length} ready={ready} /> คน</span>
            <span style={{ color:t.accent2, fontWeight:700, fontSize:14 }}><CountUp value={pct} format={n => n.toFixed(1)} ready={ready} duration={1400} />%</span>
          </div>
        </Reveal>
      </div>

      <div style={{ position:'absolute', bottom:24, left:'50%', transform:'translateX(-50%)', display:'flex', flexDirection:'column', alignItems:'center', gap:6, opacity:0.5 }}>
        <div style={{ color:t.heroTextSub, fontSize:11, letterSpacing:2 }}>SCROLL</div>
        <div style={{ width:1, height:30, background:`linear-gradient(${t.accent1},transparent)` }} />
      </div>
    </section>
  );
}
