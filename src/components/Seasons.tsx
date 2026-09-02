import { useContext, useState } from 'react';
import { ThemeCtx } from '@/themes/context';
import { useAppData } from '@/context/DataContext';
import { SectionHeader } from '@/components/UI';
import { fmtKm } from '@/utils/fmt';
import type { Season, SeasonResult } from '@/types';

function SeasonResultsModal({ season, onClose }: { season: Season; onClose: () => void }) {
  const { theme: t } = useContext(ThemeCtx);
  const results: SeasonResult[] = season.results || [];
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background:t.bg2, border:`1px solid ${t.cardBorder}`, borderRadius:20, width:'100%', maxWidth:540, maxHeight:'80vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ padding:'20px 24px', borderBottom:`1px solid ${t.cardBorder}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontFamily:'Bebas Neue', fontSize:22, color:t.text, letterSpacing:2 }}>{season.name} — ผลการแข่งขัน</div>
            <div style={{ color:t.textMuted, fontSize:12 }}>{season.dateRange}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:`1px solid ${t.cardBorder}`, borderRadius:8, padding:'4px 12px', color:t.textMuted, cursor:'pointer', fontFamily:'Sarabun', fontSize:13 }}>✕ ปิด</button>
        </div>
        <div style={{ overflowY:'auto', padding:'12px 16px', display:'flex', flexDirection:'column', gap:6 }}>
          {results.length === 0 ? (
            <div style={{ color:t.textSub, textAlign:'center', padding:32, fontSize:14 }}>ยังไม่มีข้อมูลผล Season นี้</div>
          ) : results.map((r, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:12, background:t.card, border:`1px solid ${i<3?t.accent1+'44':t.cardBorder}`, borderRadius:12, padding:'10px 14px' }}>
              <div style={{ width:28, textAlign:'center', fontSize:i<3?18:13, fontFamily:'Bebas Neue', color:i<3?t.text:t.textSub }}>{i<3?medals[i]:i+1}</div>
              <div style={{ width:36, height:36, borderRadius:'50%', background:`linear-gradient(135deg,${t.accent1},${t.accent2})`, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:13, flexShrink:0 }}>
                {r.initials}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ color:t.text, fontWeight:600, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.name}</div>
                <div style={{ color:t.textSub, fontSize:11 }}>{r.activity_count} ครั้ง</div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontFamily:'Bebas Neue', fontSize:18, color:t.accent1, letterSpacing:1 }}>{fmtKm(r.km)} km</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Seasons() {
  const { theme: t } = useContext(ThemeCtx);
  const { data } = useAppData();
  const { seasons } = data;
  const [viewSeason, setViewSeason] = useState<Season | null>(null);

  const statusMeta: Record<string, { label: string; color: string }> = {
    'done'       : { label:'เสร็จสิ้น',     color:t.accent3 },
    'active'     : { label:'กำลังดำเนิน',   color:t.accent1 },
    'upcoming'   : { label:'เร็วๆ นี้',      color:t.textSub },
    'pre-season' : { label:'Pre-Season',    color:'#06b6d4' },
  };

  return (
    <section id="seasons" style={{ padding:'80px 24px' }}>
      <div style={{ maxWidth:900, margin:'0 auto' }}>
        <SectionHeader tag="Season" title="สรุปผลแต่ละ Season" />
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:20 }}>
          {seasons.map((s, i) => {
            const sm = statusMeta[s.status];
            const hasFull = s.results && s.results.length > 0;
            return (
              <div key={i} style={{ background:t.card, border:`1px solid ${s.status==='active'?t.accent1+'60':s.status==='pre-season'?'#06b6d430':t.cardBorder}`, borderRadius:20, padding:28, position:'relative', overflow:'hidden' }}>
                {s.status==='active' && <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:`linear-gradient(90deg,${t.accent1},${t.accent2})` }} />}
                {s.status==='pre-season' && <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'linear-gradient(90deg,#06b6d4,#818cf8)' }} />}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
                  <div>
                    <div style={{ fontFamily:'Bebas Neue', fontSize:28, color:t.text, letterSpacing:2 }}>{s.name}</div>
                    <div style={{ color:t.textMuted, fontSize:13 }}>{s.subtitle}</div>
                    <div style={{ color:t.textSub, fontSize:12 }}>{s.dateRange}</div>
                  </div>
                  <div style={{ background:sm.color+'22', border:`1px solid ${sm.color}60`, borderRadius:999, padding:'4px 12px', color:sm.color, fontSize:12, fontWeight:700 }}>{sm.label}</div>
                </div>
                {s.status !== 'upcoming' ? (
                  <>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom: hasFull ? 14 : 0 }}>
                      {[
                        { label:'ระยะทางรวม', v:s.totalKm+' km', c:t.accent1 },
                        { label:'นำโดย',       v:s.winner,         c:t.accent2 },
                        { label:'Best (คน)',   v:s.topKm+' km',    c:t.accent3 },
                        { label:'ผู้เข้าร่วม', v:s.participants+' คน', c:t.textMuted },
                      ].map((item, j) => (
                        <div key={j} style={{ background:t.altBg, borderRadius:10, padding:'10px 12px' }}>
                          <div style={{ color:t.textSub, fontSize:10, fontWeight:600, marginBottom:4 }}>{item.label}</div>
                          <div style={{ color:item.c, fontWeight:700, fontSize:13 }}>{item.v}</div>
                        </div>
                      ))}
                    </div>
                    {hasFull && (
                      <button onClick={() => setViewSeason(s)}
                        style={{ width:'100%', background:`linear-gradient(135deg,${t.accent1}22,${t.accent2}22)`, border:`1px solid ${t.accent1}44`, borderRadius:10, padding:'8px', color:t.accent1, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'Sarabun', transition:'opacity 0.2s' }}
                        onMouseEnter={e=>(e.currentTarget.style.opacity='0.8')}
                        onMouseLeave={e=>(e.currentTarget.style.opacity='1')}>
                        🏆 ดูผลทั้งหมด ({(s.results||[]).length} คน)
                      </button>
                    )}
                  </>
                ) : (
                  <div style={{ color:t.textSub, fontSize:14, textAlign:'center', padding:'20px 0' }}>เตรียมเปิด Season นี้เร็วๆ นี้! 🔥</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {viewSeason && <SeasonResultsModal season={viewSeason} onClose={() => setViewSeason(null)} />}
    </section>
  );
}
