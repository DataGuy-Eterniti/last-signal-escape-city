import React, { useState, useEffect } from 'react';
import { GameRoute } from './routes/GameRoute';
import { ControllerRoute } from './routes/ControllerRoute';
import { Monitor, Smartphone, Zap } from 'lucide-react';

export const App: React.FC = () => {
  const [route, setRoute] = useState<'game' | 'controller' | 'menu'>('menu');

  useEffect(() => {
    const updateRoute = () => {
      const pathname = window.location.pathname.toLowerCase();
      const params = new URLSearchParams(window.location.search);
      const mode = params.get('mode')?.toLowerCase();

      if (pathname.includes('/controller') || mode === 'controller' || params.has('room')) {
        setRoute('controller');
      } else if (pathname.includes('/game') || mode === 'game') {
        setRoute('game');
      } else {
        // Detect mobile user agent for smart default
        const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
          setRoute('controller');
        } else {
          setRoute('game');
        }
      }
    };

    updateRoute();
    window.addEventListener('popstate', updateRoute);
    return () => window.removeEventListener('popstate', updateRoute);
  }, []);

  if (route === 'game') {
    return <GameRoute />;
  }

  if (route === 'controller') {
    return <ControllerRoute />;
  }

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0e17',
        color: '#f8fafc',
        padding: 24
      }}
    >
      <div
        style={{
          maxWidth: 440,
          width: '100%',
          background: '#0f172a',
          border: '2px solid #00f0ff',
          borderRadius: 16,
          padding: 36,
          textAlign: 'center',
          boxShadow: '0 0 35px rgba(0, 240, 255, 0.2)'
        }}
      >
        <Zap size={40} color="#00f0ff" style={{ margin: '0 auto 12px' }} />
        <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: 3, color: '#00f0ff', marginBottom: 6 }}>
          LAST SIGNAL
        </h1>
        <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 28 }}>
          ESCAPE THE CITY — DUAL SCREEN SYSTEM
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <button
            onClick={() => {
              window.history.pushState({}, '', '/game');
              setRoute('game');
            }}
            style={{
              padding: '16px 20px',
              borderRadius: 10,
              border: '1px solid #38bdf8',
              background: '#0284c7',
              color: '#ffffff',
              fontSize: 15,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10
            }}
          >
            <Monitor size={18} />
            OPEN GAME SCREEN (LAPTOP)
          </button>

          <button
            onClick={() => {
              window.history.pushState({}, '', '/controller');
              setRoute('controller');
            }}
            style={{
              padding: '16px 20px',
              borderRadius: 10,
              border: '1px solid #334155',
              background: '#1e293b',
              color: '#f8fafc',
              fontSize: 15,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10
            }}
          >
            <Smartphone size={18} />
            OPEN CONTROLLER (PHONE)
          </button>
        </div>
      </div>
    </div>
  );
};
