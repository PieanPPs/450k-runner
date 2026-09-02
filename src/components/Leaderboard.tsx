import { useContext, useMemo, useState } from 'react';
import { ThemeCtx } from '@/themes/context';
import { useAppData } from '@/context/DataContext';
import { SectionHeader } from '@/components/UI';
import { fmtKm } from '@/utils/fmt';
import type { Participant, Badge } from '@/types';

// ── Badge Collection Modal ────────────────────────────────────────────────────
function BadgeModal({
  p, badges, earnedIds, onClose, t,
}: {
  p: Participant;
  badges: Badge[];
  earnedIds: number[];
  onClose: () => void;
  t: ReturnType<typeof useContext<any>>;
}) {
  const earned   = badges.filter(b => earnedIds.includes(b.id));
  const unearned = badges.filter(b => !earnedIds.includes(b.id));

  const hint = (b: Badge) => {
    const x = b as any;
    const parts: string[] = [];
    if (x.auto_km             != null) parts.push(`km สะสม ≥ ${x.auto_km} km (ตอนนี้ ${fmtKm(p.km)})`);
    if (x.auto_streak         != null) parts.push(`streak ≥ ${x.auto_streak} วัน (ตอนนี้ ${p.streak})`);
    if (x.auto_activity_count != null) parts.push(`วิ่ง ≥ ${x.auto_activity_count} ครั้ง (ตอนนี้ ${p.activityCount})`);
    if (x.auto_act_km != null && x.auto_act_min != null) {
      const h = Math.floor(x.auto_act_min / 60);
      const m = x.auto_act_min % 60;
      const timeStr = h > 0 ? `${h} ชม. ${m > 0 ? m + ' นาที' : ''}`.trim() : `${m} นาที`;
      parts.push(`วิ่ง ≥ ${x.auto_act_km} km ภายใน ${timeStr} (ในกิจกรรมเดียว)`);
    }
    if (parts.length === 0) return 'มอบพิเศษโดยแอดมิน';
    return parts.join(' · ');
  };

  return (
    <div onClick={onClose}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background:t.card, border:`1px solid ${t.cardBorder}`, borderRadius:20, width:'min(480px,100%)', maxHeight:'85vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ padding:'20px 24px', borderBottom:`1px solid ${t.cardBorder}` }}>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ width:48, height:48, borderRadius:'50%', background:`linear-gradient(135deg,${t.accent1},${t.accent2})`, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:17, flexShrink:0 }}>
              {p.initials}
            </div>
            <div>
              <div style={{ color:t.text, fontWeight:700, fontSize:16 }}>{p.name}</div>
              <div style={{ color:t.textSub, fontSize:12, marginTop:2 }}>
                {fmtKm(p.km)} km · {p.activityCount} ครั้ง · streak {p.streak} วัน
              </div>
            </div>
            <button onClick={onClose} style={{ marginLeft:'auto', background:'none', border:'none', color:t.textMuted, fontSize:20, cursor:'pointer', lineHeight:1 }}>✕</button>
          </div>
        </div>

        <div style={{ overflowY:'auto', padding:'20px 24px', flex:1 }}>
          {/* Earned */}
          {earned.length > 0 && (
            <div style={{ marginBottom:24 }}>
              <div style={{ color:t.accent2, fontWeight:700, fontSize:13, marginBottom:12, letterSpacing:1 }}>
                ✅ ได้รับแล้ว ({earned.length})
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {earned.map(b => (
                  <div key={b.id} style={{ display:'flex', alignItems:'center', gap:12, background:`${b.color}18`, border:`1px solid ${b.color}44`, borderRadius:12, padding:'10px 14px' }}>
                    <span style={{ fontSize:26, lineHeight:1 }}>{b.icon}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ color:t.text, fontWeight:600, fontSize:14 }}>{b.label}</div>
                      {b.description && <div style={{ color:t.textSub, fontSize:11, marginTop:2 }}>{b.description}</div>}
                    </div>
                    <span style={{ fontSize:18 }}>🏆</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unearned */}
          {unearned.length > 0 && (
            <div>
              <div style={{ color:t.textMuted, fontWeight:700, fontSize:13, marginBottom:12, letterSpacing:1 }}>
                🎯 ยังไม่ได้รับ ({unearned.length})
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {unearned.map(b => (
                  <div key={b.id} style={{ display:'flex', alignItems:'center', gap:12, background:t.altBg, border:`1px solid ${t.cardBorder}`, borderRadius:12, padding:'10px 14px', opacity:0.7 }}>
                    <span style={{ fontSize:26, lineHeight:1, filter:'grayscale(1)' }}>{b.icon}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ color:t.textSub, fontWeight:600, fontSize:14 }}>{b.label}</div>
                      <div style={{ color:t.textMuted, fontSize:11, marginTop:3 }}>{hint(b)}</div>
                    </div>
                    <span style={{ fontSize:16, opacity:0.4 }}>🔒</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {badges.length === 0 && (
            <div style={{ textAlign:'center', color:t.textMuted, fontSize:13, padding:32 }}>
              ยังไม่มี badge ในระบบ
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Leaderboard ───────────────────────────────────────────────────────────────
export default function Leaderboard() {
  const { theme: t } = useContext(ThemeCtx);
  const { data } = useAppData();
  const { participants, improvement, badges, badgeAssignments } = data;
  const [tab, setTab] = useState(0);
  const [selectedP, setSelectedP] = useState<Participant | null>(null);

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

  const renderRegular = () => {
    const max = cur.data.length > 0 ? Number(cur.data[0][cur.key]) : 1;
    return cur.data.map((p, i) => {
      const val = Number(p[cur.key]);
      const earnedBadges = (badgeAssignments?.[String(p.id)] ?? []);
      return (
        <div key={p.id}
          onClick={() => setSelectedP(p)}
          style={{ display:'flex', alignItems:'center', gap:14, background:t.card, border:`1px solid ${i<3?t.accent1+'44':t.cardBorder}`, borderRadius:14, padding:'12px 16px', transition:'transform 0.15s', boxShadow:i===0?`0 4px 20px ${t.accent1}30`:'none', cursor:'pointer' }}
          onMouseEnter={e=>e.currentTarget.style.transform='translateX(4px)'}
          onMouseLeave={e=>e.currentTarget.style.transform='translateX(0)'}>
          <div style={{ width:32, textAlign:'center', fontSize:i<3?20:14, fontWeight:700, color:i<3?t.text:t.textSub, fontFamily:'Bebas Neue' }}>
            {i<3?medals[i]:i+1}
          </div>
          <div style={{ width:40, height:40, borderRadius:'50%', background:`linear-gradient(135deg,${t.accent1},${t.accent2})`, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:14, flexShrink:0 }}>
            {p.initials}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' }}>
              <span style={{ color:t.text, fontWeight:600, fontSize:14, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.name}</span>
              {earnedBadges.map(bid => {
                const b = (badges ?? []).find(x => x.id === bid);
                if (!b) return null;
                return <span key={bid} title={b.label} style={{ fontSize:14, cursor:'default', lineHeight:1 }}>{b.icon}</span>;
              })}
            </div>
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

  const renderImprovement = () => {
    const maxDiff = improvement.length > 0 ? improvement[0].diff : 1;
    return improvement.map((p, i) => {
      const isPositive = p.diff >= 0;
      const diffColor = isPositive ? t.accent2 : '#f87171';
      // หา participant ตัวเต็มเพื่อใช้กับ modal
      const fullP = participants.find(pp => pp.initials === p.initials);
      return (
        <div key={p.initials + i}
          onClick={() => { if (fullP) setSelectedP(fullP); }}
          style={{ display:'flex', alignItems:'center', gap:14, background:t.card, border:`1px solid ${i<3?t.accent2+'55':t.cardBorder}`, borderRadius:14, padding:'12px 16px', transition:'transform 0.15s', boxShadow:i===0?`0 4px 20px ${t.accent2}30`:'none', cursor: fullP ? 'pointer' : 'default' }}
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
        {(badges ?? []).length > 0 && (
          <div style={{ textAlign:'center', marginTop:16, color:t.textMuted, fontSize:12 }}>
            กดที่ชื่อเพื่อดู badge collection
          </div>
        )}
      </div>

      {/* Badge Modal */}
      {selectedP && (
        <BadgeModal
          p={selectedP}
          badges={badges ?? []}
          earnedIds={badgeAssignments?.[String(selectedP.id)] ?? []}
          onClose={() => setSelectedP(null)}
          t={t}
        />
      )}
    </section>
  );
}
