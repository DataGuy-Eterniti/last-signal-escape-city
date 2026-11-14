import React, { useCallback, useEffect, useState } from 'react';
import { GameRoute } from './routes/GameRoute';
import { ControllerRoute } from './routes/ControllerRoute';
import { LandingRoute } from './routes/LandingRoute';

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
      {route === 'game' && <GameRoute onExit={() => navigate('menu')} />}
      {route === 'controller' && <ControllerRoute onExit={() => navigate('menu')} />}
      {route === 'menu' && <LandingRoute onNavigate={navigate} />}
    </div>
  );
};
