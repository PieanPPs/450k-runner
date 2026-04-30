import { useContext } from 'react';
import { ThemeCtx } from '@/themes/context';
import { SectionHeader } from '@/components/UI';

const tips = [
  {
    icon: '🏃',
    title: 'วิ่ง/เดินเร็ว',
    who: '150–300 นาที/สัปดาห์',
    desc: 'WHO แนะนำกิจกรรมแอโรบิกความหนักปานกลาง เช่น เดินเร็วหรือวิ่งเหยาะๆ อย่างน้อย 150 นาทีต่อสัปดาห์สำหรับผู้สูงอายุ',
    color: '#FF8C35',
    bg: 'rgba(255,140,53,0.10)',
  },
  {
    icon: '💪',
    title: 'ฝึกความแข็งแรง',
    who: '2 วัน/สัปดาห์ขึ้นไป',
    desc: 'การฝึกกล้ามเนื้อ เช่น สควอต กายบริหาร หรือยกน้ำหนักเบาๆ ช่วยป้องกันกระดูกพรุนและลดความเสี่ยงการหกล้ม',
    color: '#9B30FF',
    bg: 'rgba(155,48,255,0.10)',
  },
  {
    icon: '🧘',
    title: 'ทรงตัว & ยืดหยุ่น',
    who: '3 วัน/สัปดาห์ขึ้นไป',
    desc: 'ท่าฝึกทรงตัว เช่น ยืนขาเดียว โยคะ หรือไทชิ ช่วยป้องกันการหกล้มซึ่งเป็นสาเหตุหลักของการบาดเจ็บในผู้สูงอายุ',
    color: '#06b6d4',
    bg: 'rgba(6,182,212,0.10)',
  },
  {
    icon: '❤️',
    title: 'สุขภาพหัวใจ',
    who: 'ลดความเสี่ยงได้ 35%',
    desc: 'งานวิจัยชี้ว่าผู้สูงวัยที่ออกกำลังกายสม่ำเสมอมีความเสี่ยงโรคหัวใจลดลง 35% และโรคเบาหวานประเภท 2 ลดลง 40%',
    color: '#f43f5e',
    bg: 'rgba(244,63,94,0.10)',
  },
];

const rules = [
  { icon: '🏃', label: 'วิ่ง — pace', value: '3.5–30 นาที/km (ไม่บังคับระยะ/เวลา)' },
  { icon: '🚶', label: 'เดิน — pace', value: '8–17 นาที/km (ไม่บังคับระยะ/เวลา)' },
  { icon: '🚗', label: 'ไม่นับ', value: 'ขับรถ, ปั่นจักรยาน, เปิดทิ้งไว้' },
  { icon: '👑', label: 'กลุ่ม 60+', value: 'admin กำหนดใน Leaderboard แยก' },
];

export default function HealthTips() {
  const { theme: t } = useContext(ThemeCtx);

  return (
    <section id="health" style={{ padding: '60px 24px', background: t.bg }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <SectionHeader tag="สุขภาพ & WHO" title="คำแนะนำการออกกำลังกาย" />

        {/* WHO Tips Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 40 }}>
          {tips.map((tip) => (
            <div key={tip.title} style={{
              background: tip.bg,
              border: `1px solid ${tip.color}40`,
              borderRadius: 16,
              padding: '20px 18px',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: tip.color, opacity: 0.7 }} />
              <div style={{ fontSize: 28, marginBottom: 8 }}>{tip.icon}</div>
              <div style={{ color: tip.color, fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{tip.title}</div>
              <div style={{
                display: 'inline-block',
                background: tip.color + '22',
                color: tip.color,
                fontWeight: 700,
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 999,
                marginBottom: 10,
              }}>{tip.who}</div>
              <p style={{ color: t.textMuted, fontSize: 12, lineHeight: 1.7, margin: 0 }}>{tip.desc}</p>
            </div>
          ))}
        </div>

        {/* Activity Counting Rules */}
        <div style={{
          background: t.card,
          border: `1px solid ${t.cardBorder}`,
          borderRadius: 20,
          padding: '24px 28px',
        }}>
          <div style={{ color: t.text, fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
            📋 เกณฑ์การนับกิจกรรม
          </div>
          <div style={{ color: t.textMuted, fontSize: 12, marginBottom: 18 }}>
            ระบบจะนับ km เฉพาะกิจกรรมที่ผ่านเกณฑ์ต่อไปนี้เท่านั้น (ป้องกันการนับผิดพลาด)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {rules.map((r) => (
              <div key={r.label} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                background: t.altBg, borderRadius: 10, padding: '12px 14px',
              }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{r.icon}</span>
                <div>
                  <div style={{ color: t.textSub, fontSize: 11, marginBottom: 2 }}>{r.label}</div>
                  <div style={{ color: t.text, fontWeight: 600, fontSize: 12 }}>{r.value}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(6,182,212,0.08)', borderRadius: 10, borderLeft: '3px solid #06b6d4' }}>
            <span style={{ color: '#06b6d4', fontSize: 12 }}>
              ✅ รับทั้ง <strong>วิ่ง</strong> (pace 3.5–30 นาที/km) และ <strong>เดิน</strong> (pace 8–17 นาที/km) — ไม่บังคับระยะ/เวลา | ไม่นับขับรถ, ปั่นจักรยาน, หรือเปิดทิ้งไว้
            </span>
          </div>
        </div>

      </div>
    </section>
  );
}
