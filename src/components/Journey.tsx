import { useContext } from 'react';
import { ThemeCtx } from '@/themes/context';
import { useAppData } from '@/context/DataContext';
import { SectionHeader } from '@/components/UI';

// หาว่า km ถึงจุดไหนแล้ว
function getCurrentLocation(km: number, distances: { km: number; label: string; icon: string }[]) {
  const sorted = [...distances].sort((a, b) => b.km - a.km);
  for (const d of sorted) {
    if (km >= d.km) return { label: d.label, icon: d.icon };
  }
  return { label: 'สมุทรสาคร', icon: '🏫' };
}

export default function Journey() {
  const { theme: t } = useContext(ThemeCtx);
  const { data } = useAppData();
  const { distances, participants, totalKm, goalKm } = data;
  const perPersonGoal = 450;

  return (
    <section id="journey" style={{ padding:'80px 24px' }}>
      <div style={{ maxWidth:960, margin:'0 auto' }}>
        <SectionHeader tag="การเดินทาง" title="ทีมเราวิ่งไปถึงไหนแล้ว?" />
        <div style={{ color:t.textMuted, fontSize:14, marginBottom:32, textAlign:'center' }}>
          จุดเริ่มต้น: โรงเรียนอนุสรณ์ศุภมาศ จ.สมุทรสาคร
        </div>

        {/* Team overall progress bar */}
        <div style={{ background:t.card, border:`1px solid ${t.cardBorder}`, borderRadius:24, padding:28, marginBottom:32, position:'relative', overflow:'hidden' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10, flexWrap:'wrap', gap:8 }}>
            <span style={{ color:t.text, fontWeight:700 }}>📍 สมุทรสาคร</span>
            <span style={{ color:t.accent1, fontWeight:700, fontFamily:'Bebas Neue', fontSize:20 }}>
              {totalKm.toFixed(1)} / {goalKm.toFixed(0)} KM (ทีมรวม)
            </span>
            <span style={{ color:t.textMuted }}>🏁 ชุมพร ({goalKm.toFixed(0)} km)</span>
          </div>
          <div style={{ position:'relative', background:t.progressBg, height:20, borderRadius:999, overflow:'hidden', marginBottom:20 }}>
            <div style={{ position:'absolute', inset:0, width:`${Math.min(100,(totalKm/Math.max(goalKm,1))*100)}%`, background:`linear-gradient(90deg,${t.accent1},${t.accent2},${t.accent3})`, borderRadius:999, transition:'width 1.5s ease' }} />
            {distances.map((d,i) => (
              <div key={i} style={{ position:'absolute', left:`${(d.km/perPersonGoal)*100}%`, top:'50%', transform:'translate(-50%,-50%)', width:12, height:12, borderRadius:'50%', background:totalKm/Math.max(participants.length,1)>=d.km?'#fff':'rgba(255,255,255,0.3)', border:`2px solid ${totalKm/Math.max(participants.length,1)>=d.km?t.accent1:'rgba(255,255,255,0.2)'}`, zIndex:1 }} />
            ))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))', gap:10 }}>
            {distances.map((d,i) => {
              const avgKm = totalKm / Math.max(participants.length, 1);
              const reached = avgKm >= d.km;
              return (
                <a key={i} href={d.gmapUrl} target="_blank" rel="noreferrer" style={{ textDecoration:'none' }}>
                  <div style={{ background:reached?`${t.accent1}18`:t.progressBg, border:`1px solid ${reached?t.accent1+'60':t.cardBorder}`, borderRadius:12, padding:'10px 6px', textAlign:'center', transition:'transform 0.2s', cursor:'pointer' }}
                    onMouseEnter={e=>e.currentTarget.style.transform='scale(1.05)'}
                    onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
                    <div style={{ fontSize:20, marginBottom:2 }}>{d.icon}</div>
                    <div style={{ fontFamily:'Bebas Neue', fontSize:18, color:reached?t.accent1:t.textSub }}>{d.km}</div>
                    <div style={{ color:t.textSub, fontSize:8, marginBottom:2 }}>km</div>
                    <div style={{ color:reached?t.text:t.textSub, fontWeight:600, fontSize:10 }}>{d.label}</div>
                  </div>
                </a>
              );
            })}
          </div>
        </div>

        {/* Individual participant progress */}
        <div style={{ marginBottom:16 }}>
          <div style={{ color:t.text, fontWeight:700, fontSize:16, marginBottom:16 }}>
            🏃 แต่ละคนวิ่งไปถึงไหนแล้ว?
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:14 }}>
            {[...participants].sort((a,b) => b.km - a.km).map((p) => {
              const pct = Math.min(100, (p.km / perPersonGoal) * 100);
              const loc = getCurrentLocation(p.km, distances);
              return (
                <div key={p.id} style={{ background:t.card, border:`1px solid ${t.cardBorder}`, borderRadius:16, padding:'16px 18px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                    {/* Person icon circle */}
                    <div style={{ width:38, height:38, borderRadius:'50%', background:`linear-gradient(135deg,${t.accent1}44,${t.accent2}44)`, border:`2px solid ${t.accent1}66`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                      🏃
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ color:t.text, fontWeight:700, fontSize:14, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.name}</div>
                      <div style={{ color:t.textMuted, fontSize:11 }}>{loc.icon} ถึง {loc.label} แล้ว</div>
                    </div>
                    <div style={{ fontFamily:'Bebas Neue', fontSize:22, color:t.accent1, flexShrink:0 }}>{p.km.toFixed(1)}</div>
                    <div style={{ color:t.textSub, fontSize:10, flexShrink:0 }}>km</div>
                  </div>
                  <div style={{ background:t.progressBg, borderRadius:999, height:6, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${pct}%`, background:`linear-gradient(90deg,${t.accent1},${t.accent2})`, borderRadius:999, transition:'width 1.2s ease' }} />
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
                    <span style={{ color:t.textSub, fontSize:10 }}>0 km</span>
                    <span style={{ color:t.accent2, fontSize:10, fontWeight:600 }}>{pct.toFixed(0)}%</span>
                    <span style={{ color:t.textSub, fontSize:10 }}>450 km</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
