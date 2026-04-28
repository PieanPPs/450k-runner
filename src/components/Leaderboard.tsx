import { useContext, useMemo, useState } from 'react';
import { ThemeCtx } from '@/themes/context';
import { useAppData } from '@/context/DataContext';
import { SectionHeader } from '@/components/UI';

export default function Leaderboard() {
  const { theme: t } = useContext(ThemeCtx);
  const { data } = useAppData();
  const { participants } = data;
  const [tab, setTab] = useState(0);

  const tabs = useMemo(() => [
    { label:'ระยะทาง (กม.)', key:'km' as const,            unit:'km',   fmt:(v:number)=>v.toFixed(1),           data:[...participants].sort((a,b)=>b.km-a.km) },
    { label:'จำนวนครั้ง',    key:'activityCount' as const,  unit:'ครั้ง', fmt:(v:number)=>String(v),              data:[...participants].sort((a,b)=>b.activityCount-a.activityCount) },
    { label:'สัปดาห์นี้',    key:'weeklyKm' as const,       unit:'km',   fmt:(v:number)=>v.toFixed(1),           data:[...participants].sort((a,b)=>b.weeklyKm-a.weeklyKm) },
    { label:'Streak (วัน)',  key:'streak' as const,          unit:'วัน',  fmt:(v:number)=>String(v),              data:[...participants].sort((a,b)=>b.streak-a.streak) },
  ], [participants]);

  const cur = tabs[tab];
  const max = cur.data.length > 0 ? Number(cur.data[0][cur.key]) : 1;
  const medals = ['🥇','🥈','🥉'];

  return (
    <section id="leaderboard" style={{ padding:'80px 24px' }}>
      <div style={{ maxWidth:800, margin:'0 auto' }}>
        <SectionHeader tag="อันดับ" title="Leaderboard" />
        <div style={{ display:'flex', gap:8, marginBottom:28, flexWrap:'wrap', justifyContent:'center' }}>
          {tabs.map((tb,i) => (
            <button key={i} onClick={()=>setTab(i)} style={{
              padding:'8px 18px', borderRadius:999, border:'none', cursor:'pointer',
              fontFamily:'Sarabun', fontSize:13, fontWeight:600, transition:'all 0.2s',
              background:tab===i?t.tabActive:t.tabBg, color:tab===i?'#fff':t.textMuted,
            }}>{tb.label}</button>
          ))}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {cur.data.map((p,i) => {
            const val = Number(p[cur.key]);
            return (
              <div key={p.id}
                style={{ display:'flex', alignItems:'center', gap:14, background:t.card, border:`1px solid ${i<3?t.accent1+'44':t.cardBorder}`, borderRadius:14, padding:'12px 16px', transition:'transform 0.15s', boxShadow:i===0?`0 4px 20px ${t.accent1}30`:'none' }}
                onMouseEnter={e=>e.currentTarget.style.transform='translateX(4px)'}
                onMouseLeave={e=>e.currentTarget.style.transform='translateX(0)'}>
                <div style={{ width:32, textAlign:'center', fontSize:i<3?20:14, fontWeight:700, color:i<3?t.text:t.textSub, fontFamily:'Bebas Neue' }}>
                  {i<3?medals[i]:i+1}
                </div>
                <div style={{ width:40, height:40, borderRadius:'50%', background:`linear-gradient(135deg,${t.accent1},${t.accent2})`, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:14, flexShrink:0 }}>
                  {p.initials}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ color:t.text, fontWeight:600, fontSize:14, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.name}</div>
                  <div style={{ background:t.progressBg, borderRadius:999, height:5, marginTop:6, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${max>0?(val/max)*100:0}%`, background:`linear-gradient(90deg,${t.accent1},${t.accent2})`, borderRadius:999 }} />
                  </div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontFamily:'Bebas Neue', fontSize:22, color:t.accent1, letterSpacing:1 }}>{cur.fmt(val)}</div>
                  <div style={{ color:t.textSub, fontSize:11 }}>{cur.unit}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
