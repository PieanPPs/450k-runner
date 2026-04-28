import { useContext } from 'react';
import { ThemeCtx } from '@/themes/context';
import { useAppData } from '@/context/DataContext';
import { SectionHeader } from '@/components/UI';

// Default card content หากยังไม่ได้ตั้งค่าใน admin
const DEFAULT_CARDS = [
  { icon:'🏃', title:'วัตถุประสงค์', body:'ส่งเสริมให้ครูและบุคลากรในโรงเรียนอนุสรณ์ศุภมาศหันมาออกกำลังกายอย่างสม่ำเสมอ เพื่อสุขภาพที่ดีในระยะยาว' },
  { icon:'❤️', title:'เพื่อครู เพื่อเด็ก', body:'ครูที่มีสุขภาพดีมีพลังงานมากขึ้นในการสอน ส่งผลให้นักเรียนได้รับการดูแลที่ดีและมีต้นแบบที่ดีในการดูแลสุขภาพ' },
  { icon:'🤝', title:'สร้างความสามัคคี', body:'กิจกรรมกลุ่มช่วยสร้างความผูกพันระหว่างบุคลากร เกิดวัฒนธรรมองค์กรที่ส่งเสริมสุขภาพและความเป็นหนึ่งเดียว' },
  { icon:'📊', title:'ผลลัพธ์ที่คาดหวัง', body:'บุคลากรมีสุขภาพดีขึ้น ค่า BMI ลดลง มีนิสัยออกกำลังกาย และเกิดแรงจูงใจในการดูแลตัวเองต่อเนื่องหลังจบโครงการ' },
];

export default function About() {
  const { theme: t } = useContext(ThemeCtx);
  const { data } = useAppData();
  const { participants, settings } = data;

  // ดึง cards จาก settings หากมี ไม่งั้นใช้ default
  const cards = [1, 2, 3, 4].map((n, i) => ({
    icon : DEFAULT_CARDS[i].icon,
    title: settings[`about_${n}_title`] || DEFAULT_CARDS[i].title,
    body : settings[`about_${n}_body`]  || DEFAULT_CARDS[i].body,
  })).filter(c => c.title);

  return (
    <section id="about" style={{ padding:'80px 24px', background:t.altBg }}>
      <div style={{ maxWidth:900, margin:'0 auto' }}>
        <SectionHeader tag="โครงการ" title="จุดประสงค์ & รายละเอียด" />
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:20, marginBottom:48 }}>
          {cards.map((c,i)=>(
            <div key={i} style={{ background:t.card, border:`1px solid ${t.cardBorder}`, borderRadius:16, padding:24, transition:'transform 0.2s,box-shadow 0.2s' }}
              onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-4px)';e.currentTarget.style.boxShadow=`0 12px 32px ${t.accent1}30`;}}
              onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none';}}>
              <div style={{ fontSize:32, marginBottom:12 }}>{c.icon}</div>
              <div style={{ color:t.text, fontWeight:700, marginBottom:8, fontSize:16 }}>{c.title}</div>
              <div style={{ color:t.textMuted, fontSize:13, lineHeight:1.7 }}>{c.body}</div>
            </div>
          ))}
        </div>

        <div style={{ background:t.card, border:`1px solid ${t.cardBorder}`, borderRadius:20, padding:32 }}>
          <div style={{ color:t.text, fontWeight:700, fontSize:18, marginBottom:24, display:'flex', alignItems:'center', gap:8 }}>
            <span>📅</span> ระยะเวลาโครงการ
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:0 }}>
            {[
              {label:'วันเริ่มต้น',value:'1 มิ.ย. 2569',icon:'🚀'},
              {label:'วันสิ้นสุด',value:'30 ก.ย. 2569',icon:'🏁'},
              {label:'ระยะเวลา',value:'90 วัน',icon:'⏱️'},
              {label:'เป้าหมายต่อคน',value:'450 กม.',icon:'🎯'},
              {label:'ผู้เข้าร่วม',value:`${participants.length} คน`,icon:'👥'},
              {label:'ติดตามด้วย',value:'Strava',icon:'📱'},
            ].map((item,i,arr)=>(
              <div key={i} style={{
                padding:'16px 20px',
                borderRight: i % 3 !== 2 && i !== arr.length-1 ? `1px solid ${t.cardBorder}` : 'none',
                borderBottom: i < arr.length - (arr.length % 3 || 3) ? `1px solid ${t.cardBorder}` : 'none',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                  <span style={{ fontSize:14 }}>{item.icon}</span>
                  <span style={{ color:t.textSub, fontSize:11, fontWeight:600, letterSpacing:1 }}>{item.label.toUpperCase()}</span>
                </div>
                <div style={{ color:t.accent1, fontWeight:800, fontSize:18, fontFamily:'Bebas Neue', letterSpacing:1 }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
