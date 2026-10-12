import { useContext, useEffect } from 'react';
import { useAppData } from '@/context/DataContext';
import Nav from '@/components/Nav';
import Hero from '@/components/Hero';
import About from '@/components/About';
import Leaderboard from '@/components/Leaderboard';
import DailyLog from '@/components/DailyLog';
import Milestones from '@/components/Milestones';
import WeeklyGraph from '@/components/WeeklyGraph';
import Seasons from '@/components/Seasons';
import Gallery from '@/components/Gallery';
import Certificate from '@/components/Certificate';
import RunCalendar from '@/components/RunCalendar';
import Footer from '@/components/Footer';
import AdminPage from '@/pages/AdminPage';
import HealthTips from '@/components/HealthTips';
import { ThemeProvider, ThemeCtx } from '@/themes/context';
import { DataProvider } from '@/context/DataContext';
import { MotionRoot, ScrollProgress } from '@/motion/Motion';

function AppBody() {
  const { theme: t } = useContext(ThemeCtx);
  const { data } = useAppData();

  useEffect(() => {
    const name = data.settings.project_name;
    if (name) document.title = `${name} — โรงเรียนอนุสรณ์ศุภมาศ`;
  }, [data.settings.project_name]);

  return (
    <MotionRoot level={data.settings.motion_level} style={{ background:t.bg, minHeight:'100vh', color:t.text, fontFamily:'Sarabun, sans-serif' }}>
      <ScrollProgress color={`linear-gradient(90deg,${t.accent1},${t.accent2},${t.accent3})`} />
      <Nav />
      <Hero />
      <About />
      <Leaderboard />
      <DailyLog />
      <Milestones />
      <WeeklyGraph />
      <RunCalendar />
      <Seasons />
      <HealthTips />
      <Certificate />
      <Gallery />
      <Footer />
    </MotionRoot>
  );
}

function Router() {
  const path = window.location.pathname;
  if (path === '/adminpp' || path.startsWith('/adminpp/')) {
    return <AdminPage />;
  }
  return (
    <ThemeProvider>
      <DataProvider>
        <AppBody />
      </DataProvider>
    </ThemeProvider>
  );
}

export default function App() {
  return <Router />;
}
