import { useContext } from 'react';
import Nav from '@/components/Nav';
import Hero from '@/components/Hero';
import About from '@/components/About';
import Leaderboard from '@/components/Leaderboard';
import Milestones from '@/components/Milestones';
import Journey from '@/components/Journey';
import WeeklyGraph from '@/components/WeeklyGraph';
import Seasons from '@/components/Seasons';
import Gallery from '@/components/Gallery';
import Footer from '@/components/Footer';
import { ThemeProvider, ThemeCtx } from '@/themes/context';
import { DataProvider } from '@/context/DataContext';

function AppBody() {
  const { theme: t } = useContext(ThemeCtx);
  return (
    <div style={{ background:t.bg, minHeight:'100vh', color:t.text, fontFamily:'Sarabun, sans-serif' }}>
      <Nav />
      <Hero />
      <About />
      <Leaderboard />
      <Milestones />
      <Journey />
      <WeeklyGraph />
      <Seasons />
      <Gallery />
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <DataProvider>
        <AppBody />
      </DataProvider>
    </ThemeProvider>
  );
}
