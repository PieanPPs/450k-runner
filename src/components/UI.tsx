import { useContext } from 'react';
import { ThemeCtx } from '@/themes/context';

/* ── Progress Bar ── */
export function ProgressBar({ value, color1, color2 }: { value: number; color1: string; color2: string }) {
  const { theme: t } = useContext(ThemeCtx);
  return (
    <div style={{ background: t.progressBg, borderRadius: 999, height: 12, overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${Math.min(100, value)}%`,
        background: `linear-gradient(90deg,${color1},${color2})`,
        borderRadius: 999, transition: 'width 1.5s ease',
        boxShadow: `0 0 12px ${color2}80`,
      }} />
    </div>
  );
}

/* ── Progress Ring ── */
export function ProgressRing({ pct, size = 80, stroke = 8 }: { pct: number; size?: number; stroke?: number }) {
  const { theme: t } = useContext(ThemeCtx);
  const r = (size - stroke * 2) / 2, circ = 2 * Math.PI * r, off = circ * (1 - pct / 100);
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={t.progressBg} strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={t.accent1} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
    </div>
  );
}

/* ── Section Header ── */
export function SectionHeader({ tag, title }: { tag?: string; title: string }) {
  const { theme: t } = useContext(ThemeCtx);
  return (
    <div style={{ textAlign: 'center', marginBottom: 40 }}>
      {tag && (
        <div style={{ fontFamily: 'Bebas Neue', fontSize: 13, letterSpacing: 4, color: t.accent2, marginBottom: 6 }}>
          {tag.toUpperCase()}
        </div>
      )}
      <div style={{ fontFamily: 'Bebas Neue', fontSize: 'clamp(28px,5vw,48px)', color: t.text, letterSpacing: 2 }}>
        {title}
      </div>
      <div style={{ width: 60, height: 3, background: `linear-gradient(90deg,${t.accent1},${t.accent2})`, borderRadius: 999, margin: '12px auto 0' }} />
    </div>
  );
}

/* ── Bar Chart ── */
export function BarChart({ data }: { data: { km: number; label: string }[] }) {
  const { theme: t } = useContext(ThemeCtx);
  const max = Math.max(...data.map(d => d.km));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ fontSize: 9, color: t.textSub, fontFamily: 'Bebas Neue' }}>
            {typeof d.km === 'number' ? d.km : d.km}
          </div>
          <div style={{
            width: '100%',
            background: i === data.length - 1 ? t.accent1 : `${t.accent1}60`,
            borderRadius: '4px 4px 0 0',
            height: `${(d.km / max) * 90}px`,
            transition: 'height 0.6s ease',
          }} />
          <div style={{ fontSize: 8, color: t.textMuted, textAlign: 'center', lineHeight: 1.2 }}>
            {d.label}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Card Wrapper ── */
export function Card({ children, style, onClick, hoverEffect = true }: {
   children: React.ReactNode; style?: React.CSSProperties; onClick?: () => void, hoverEffect?: boolean; }) {
  const { theme: t } = useContext(ThemeCtx);
  return (
    <div onClick={onClick} style={{
      background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 20, padding: 28,
      transition: 'transform 0.2s, box-shadow 0.2s', cursor: onClick ? 'pointer' : 'default',
      ...style,
    }}
      onMouseEnter={hoverEffect ? (e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = `0 12px 32px ${t.accent1}30`;
      } : undefined}
      onMouseLeave={hoverEffect ? (e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      } : undefined}
    >
      {children}
    </div>
  );
}
