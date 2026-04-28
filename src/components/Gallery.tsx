import { useContext, useMemo } from 'react';
import { ThemeCtx } from '@/themes/context';
import { SectionHeader } from '@/components/UI';

export default function Gallery() {
  const { theme: t } = useContext(ThemeCtx);
  const slots = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    id: i+1,
    title: `ภาพกิจกรรม ${i+1}`,
    h: 120 + ((i * 17) % 70),
  })), []);

  return (
    <section id="gallery" style={{ padding:'80px 24px', background:t.altBg }}>
      <div style={{ maxWidth:980, margin:'0 auto' }}>
        <SectionHeader tag="ภาพกิจกรรม" title="Gallery" />
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:16 }}>
          {slots.map((s)=>(
            <div key={s.id}
              style={{
                height:s.h, borderRadius:16,
                background:`linear-gradient(135deg,${t.accent1}25,${t.accent2}20)`,
                border:`1px solid ${t.cardBorder}`,
                display:'flex', alignItems:'center', justifyContent:'center',
                color:t.text, fontWeight:600, transition:'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={e=>{e.currentTarget.style.transform='scale(1.03)';e.currentTarget.style.boxShadow=`0 12px 32px ${t.accent1}30`;}}
              onMouseLeave={e=>{e.currentTarget.style.transform='scale(1)';e.currentTarget.style.boxShadow='none';}}
            >
              📷 {s.title}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
