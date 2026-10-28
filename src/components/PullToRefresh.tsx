import { useEffect, useRef, useState } from 'react';
import { ArrowDown, LoaderCircle } from 'lucide-react';
const threshold = 76;
const mobileQuery = '(pointer: coarse) and (max-width: 1024px)';
const modalIsOpen = () => Boolean(document.querySelector('dialog[open], [aria-modal="true"]'));
export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const [distance, setDistance] = useState(0), [refreshing, setRefreshing] = useState(false);
  const progress = useRef(0), locked = useRef(false);
  useEffect(() => {
    const mobile = window.matchMedia(mobileQuery);
    let gesture: { x: number; y: number; id: number } | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reset = () => { gesture = null; progress.current = 0; if (!locked.current) setDistance(0); };
    const updateEnabled = () => { document.documentElement.classList.toggle('pull-refresh-enabled', mobile.matches); if (!mobile.matches) reset(); };
    const start = (event: TouchEvent) => {
      reset();
      if (!mobile.matches || locked.current || modalIsOpen() || window.scrollY > 1 || event.touches.length !== 1) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], .mobile-nav')) return;
      // Leave independent scroll regions (including search suggestions) alone.
      for (let node = target; node && node !== document.body; node = node.parentElement) {
        if (node instanceof HTMLElement && /auto|scroll/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight + 1) return;
      }
      const touch = event.touches[0]; gesture = { x: touch.clientX, y: touch.clientY, id: touch.identifier };
    };
    const move = (event: TouchEvent) => {
      if (!gesture) return;
      if (!mobile.matches || locked.current || modalIsOpen() || event.touches.length !== 1 || window.scrollY > 1) { reset(); return; }
      const touch = event.touches[0];
      if (touch.identifier !== gesture.id) { reset(); return; }
      const y = touch.clientY - gesture.y, x = Math.abs(touch.clientX - gesture.x);
      if (y < -8 || (x > 12 && x > Math.abs(y))) { reset(); return; }
      if (y < 8 || y <= x) { progress.current = 0; setDistance(0); return; }
      if (event.cancelable) event.preventDefault();
      progress.current = Math.min(108, y * .45); setDistance(progress.current);
    };
    const end = () => {
      if (!gesture) return;
      if (progress.current < threshold || modalIsOpen() || !mobile.matches || locked.current) { reset(); return; }
      gesture = null; locked.current = true; setRefreshing(true); setDistance(threshold);
      // Keep the loader visible briefly, then do a true document reload, including
      // the Supabase session and data fetch. No cached React state survives.
      timer = setTimeout(() => window.location.reload(), 450);
    };
    const observer = new MutationObserver(() => { if (modalIsOpen()) reset(); });
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open', 'aria-modal'] });
    updateEnabled(); mobile.addEventListener('change', updateEnabled);
    document.addEventListener('touchstart', start, { passive: true });
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', end, { passive: true });
    document.addEventListener('touchcancel', reset, { passive: true });
    return () => {
      observer.disconnect(); mobile.removeEventListener('change', updateEnabled);
      document.removeEventListener('touchstart', start); document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', end); document.removeEventListener('touchcancel', reset);
      document.documentElement.classList.remove('pull-refresh-enabled');
      if (timer) clearTimeout(timer);
    };
  }, []);
  const active = distance > 8 || refreshing, ready = distance >= threshold;
  return <>{children}<div className={`pull-refresh-indicator ${active ? 'visible' : ''}`} role="status" aria-live="polite" aria-hidden={!active} data-state={refreshing ? 'refreshing' : ready ? 'ready' : 'pulling'} style={{ transform: `translate(-50%, ${Math.max(-65, distance - 62)}px)` }}>
    {refreshing ? <LoaderCircle className="spin" size={22} /> : <ArrowDown size={22} style={{ transform: `rotate(${ready ? 180 : 0}deg)` }} />}
    <span>{refreshing ? 'Aggiornamento in corso…' : ready ? 'Rilascia per aggiornare' : 'Tira per aggiornare'}</span>
  </div></>;
}
