import { useState, useEffect, useContext } from 'react';
import { ThemeCtx } from '@/themes/context';
import { useAppData } from '@/context/DataContext';

export default function Nav() {
  const { theme: t, mode, toggle } = useContext(ThemeCtx);
  const { data, sync, syncing, loading } = useAppData();
  const [scrolled, setScroll] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  useEffect(() => {
    const h = () => setScroll(window.scrollY > 40);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);

  const handleSync = async () => {
    setSyncMsg('');
    try {
      const result = await sync();
      setSyncMsg('sync ' + result.synced + '/' + result.total + ' คน');
    } catch (err) {
      setSyncMsg((err as Error).message);
    }
    setTimeout(() => setSyncMsg(''), 4000);
  };

  const links = [
    { href: '#about', label: 'โครงการ' },
    { href: '#leaderboard', label: 'อันดับ' },
    { href: '#milestones', label: 'รางวัล' },
    { href: '#journey', label: 'การเดินทาง' },
    { href: '#seasons', label: 'Season' },
    { href: '#gallery', label: 'ภาพกิจกรรม' },
  ];

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      backdropFilter: 'blur(16px)',
      background: scrolled ? t.navBg : 'transparent',
      borderBottom: scrolled ? `1px solid ${t.cardBorder}` : 'none',
      transition: 'all 0.3s', height: 64,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <img src="/logo.png" alt="AS-Run Logo"
          style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${t.accent1}66` }} />
        <span style={{ fontFamily: 'Bebas Neue', fontSize: 18, color: t.accent1, letterSpacing: 2 }}>
          450K TEACHER'S SPIRIT
        </span>
      </div>
      <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
        {links.map(l => (
          <a key={l.href} href={l.href}
            style={{ color: t.textMuted, fontSize: 13, fontWeight: 500, textDecoration: 'none', transition: 'color 0.2s' }}
            onMouseEnter={e => (e.target as HTMLElement).style.color = t.accent1}
            onMouseLeave={e => (e.target as HTMLElement).style.color = t.textMuted}
          >
            {l.label}
          </a>
        ))}
        {(loading || syncing || syncMsg) && (
          <span style={{ fontSize: 12, color: t.textMuted, whiteSpace: 'nowrap' }}>
            {syncing ? 'กำลัง sync...' : loading ? 'โหลด...' : syncMsg}
          </span>
        )}
        {data.isMockData && !loading && (
          <span style={{
            fontSize: 11, color: '#f59e0b',
            background: 'rgba(245,158,11,0.15)',
            border: '1px solid rgba(245,158,11,0.4)',
            borderRadius: 999, padding: '2px 8px',
          }}>Mock Data</span>
        )}
        <button onClick={handleSync} disabled={syncing || loading}
          style={{
            background: syncing ? t.progressBg : `linear-gradient(135deg,${t.accent1},${t.accent2})`,
            border: 'none', borderRadius: 999,
            padding: '6px 14px', cursor: syncing ? 'not-allowed' : 'pointer',
            color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'Sarabun',
            opacity: syncing ? 0.6 : 1, transition: 'opacity 0.2s',
          }}
        >Sync Strava</button>
        <button onClick={toggle}
          style={{
            background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 999,
            padding: '6px 14px', cursor: 'pointer', color: t.text, fontSize: 14, fontFamily: 'Sarabun',
          }}
        >{mode === 'dark' ? '☀️' : '🌙'}</button>
      </div>
    </nav>
  );
}
