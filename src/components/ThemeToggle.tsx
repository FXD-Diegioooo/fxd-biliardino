import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
type Theme = 'light' | 'dark';
const key = 'fuoricampo-theme';
function preferred(): Theme {
  try { const saved = localStorage.getItem(key); if (saved === 'dark' || saved === 'light') return saved; } catch { /* System theme still works without storage. */ }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(preferred);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#101827' : '#fffefa');
  }, [theme]);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const change = () => setTheme(preferred());
    media.addEventListener('change', change);
    window.addEventListener('storage', change);
    return () => { media.removeEventListener('change', change); window.removeEventListener('storage', change); };
  }, []);
  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(key, next); } catch { /* Apply for this session even if storage is unavailable. */ }
    setTheme(next);
  }
  return <button type="button" className="icon-button theme-toggle" onClick={toggle} aria-label={theme === 'dark' ? 'Attiva tema chiaro' : 'Attiva tema scuro'} title={theme === 'dark' ? 'Tema chiaro' : 'Tema scuro'}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>;
}
