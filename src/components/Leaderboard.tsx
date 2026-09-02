import { useContext, useMemo, useState } from 'react';
import { ThemeCtx } from '@/themes/context';
import { useAppData } from '@/context/DataContext';
import { SectionHeader } from '@/components/UI';
import { fmtKm } from '@/utils/fmt';

export default function Leaderboard() {
  const { theme: t } = useContext(ThemeCtx);
  const { data } = useAppData();
  const { participants, improvement } = data;
  const [tab, setTab] = useState(0);

  // hasImprovement: แสดง tab เมื่อมีคนที่ km Season 2 > 0 แล้ว (diff เป็นบวกอย่างน้อย 1 คน)
  const hasImprovement = improvement && improvement.some(p => p.diff > 0);

  const tabs = useMemo(() => [
    { label:'ระยะทาง (กม.)', key:'km' as const,            unit:'km',   fmt:(v:number)=>fmtKm(v),    data:[...participants].sort((a,b)=>b.km-a.km),            isSenior: false, isImprove: false },
    { label:'จำนวนครั้ง',    key:'activityCount' as const,  unit:'ครั้ง', fmt:(v:number)=>String(v),    data:[...participants].sort((a,b)=>b.activityCount-a.activityCount), isSenior: false, isImprove: false },
    { label:'สัปดาห์นี้',    key:'weeklyKm' as const,       unit:'km',   fmt:(v:number)=>fmtKm(v),    data:[...participants].sort((a,b)=>b.weeklyKm-a.weeklyKm), isSenior: false, isImprove: false },
    { label:'Streak (วัน)',  key:'streak' as const,          unit:'วัน',  fmt:(v:number)=>String(v),    data:[...participants].sort((a,b)=>b.streak-a.streak),     isSenior: false, isImprove: false },
    ...(hasImprovement ? [{ label:'📈 พัฒนาดีที่สุด', key:'km' as const, unit:'km', fmt:(v:number)=>fmtKm(v), data:[] as typeof participants, isSenior: false, isImprove: true }] : []),
  ], [participants, hasImprovement]);

  const cur = tabs[tab];
  const medals = ['🥇','🥈','🥉'];

  // Regular tab rendering
  const renderRegular = () => {
    const max = cur.data.length > 0 ? Number(cur.data[0][cur.key]) : 1;
    return cur.data.map((p, i) => {
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
    });
  };

  // Improvement tab rendering
  const renderImprovement = () => {
    const maxDiff = improvement.length > 0 ? improvement[0].diff : 1;
    return improvement.map((p, i) => {
      const isPositive = p.diff >= 0;
      const diffColor = isPositive ? t.accent2 : '#f87171';
      return (
        <div key={p.initials + i}
          style={{ display:'flex', alignItems:'center', gap:14, background:t.card, border:`1px solid ${i<3?t.accent2+'55':t.cardBorder}`, borderRadius:14, padding:'12px 16px', transition:'transform 0.15s', boxShadow:i===0?`0 4px 20px ${t.accent2}30`:'none' }}
          onMouseEnter={e=>e.currentTarget.style.transform='translateX(4px)'}
          onMouseLeave={e=>e.currentTarget.style.transform='translateX(0)'}>
          <div style={{ width:32, textAlign:'center', fontSize:i<3?20:14, fontWeight:700, color:i<3?t.text:t.textSub, fontFamily:'Bebas Neue' }}>
            {i<3?medals[i]:i+1}
          </div>
          <div style={{ width:40, height:40, borderRadius:'50%', background:`linear-gradient(135deg,${t.accent2},${t.accent1})`, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:14, flexShrink:0 }}>
            {p.initials}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ color:t.text, fontWeight:600, fontSize:14, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.name}</div>
            <div style={{ color:t.textSub, fontSize:11, marginTop:2 }}>{fmtKm(p.prevKm)} km → {fmtKm(p.currentKm)} km</div>
            <div style={{ background:t.progressBg, borderRadius:999, height:5, marginTop:4, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${maxDiff>0?(Math.max(0,p.diff)/maxDiff)*100:0}%`, background:`linear-gradient(90deg,${t.accent2},${t.accent1})`, borderRadius:999 }} />
            </div>
          </div>
          <div style={{ textAlign:'right', flexShrink:0 }}>
            <div style={{ fontFamily:'Bebas Neue', fontSize:22, color:diffColor, letterSpacing:1 }}>{isPositive?'+':''}{fmtKm(p.diff)}</div>
            <div style={{ color:t.textSub, fontSize:11 }}>km เพิ่ม</div>
          </div>
        </div>
      );
    });
  };

  return (
    <section id="leaderboard" style={{ padding:'80px 24px' }}>
      <div style={{ maxWidth:800, margin:'0 auto' }}>
        <SectionHeader tag="อันดับ" title="Leaderboard" />
        <div style={{ display:'flex', gap:8, marginBottom:28, flexWrap:'wrap', justifyContent:'center' }}>
          {tabs.map((tb, i) => (
            <button key={i} onClick={()=>setTab(i)} style={{
              padding:'8px 18px', borderRadius:999, border:'none', cursor:'pointer',
              fontFamily:'Sarabun', fontSize:13, fontWeight:600, transition:'all 0.2s',
              background: tab===i ? (tb.isSenior ? '#f59e0b' : tb.isImprove ? t.accent2 : t.tabActive) : t.tabBg,
              color: tab===i ? '#fff' : t.textMuted,
              boxShadow: tab===i && tb.isSenior ? '0 0 12px #f59e0b55' : tab===i && tb.isImprove ? `0 0 12px ${t.accent2}55` : 'none',
            }}>{tb.label}</button>
          ))}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {cur.isImprove ? renderImprovement() : renderRegular()}
        </div>
      </div>
    </section>
  );
}
