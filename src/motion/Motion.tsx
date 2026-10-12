/**
 * Motion helpers — ใช้คู่กับ src/styles/motion.css
 *
 * <MotionRoot level>   ใส่ data-motion ให้ทั้งหน้า (full | subtle | off) + เคารพ prefers-reduced-motion
 * <Reveal>             ใส่ .is-in เมื่อเลื่อนมาถึง → เล่น scroll-reveal / soft-rise / stagger ของลูก
 * <CountUp>            カウントアップ — นับเลขขึ้นแบบ easeOutExpo, ตัวเลขกว้างคงที่ (tabular-nums)
 * useFlip()            FLIP並べ替え — แถวเลื่อนไปตำแหน่งใหม่อย่างนุ่มนวลเมื่อลำดับเปลี่ยน
 * <ScrollProgress>     スクロール進捗 — แถบความคืบหน้าการเลื่อนหน้า
 */
import {
  createContext, useContext, useEffect, useLayoutEffect, useRef, useState,
} from 'react';
import type { CSSProperties, ElementType, ReactNode } from 'react';

export type MotionLevel = 'full' | 'subtle' | 'off';

const MotionCtx = createContext<MotionLevel>('full');
export const useMotionLevel = () => useContext(MotionCtx);

function usePrefersReducedMotion() {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(query).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const h = () => setReduced(mq.matches);
    mq.addEventListener?.('change', h);
    return () => mq.removeEventListener?.('change', h);
  }, []);
  return reduced;
}

export function MotionRoot({ level, children, style }: { level?: string; children: ReactNode; style?: CSSProperties }) {
  const reduced = usePrefersReducedMotion();
  const lv: MotionLevel = reduced ? 'off' : level === 'off' || level === 'subtle' ? level : 'full';
  return (
    <MotionCtx.Provider value={lv}>
      <div data-motion={lv} style={style}>{children}</div>
    </MotionCtx.Provider>
  );
}

/** true เมื่อ element เลื่อนเข้ามาใน viewport (ครั้งเดียว) */
export function useInView<T extends Element>(opts: { once?: boolean; rootMargin?: string } = {}) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  const { once = true, rootMargin = '0px 0px -12% 0px' } = opts;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    // อยู่ในจออยู่แล้วตอน mount (เช่น hero) → เล่นเลย ไม่ต้องรอ observer รอบแรก
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) {
      setInView(true);
      if (once) return;
    }
    // observer ปกติจะตอบรอบแรกทันทีในเฟรมถัดไป — ถ้าเงียบ (แท็บซ่อน/เบราว์เซอร์มีปัญหา) ให้แสดงเนื้อหาเลย
    // กันกรณีเนื้อหาค้างที่ opacity 0
    let answered = false;
    const failsafe = window.setTimeout(() => { if (!answered) setInView(true); }, 1500);
    const io = new IntersectionObserver(([entry]) => {
      answered = true;
      if (entry.isIntersecting) {
        setInView(true);
        if (once) io.disconnect();
      } else if (!once) setInView(false);
    }, { rootMargin, threshold: 0.12 });
    io.observe(el);
    return () => { io.disconnect(); window.clearTimeout(failsafe); };
  }, [once, rootMargin]);
  return [ref, inView] as const;
}

type RevealProps = {
  as?: ElementType;
  /** scroll-reveal (ค่าเริ่มต้น) | soft-rise | fade-slide | group = ไม่ขยับตัวเอง ให้ลูก (.m-item) เล่น stagger */
  variant?: 'scroll-reveal' | 'soft-rise' | 'fade-slide' | 'group';
  /** ลูกเรียงแบบ grid → ใช้ grid-wave แทน list-stagger */
  grid?: boolean;
  delay?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  [rest: string]: unknown;
};

export function Reveal({ as: Tag = 'div', variant = 'scroll-reveal', grid, delay, className = '', style, children, ...rest }: RevealProps) {
  const [ref, inView] = useInView<HTMLElement>();
  const cls = [
    variant === 'group' ? 'm-group' : `m-reveal m-group ${variant === 'scroll-reveal' ? '' : 'm-' + variant}`,
    grid ? 'm-grid' : '',
    inView ? 'is-in' : '',
    className,
  ].filter(Boolean).join(' ');
  return (
    <Tag ref={ref} className={cls} style={delay ? { ...style, ['--m-delay' as string]: `${delay}ms` } : style} {...rest}>
      {children}
    </Tag>
  );
}

/** style สำหรับลูกใน stagger group: <div className="m-item" style={stagger(i)}> */
export const stagger = (i: number, extra?: CSSProperties): CSSProperties => ({ ...extra, ['--i' as string]: i });

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/**
 * カウントアップ — นับจากค่าที่แสดงอยู่ไปยัง value เมื่อมองเห็น
 * ready=false → แสดง 0 ไว้ก่อน (เช่นยังโหลดข้อมูลไม่เสร็จ)
 */
export function CountUp({ value, format = (n) => String(Math.round(n)), duration = 1100, ready = true, style, className }: {
  value: number; format?: (n: number) => string; duration?: number; ready?: boolean;
  style?: CSSProperties; className?: string;
}) {
  const level = useMotionLevel();
  const [ref, inView] = useInView<HTMLSpanElement>();
  const [shown, setShown] = useState(level === 'off' ? value : 0);
  const shownRef = useRef(shown);
  shownRef.current = shown;

  useEffect(() => {
    if (!ready || !inView) return;
    if (level === 'off') { setShown(value); return; }
    const from = shownRef.current;
    if (from === value) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      setShown(from + (value - from) * easeOutExpo(p));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ready, inView, level, duration]);

  return <span ref={ref} className={`m-num ${className ?? ''}`} style={style}>{format(level === 'off' && ready ? value : shown)}</span>;
}

/**
 * FLIP並べ替え — ลูกที่มี data-flip-key จะเลื่อนจากตำแหน่งเดิมไปตำแหน่งใหม่เมื่อ deps เปลี่ยน
 * container ต้องเป็น position: relative (ใช้ offsetTop จึงไม่เพี้ยนตอนเลื่อนหน้า)
 */
export function useFlip<T extends HTMLElement>(deps: unknown[]) {
  const ref = useRef<T | null>(null);
  const prev = useRef(new Map<string, { x: number; y: number }>());
  const level = useMotionLevel();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const next = new Map<string, { x: number; y: number }>();
    el.querySelectorAll<HTMLElement>(':scope > [data-flip-key]').forEach(child => {
      const key = child.dataset.flipKey!;
      const pos = { x: child.offsetLeft, y: child.offsetTop };
      next.set(key, pos);
      const old = prev.current.get(key);
      if (!old || level === 'off' || typeof child.animate !== 'function') return;
      const dx = old.x - pos.x, dy = old.y - pos.y;
      if (dx === 0 && dy === 0) return;
      child.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
        { duration: 620, easing: 'cubic-bezier(.33, 1, .68, 1)' },
      );
    });
    prev.current = next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}

/** スクロール進捗 — แถบบางด้านบนสุด ยืดตามสัดส่วนที่เลื่อนหน้าไปแล้ว */
export function ScrollProgress({ color }: { color: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      if (ref.current) ref.current.style.transform = `scaleX(${p})`;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return <div ref={ref} className="m-scroll-progress" style={{ background: color }} aria-hidden />;
}
