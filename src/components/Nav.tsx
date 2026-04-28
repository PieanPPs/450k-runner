import { useState, useEffect, useContext } from 'react';
import { ThemeCtx } from '@/themes/context';
import { useAppData } from '@/context/DataContext';

export default function Nav() {
  const { theme: t, mode, toggle } = useContext(ThemeCtx);
  const { data, sync, syncing, loading } = useAppData();
  const [scrolled, setScroll] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const h = () => setScroll(window.scrollY > 40);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);

  // ปิด menu เมื่อ scroll
  useEffect(() => {
    if (menuOpen) setMenuOpen(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrolled]);

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
    { href: '#about',      label: 'โครงการ' },
    { href: '#leaderboard',label: 'อันดับ' },
    { href: '#milestones', label: 'รางวัล' },
    { href: '#journey',    label: 'การเดินทาง' },
    { href: '#seasons',    label: 'Season' },
    { href: '#gallery',    label: 'ภาพกิจกรรม' },
  ];

  const linkStyle = (base?: object) => ({
    color: t.textMuted, fontSize: 13, fontWeight: 500,
    textDecoration: 'none', transition: 'color 0.2s', ...base,
  });

  return (
    <>
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        backdropFilter: 'blur(16px)',
        background: scrolled || menuOpen ? t.navBg : 'transparent',
        borderBottom: scrolled || menuOpen ? `1px solid ${t.cardBorder}` : 'none',
        transition: 'all 0.3s', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo.png" alt="AS-Run Logo"
            style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${t.accent1}66` }} />
          <span style={{ fontFamily: 'Bebas Neue', fontSize: 18, color: t.accent1, letterSpacing: 2 }}>
            450K TEACHER'S SPIRIT
          </span>
        </div>

        {/* Desktop links */}
        <div className="nav-desktop" style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          {links.map(l => (
            <a key={l.href} href={l.href} style={linkStyle()}
              onMouseEnter={e => (e.target as HTMLElement).style.color = t.accent1}
              onMouseLeave={e => (e.target as HTMLElement).style.color = t.textMuted}
            >{l.label}</a>
          ))}
          <NavActions t={t} mode={mode} toggle={toggle} syncing={syncing} loading={loading} syncMsg={syncMsg} isMockData={data.isMockData} handleSync={handleSync} />
        </div>

        {/* Mobile right side */}
        <div className="nav-mobile" style={{ display: 'none', alignItems: 'center', gap: 8 }}>
          {/* Dark mode toggle */}
          <button onClick={toggle}
            style={{ background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 999, padding: '6px 12px', cursor: 'pointer', color: t.text, fontSize: 14, fontFamily: 'Sarabun' }}
          >{mode === 'dark' ? '☀️' : '🌙'}</button>

          {/* Hamburger button */}
          <button
            onClick={() => setMenuOpen(o => !o)}
            aria-label="เมนู"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', flexDirection: 'column', gap: 5, justifyContent: 'center' }}
          >
            <span style={{ display: 'block', width: 22, height: 2, background: t.text, borderRadius: 2, transition: 'all 0.3s', transform: menuOpen ? 'translateY(7px) rotate(45deg)' : 'none' }} />
            <span style={{ display: 'block', width: 22, height: 2, background: t.text, borderRadius: 2, transition: 'all 0.3s', opacity: menuOpen ? 0 : 1 }} />
            <span style={{ display: 'block', width: 22, height: 2, background: t.text, borderRadius: 2, transition: 'all 0.3s', transform: menuOpen ? 'translateY(-7px) rotate(-45deg)' : 'none' }} />
          </button>
        </div>
      </nav>

      {/* Mobile dropdown menu */}
      <div className="nav-mobile" style={{
        display: 'none',
        position: 'fixed', top: 64, left: 0, right: 0, zIndex: 99,
        background: t.navBg, backdropFilter: 'blur(16px)',
        borderBottom: menuOpen ? `1px solid ${t.cardBorder}` : 'none',
        maxHeight: menuOpen ? 400 : 0,
        overflow: 'hidden',
        transition: 'max-height 0.3s ease, border-bottom 0.3s',
      }}>
        <div style={{ padding: '12px 24px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {links.map(l => (
            <a key={l.href} href={l.href}
              onClick={() => setMenuOpen(false)}
              style={{ color: t.text, fontSize: 15, fontWeight: 500, textDecoration: 'none', padding: '10px 0', borderBottom: `1px solid ${t.cardBorder}` }}
            >{l.label}</a>
          ))}
          <div style={{ paddingTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {data.isMockData && !loading && (
              <span style={{ fontSize: 11, color: '#f59e0b', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 999, padding: '2px 8px' }}>Mock Data</span>
            )}
            {(syncing || syncMsg) && (
              <span style={{ fontSize: 12, color: t.textMuted }}>{syncing ? 'กำลัง sync...' : syncMsg}</span>
            )}
            <button onClick={() => { handleSync(); setMenuOpen(false); }} disabled={syncing || loading}
              style={{ background: syncing ? t.progressBg : `linear-gradient(135deg,${t.accent1},${t.accent2})`, border: 'none', borderRadius: 999, padding: '8px 18px', cursor: syncing ? 'not-allowed' : 'pointer', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'Sarabun', opacity: syncing ? 0.6 : 1 }}
            >Sync Strava</button>
          </div>
        </div>
      </div>

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 768px) {
          .nav-desktop { display: none !important; }
          .nav-mobile  { display: flex !important; }
        }
      `}</style>
    </>
  );
}

function NavActions({ t, mode, toggle, syncing, loading, syncMsg, isMockData, handleSync }: {
  t: any; mode: string; toggle: () => void;
  syncing: boolean; loading: boolean; syncMsg: string;
  isMockData: boolean; handleSync: () => void;
}) {
  return (
    <>
      {(loading || syncing || syncMsg) && (
        <span style={{ fontSize: 12, color: t.textMuted, whiteSpace: 'nowrap' }}>
          {syncing ? 'กำลัง sync...' : loading ? 'โหลด...' : syncMsg}
        </span>
      )}
      {isMockData && !loading && (
        <span style={{ fontSize: 11, color: '#f59e0b', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 999, padding: '2px 8px' }}>Mock Data</span>
      )}
      <button onClick={handleSync} disabled={syncing || loading}
        style={{ background: syncing ? t.progressBg : `linear-gradient(135deg,${t.accent1},${t.accent2})`, border: 'none', borderRadius: 999, padding: '6px 14px', cursor: syncing ? 'not-allowed' : 'pointer', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'Sarabun', opacity: syncing ? 0.6 : 1, transition: 'opacity 0.2s' }}>
        Sync Strava
      </button>
      <button onClick={toggle}
        style={{ background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 999, padding: '6px 14px', cursor: 'pointer', color: t.text, fontSize: 14, fontFamily: 'Sarabun' }}>
        {mode === 'dark' ? '☀️' : '🌙'}
      </button>
    </>
  );
}
