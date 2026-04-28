import { createContext, useEffect, useState, ReactNode } from 'react';
import { ThemeColors } from '@/types';
import { DARK, LIGHT } from '@/themes/colors';

interface ThemeContextValue {
  theme: ThemeColors;
  mode: 'dark'|'light';
  toggle: () => void;
}

export function useCountdown(target: string) {
  const [t, setT] = useState({ d:0,h:0,m:0,s:0 });
  useEffect(() => {
    const tick = () => {
      const d = new Date(target).getTime() - Date.now();
      if (d <= 0) return setT({ d:0,h:0,m:0,s:0 });
      setT({
        d: Math.floor(d/86400000),
        h: Math.floor((d%86400000)/3600000),
        m: Math.floor((d%3600000)/60000),
        s: Math.floor((d%60000)/1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  return t;
}

export const ThemeCtx = createContext<ThemeContextValue>({ theme: DARK, mode:'dark', toggle:()=>{} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<'dark'|'light'>('dark');
  const theme = mode === 'dark' ? DARK : LIGHT;
  const toggle = () => setMode(m => (m === 'dark' ? 'light' : 'dark'));
  return <ThemeCtx.Provider value={{ theme, mode, toggle }}>{children}</ThemeCtx.Provider>;
}
