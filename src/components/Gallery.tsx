import { useContext, useEffect, useState } from 'react';
import { ThemeCtx } from '@/themes/context';
import { SectionHeader } from '@/components/UI';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000';

interface GalleryImage { filename: string; caption: string; uploaded_at: string }

export default function Gallery() {
  const { theme: t } = useContext(ThemeCtx);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [selected, setSelected] = useState<GalleryImage | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/gallery`)
      .then(r => r.json())
      .then(setImages)
      .catch(() => {});
  }, []);

  return (
    <section id="gallery" style={{ padding:'80px 24px', background:t.altBg }}>
      <div style={{ maxWidth:980, margin:'0 auto' }}>
        <SectionHeader tag="ภาพกิจกรรม" title="Gallery" />

        {images.length === 0 ? (
          <div style={{ textAlign:'center', color:t.textSub, padding:'40px 0', fontSize:15 }}>
            📷 ยังไม่มีภาพกิจกรรม — แอดมินสามารถอัปโหลดได้จากหน้าจัดการ
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:16 }}>
            {images.map((img) => (
              <div key={img.filename}
                onClick={() => setSelected(img)}
                style={{
                  borderRadius:16, overflow:'hidden',
                  border:`1px solid ${t.cardBorder}`,
                  cursor:'pointer', transition:'transform 0.2s, box-shadow 0.2s',
                  background:t.card,
                }}
                onMouseEnter={e=>{e.currentTarget.style.transform='scale(1.03)';e.currentTarget.style.boxShadow=`0 12px 32px ${t.accent1}30`;}}
                onMouseLeave={e=>{e.currentTarget.style.transform='scale(1)';e.currentTarget.style.boxShadow='none';}}
              >
                <img
                  src={`${BASE}/gallery/${img.filename}`}
                  alt={img.caption}
                  style={{ width:'100%', height:180, objectFit:'cover', display:'block' }}
                  loading="lazy"
                />
                {img.caption && (
                  <div style={{ padding:'8px 12px', color:t.textSub, fontSize:12 }}>{img.caption}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:24 }}
        >
          <div onClick={e => e.stopPropagation()} style={{ maxWidth:900, width:'100%', textAlign:'center' }}>
            <img
              src={`${BASE}/gallery/${selected.filename}`}
              alt={selected.caption}
              style={{ maxWidth:'100%', maxHeight:'80vh', borderRadius:16, objectFit:'contain' }}
            />
            {selected.caption && <div style={{ color:'#ccc', marginTop:12, fontSize:14 }}>{selected.caption}</div>}
            <button
              onClick={() => setSelected(null)}
              style={{ marginTop:16, background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, padding:'8px 20px', color:'#fff', cursor:'pointer', fontSize:13 }}
            >
              ✕ ปิด
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
