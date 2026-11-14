import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { LandingRoute } from './routes/LandingRoute';

// Route-level code splitting: the phone only downloads the controller, the
// laptop only downloads the game engine. Keeps first load small on mobile data.
const GameRoute = lazy(() => import('./routes/GameRoute').then((m) => ({ default: m.GameRoute })));
const ControllerRoute = lazy(() => import('./routes/ControllerRoute').then((m) => ({ default: m.ControllerRoute })));

const Loading: React.FC = () => (
  <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
    <span className="kicker" style={{ animation: 'fadeIn 600ms ease both' }}>Tuning the signal…</span>
  </div>
);

export type Route = 'menu' | 'game' | 'controller';

const resolveRoute = (): Route => {
  const pathname = window.location.pathname.toLowerCase();
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode')?.toLowerCase();

  if (pathname.includes('/controller') || mode === 'controller' || params.has('room')) return 'controller';
  if (pathname.includes('/game') || mode === 'game') return 'game';
  return 'menu';
};

const PATHS: Record<Route, string> = { menu: '/', game: '/game', controller: '/controller' };

export const App: React.FC = () => {
  const [route, setRoute] = useState<Route>(resolveRoute);
  const [leaving, setLeaving] = useState(false);

  // Warm the game chunk in idle time while the player reads the title screen
  useEffect(() => {
    if (route !== 'menu') return;
    const t = window.setTimeout(() => {
      void import('./routes/GameRoute');
    }, 1500);
    return () => window.clearTimeout(t);
  }, [route]);

  useEffect(() => {
    const onPop = () => setRoute(resolveRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  /** Cross-fade out, swap route, fade the next screen in (video-style transition). */
  const navigate = useCallback((next: Route) => {
    setLeaving(true);
    window.setTimeout(() => {
      window.history.pushState({}, '', PATHS[next]);
      setRoute(next);
      setLeaving(false);
    }, 320);
  }, []);

  return (
    <div key={route} className={`page${leaving ? ' leaving' : ''}`}>
      <Suspense fallback={<Loading />}>
        {route === 'game' && <GameRoute onExit={() => navigate('menu')} />}
        {route === 'controller' && <ControllerRoute onExit={() => navigate('menu')} />}
      </Suspense>
      {route === 'menu' && <LandingRoute onNavigate={navigate} />}
    </div>
  );
};
