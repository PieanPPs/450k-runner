import { useContext } from 'react';
import { ThemeCtx } from '@/themes/context';
import { useAppData } from '@/context/DataContext';
import { SectionHeader } from '@/components/UI';

export default function Seasons() {
  const { theme: t } = useContext(ThemeCtx);
  const { data } = useAppData();
  const { seasons } = data;
  const statusMeta = {
    done    : { label:'เสร็จสิ้น',    color:t.accent3 },
    active  : { label:'กำลังดำเนิน', color:t.accent1 },
    upcoming: { label:'เร็วๆ นี้',    color:t.textSub },
  } as const;

  return (
    <section id="seasons" style={{ padding:'80px 24px' }}>
      <div style={{ maxWidth:900, margin:'0 auto' }}>
        <SectionHeader tag="Season" title="สรุปผลแต่ละ Season" />
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:20 }}>
          {seasons.map((s,i)=>{
            const sm = statusMeta[s.status];
            return (
              <div key={i} style={{ background:t.card, border:`1px solid ${s.status==='active'?t.accent1+'60':t.cardBorder}`, borderRadius:20, padding:28, position:'relative', overflow:'hidden' }}>
                {s.status==='active' && <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:`linear-gradient(90deg,${t.accent1},${t.accent2})` }} />}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
                  <div>
                    <div style={{ fontFamily:'Bebas Neue', fontSize:28, color:t.text, letterSpacing:2 }}>{s.name}</div>
                    <div style={{ color:t.textMuted, fontSize:13 }}>{s.subtitle}</div>
                    <div style={{ color:t.textSub, fontSize:12 }}>{s.dateRange}</div>
                  </div>
                  <div style={{ background:sm.color+'22', border:`1px solid ${sm.color}60`, borderRadius:999, padding:'4px 12px', color:sm.color, fontSize:12, fontWeight:700 }}>{sm.label}</div>
                </div>
                {s.status!=='upcoming' ? (
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    {[
                      {label:'ระยะทางรวม', v:s.totalKm+' km', c:t.accent1},
                      {label:'นำโดย',       v:s.winner,         c:t.accent2},
                      {label:'Best (คน)',   v:s.topKm+' km',    c:t.accent3},
                      {label:'ผู้เข้าร่วม', v:s.participants+' คน', c:t.textMuted},
                    ].map((item,j)=>(
                      <div key={j} style={{ background:t.altBg, borderRadius:10, padding:'10px 12px' }}>
                        <div style={{ color:t.textSub, fontSize:10, fontWeight:600, marginBottom:4 }}>{item.label}</div>
                        <div style={{ color:item.c, fontWeight:700, fontSize:13 }}>{item.v}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color:t.textSub, fontSize:14, textAlign:'center', padding:'20px 0' }}>เตรียมเปิด Season นี้เร็วๆ นี้! 🔥</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
