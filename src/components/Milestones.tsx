import { useContext } from 'react';
import { ThemeCtx } from '@/themes/context';
import { useAppData } from '@/context/DataContext';
import { SectionHeader } from '@/components/UI';
import { Reveal, CountUp, stagger } from '@/motion/Motion';

export default function Milestones() {
  const { theme: t } = useContext(ThemeCtx);
  const { data } = useAppData();
  const { milestones, participants } = data;
  const maxKm = participants.length > 0 ? Math.max(...participants.map(p=>p.km)) : 0;

  return (
    <section id="milestones" style={{ padding:'80px 24px', background:t.altBg }}>
      <div style={{ maxWidth:900, margin:'0 auto' }}>
        <SectionHeader tag="รางวัล" title="Milestone Rewards" />
        {/* グリッドウェーブ — การ์ดเข้าทีละใบเป็นคลื่น; ใบที่ปลดล็อกแล้วมีแสงวิ่งผ่าน 1 ครั้ง */}
        <Reveal variant="group" grid style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:20 }}>
          {milestones.map((m,i)=>{
            const reached = m.km===0 ? true : maxKm>=m.km;
            return (
              <div key={i} className={`m-item m-lift${reached ? ' m-sweep-once' : ''}`}
                style={stagger(i, { background:t.card, border:`2px solid ${reached?m.color+'80':t.cardBorder}`, borderRadius:20, padding:24, position:'relative', overflow:'hidden' })}
                onMouseEnter={e=>e.currentTarget.style.transform='translateY(-6px)'}
                onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>
                {reached && <div className="m-pop" style={{ position:'absolute', top:12, right:12, background:m.color, color:'#fff', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:999, ['--i' as string]: i + 4 }}>ปลดล็อก</div>}
                <div style={{ fontSize:40, marginBottom:12 }}>{m.icon}</div>
                {m.km>0 && <div style={{ fontFamily:'Bebas Neue', fontSize:36, color:m.color, letterSpacing:2, lineHeight:1 }}><CountUp value={m.km} duration={1000} /><span style={{ fontSize:18 }}> KM</span></div>}
                <div style={{ color:t.text, fontWeight:600, fontSize:13, marginBottom:8, lineHeight:1.5 }}>{m.reward}</div>
                {m.km>0 && <div style={{ color:t.textMuted, fontSize:12 }}>{m.achievers>0 ? m.achievers+' คนปลดล็อกแล้ว' : 'ยังไม่มีผู้ปลดล็อก'}</div>}
                {m.km===0 && <div style={{ color:t.textMuted, fontSize:12 }}>{m.achievers} คนได้รับหลังจบกิจกรรม</div>}
              </div>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}
