import { useContext, useEffect, useState } from 'react';
import { ThemeCtx } from '@/themes/context';
import { useAppData } from '@/context/DataContext';
import { SectionHeader } from '@/components/UI';
import { Reveal, CountUp, stagger } from '@/motion/Motion';
import { api } from '@/api/client';
import { fmtKm } from '@/utils/fmt';
import type { StagesData, StagePlayer } from '@/types';

const thDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('th-TH', { day:'numeric', month:'short', year:'numeric' });

/** แถบด่านของคนหนึ่ง: ✓ = ผ่านแล้ว, วงกลมมีสี = ด่านปัจจุบัน, ว่าง = ยังไม่ผ่าน/ยังไม่ถึง (ไม่แสดงว่า "พลาด") */
function StageTrack({ p, data }: { p: StagePlayer; data: StagesData }) {
  const { theme: t } = useContext(ThemeCtx);
  const passed = new Set(p.passed);
  return (
    <div role="img" aria-label={`ผ่าน ${p.passedCount} จาก ${data.totalStages} ด่าน`}
      style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
      {data.stages.map(s => {
        const ok = passed.has(s.n);
        const isCur = s.status === 'current';
        const curOk = isCur && p.currentPassed;
        return (
          <span key={s.n} title={`ด่าน ${s.n} · ${thDate(s.start)}`} className={ok || curOk ? 'm-pop' : undefined}
            style={{
              width:18, height:18, borderRadius:'50%', display:'inline-flex', alignItems:'center', justifyContent:'center',
              fontSize:10, fontWeight:800, lineHeight:1, ['--i' as string]: s.n,
              background: ok || curOk ? `linear-gradient(135deg,${t.accent2},${t.accent1})` : 'transparent',
              color: ok || curOk ? '#fff' : t.textSub,
              border: isCur && !curOk ? `2px solid ${t.accent1}` : ok || curOk ? 'none' : `1px solid ${t.cardBorder}`,
              boxShadow: isCur && !curOk ? `0 0 8px ${t.accent1}66` : 'none',
            }}>{ok || curOk ? '✓' : ''}</span>
        );
      })}
    </div>
  );
}

