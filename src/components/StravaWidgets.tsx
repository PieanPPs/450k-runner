import { useContext } from 'react';
import { ThemeCtx } from '@/themes/context';
import { SectionHeader } from '@/components/UI';

export default function StravaWidgets() {
  const { theme: t } = useContext(ThemeCtx);

  return (
    <section id="strava" style={{ padding:'80px 24px', background:t.bg }}>
      <div style={{ maxWidth:980, margin:'0 auto' }}>
        <SectionHeader tag="Strava Club" title="กิจกรรมล่าสุด" />
        <div style={{ display:'flex', flexWrap:'wrap', gap:24, justifyContent:'center' }}>

          {/* Summary Widget — สถิติสัปดาห์นี้ */}
          <div style={{ background:t.card, border:`1px solid ${t.cardBorder}`, borderRadius:20, padding:20, display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
            <div style={{ color:t.textSub, fontSize:12, fontWeight:600, letterSpacing:1, marginBottom:4 }}>📊 สถิติสัปดาห์นี้</div>
            <iframe
              allowTransparency={true}
              frameBorder={0}
              height={160}
              scrolling="no"
              src="https://www.strava.com/clubs/2086686/latest-rides/b388cabfc3e8fda421bbc6936d2c9475afd0de28?show_rides=false"
              width={300}
              title="Strava Club Summary"
              style={{ borderRadius:8 }}
            />
          </div>

          {/* Activity Widget — runs ล่าสุด */}
          <div style={{ background:t.card, border:`1px solid ${t.cardBorder}`, borderRadius:20, padding:20, display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
            <div style={{ color:t.textSub, fontSize:12, fontWeight:600, letterSpacing:1, marginBottom:4 }}>🏃 กิจกรรมล่าสุดของ Club</div>
            <iframe
              allowTransparency={true}
              frameBorder={0}
              height={454}
              scrolling="no"
              src="https://www.strava.com/clubs/2086686/latest-rides/b388cabfc3e8fda421bbc6936d2c9475afd0de28?show_rides=true"
              width={300}
              title="Strava Club Activities"
              style={{ borderRadius:8 }}
            />
          </div>

        </div>
      </div>
    </section>
  );
}
