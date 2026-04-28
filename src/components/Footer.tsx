import { useContext } from 'react';
import { ThemeCtx } from '@/themes/context';

export default function Footer() {
  const { theme: t } = useContext(ThemeCtx);
  return (
    <footer style={{ padding:'40px 24px', textAlign:'center', background:t.bg2, borderTop:`1px solid ${t.cardBorder}` }}>
      <div style={{ fontFamily:'Bebas Neue', fontSize:14, color:t.accent1, letterSpacing:2, marginBottom:8 }}>450K TEACHER'S SPIRIT</div>
      <div style={{ color:t.textSub, fontSize:12, marginBottom:4 }}>โรงเรียนอนุสรณ์ศุภมาศ · Healthy Teacher, Happy School</div>
      <div style={{ color:t.textSub, fontSize:11 }}>© 2026 โครงการ 450K Teacher's Spirit. สร้างด้วย ❤️ เพื่อให้ครูมีสุขภาพที่ดี</div>
    </footer>
  );
}