export default function Stages() {
  const { theme: t } = useContext(ThemeCtx);
  const { data: app, loading } = useAppData();
  const [data, setData] = useState<StagesData | null>(null);

  // โหลดใหม่เมื่อข้อมูลหลักรีเฟรช (sync / auto-refresh ทุก 5 นาที)
  useEffect(() => {
    if (loading) return;
    api.stages().then(setData).catch(() => setData(null));
  }, [loading, app.lastSync]);

  if (!data || !data.active || app.isMockData) return null;

  const cur = data.stages.find(s => s.status === 'current');
  const teamPct = data.team.players ? (data.team.passedCurrent / data.team.players) * 100 : 0;
  const ranked = data.phase === 'upcoming' ? [] : data.players;

  return (
    <section id="stages" style={{ padding:'80px 24px' }}>
      <div style={{ maxWidth:860, margin:'0 auto' }}>
        <SectionHeader tag="ด่านรายสัปดาห์" title="ผ่านด่านไปด้วยกัน" />

        {/* ── สถานะด่านปัจจุบัน ── */}
        <Reveal style={{ background:t.card, border:`1px solid ${t.cardBorder}`, borderRadius:20, padding:'22px 24px', marginBottom:24 }}>
          {data.phase === 'upcoming' && (
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:32, marginBottom:6 }}>🚪</div>
              <div style={{ color:t.text, fontWeight:700, fontSize:16 }}>ด่านที่ 1 เปิด {thDate(data.seasonStart)}</div>
              <div style={{ color:t.textMuted, fontSize:13, marginTop:4 }}>
                ทั้งหมด {data.totalStages} ด่าน ด่านละ 7 วัน — วิ่งให้ถึงเป้าของตัวเองในแต่ละสัปดาห์ก็ผ่านด่าน
              </div>
            </div>
          )}
          {data.phase === 'running' && cur && (
            <>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', flexWrap:'wrap', gap:8, marginBottom:12 }}>
                <div>
                  <div style={{ color:t.textSub, fontSize:12, fontWeight:600, letterSpacing:2 }}>ด่านปัจจุบัน</div>
                  <div style={{ fontFamily:'Bebas Neue', fontSize:44, color:t.accent1, lineHeight:1 }}>
                    {cur.n} <span style={{ fontSize:20, color:t.textMuted }}>/ {data.totalStages}</span>
                  </div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ color:t.text, fontWeight:700, fontSize:15 }}>เหลืออีก {data.daysLeftInStage} วัน</div>
                  <div style={{ color:t.textSub, fontSize:12 }}>{thDate(cur.start)} – {thDate(cur.end)}</div>
                </div>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                <span style={{ color:t.textMuted, fontSize:13 }}>ผ่านด่านนี้แล้ว</span>
                <span style={{ color:t.accent2, fontWeight:700, fontFamily:'Bebas Neue', fontSize:18 }}>
                  <CountUp value={data.team.passedCurrent} /> / {data.team.players} คน
                </span>
              </div>
              <div style={{ background:t.progressBg, borderRadius:999, height:10, overflow:'hidden' }}>
                <div className="m-fill" style={{ height:'100%', width:`${teamPct}%`, borderRadius:999, background:`linear-gradient(90deg,${t.accent2},${t.accent1})`, transition:'width 1s cubic-bezier(.33,1,.68,1)' }} />
              </div>
            </>
          )}
          {data.phase === 'ended' && (
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:32, marginBottom:6 }}>🏁</div>
              <div style={{ color:t.text, fontWeight:700, fontSize:16 }}>จบครบ {data.totalStages} ด่านแล้ว</div>
            </div>
          )}
          <div style={{ color:t.textSub, fontSize:11, marginTop:12, lineHeight:1.6 }}>
            ผ่านด่าน = วิ่งรวมในสัปดาห์นั้นถึงเป้าของตัวเอง (ค่าเริ่มต้น {fmtKm(data.defaultTarget)} km) · เป้าปรับตามระดับของแต่ละคนได้ ไม่ต้องวิ่งเร็วหรือไกลกว่าใคร
          </div>
        </Reveal>

        {/* ── รายชื่อ ── */}
        {ranked.length > 0 && (
          <Reveal variant="group">
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {ranked.map((p, i) => {
                const pct = Math.min(100, p.target > 0 ? (p.currentKm / p.target) * 100 : 0);
                return (
                  <div key={p.id} className="m-item m-lift"
                    style={stagger(i, { background:t.card, border:`1px solid ${p.currentPassed ? t.accent2 + '88' : t.cardBorder}`, borderRadius:14, padding:'12px 16px' })}>
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
                      <div style={{ width:36, height:36, borderRadius:'50%', background:`linear-gradient(135deg,${t.accent1},${t.accent2})`, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:13, flexShrink:0 }}>{p.initials}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ color:t.text, fontWeight:600, fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {p.name}{p.streak >= 2 && <span title={`ผ่านติดกัน ${p.streak} ด่าน`} style={{ marginLeft:6 }}>🔥{p.streak}</span>}
                        </div>
                        <div style={{ color:t.textSub, fontSize:11 }}>เป้า {fmtKm(p.target)} km / สัปดาห์</div>
                      </div>
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <div style={{ fontFamily:'Bebas Neue', fontSize:22, color:t.accent1, lineHeight:1 }}>
                          <CountUp value={p.passedCount} /><span style={{ fontSize:13, color:t.textSub }}> / {data.totalStages}</span>
                        </div>
                        <div style={{ color:t.textSub, fontSize:10 }}>ด่านที่ผ่าน</div>
                      </div>
                    </div>
                    <StageTrack p={p} data={data} />
                    {data.phase === 'running' && (
                      <div style={{ marginTop:10 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:4 }}>
                          <span style={{ color:t.textMuted }}>สัปดาห์นี้</span>
                          <span style={{ color: p.currentPassed ? t.accent2 : t.textMuted, fontWeight:600 }}>
                            {p.currentPassed ? '✓ ผ่านด่านนี้แล้ว' : `${fmtKm(p.currentKm)} / ${fmtKm(p.target)} km`}
                          </span>
                        </div>
                        <div style={{ background:t.progressBg, borderRadius:999, height:6, overflow:'hidden' }}>
                          <div className="m-fill" style={{ height:'100%', width:`${pct}%`, borderRadius:999, background: p.currentPassed ? `linear-gradient(90deg,${t.accent2},${t.accent3})` : `linear-gradient(90deg,${t.accent1},${t.accent2})`, transition:'width .8s cubic-bezier(.33,1,.68,1)', ['--i' as string]: i }} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}
