import { useContext } from 'react';
import { ThemeCtx } from '@/themes/context';
import { SectionHeader } from '@/components/UI';

const CLUB_ID = '2086686';
const CLUB_URL = `https://www.strava.com/clubs/${CLUB_ID}`;

export default function StravaWidgets() {
  const { theme: t } = useContext(ThemeCtx);

  const statBox = (label: string, value: string, icon: string) => (
    <div style={{ background:t.altBg, border:`1px solid ${t.cardBorder}`, borderRadius:12, padding:'14px 20px', textAlign:'center', minWidth:120 }}>
      <div style={{ fontSize:22, marginBottom:6 }}>{icon}</div>
      <div style={{ color:t.textSub, fontSize:11, marginBottom:2 }}>{label}</div>
      <div style={{ color:t.text, fontWeight:700, fontSize:15 }}>{value}</div>
    </div>
  );

  return (
    <section id="strava" style={{ padding:'60px 24px', background:t.bg }}>
      <div style={{ maxWidth:980, margin:'0 auto' }}>
        <SectionHeader tag="Strava Club" title="ติดตามกิจกรรม" />

        <div style={{ display:'flex', flexWrap:'wrap', gap:24, justifyContent:'center', alignItems:'flex-start' }}>

          {/* ลิงก์ไป Strava Club */}
          <div style={{ background:t.card, border:`1px solid ${t.cardBorder}`, borderRadius:20, padding:28, flex:'1', minWidth:260, maxWidth:420 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
              <div style={{ width:48, height:48, borderRadius:12, background:'#FC4C02', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>🏃</div>
              <div>
                <div style={{ color:t.text, fontWeight:700, fontSize:15 }}>โรงเรียนอนุสรณ์ศุภมาศ</div>
                <div style={{ color:t.textSub, fontSize:12 }}>Strava Club • {CLUB_ID}</div>
              </div>
            </div>
            <p style={{ color:t.textMuted, fontSize:13, lineHeight:1.7, marginBottom:20 }}>
              ติดตามกิจกรรมวิ่งสดๆ ของทุกคนในทีมได้ที่ Strava Club ของโรงเรียน พร้อมดูสถิติรายสัปดาห์และ leaderboard ของ Strava
            </p>
            <a href={CLUB_URL} target="_blank" rel="noopener noreferrer"
              style={{ display:'inline-flex', alignItems:'center', gap:8, background:'#FC4C02', borderRadius:10, padding:'10px 20px', color:'#fff', fontWeight:700, fontSize:13, textDecoration:'none' }}>
              <span>🔗</span> เปิด Strava Club
            </a>
          </div>

          {/* วิธีติดตาม */}
          <div style={{ background:t.card, border:`1px solid ${t.cardBorder}`, borderRadius:20, padding:28, flex:'1', minWidth:260, maxWidth:420 }}>
            <div style={{ color:t.accent1, fontSize:13, fontWeight:700, marginBottom:14 }}>📲 วิธีเข้าร่วม Club</div>
            {[
              ['1', 'ดาวน์โหลดแอป Strava บนมือถือ'],
              ['2', 'สมัครสมาชิกฟรี (ใช้ Google/Facebook ได้)'],
              ['3', 'ค้นหา "อนุสรณ์ศุภมาศ" หรือกดลิงก์ด้านซ้าย'],
              ['4', 'กด "Join Club" — km จะถูกนับอัตโนมัติ'],
            ].map(([n, text]) => (
              <div key={n} style={{ display:'flex', gap:12, marginBottom:12, alignItems:'flex-start' }}>
                <div style={{ width:24, height:24, borderRadius:999, background:t.accent1+'33', color:t.accent1, fontSize:12, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>{n}</div>
                <div style={{ color:t.textMuted, fontSize:13, lineHeight:1.6 }}>{text}</div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
