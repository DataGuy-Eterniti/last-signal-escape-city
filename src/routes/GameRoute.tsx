import React, { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Smartphone, Keyboard, QrCode, X, ArrowLeft, Flame } from 'lucide-react';
import { ControllerInput, NetworkPacket, RoomConnectionState, VehicleState } from '../types';
import { createInitialVehicle, updateVehicle } from '../engine/physics';
import { renderGame } from '../engine/renderer';
import { GameHostNetwork } from '../network/webrtc';
import { generateRoomCode } from '../utils/room';
import { Letters, SpeedArc } from '../components/Ornaments';

const i = (n: number) => ({ ['--i' as string]: n } as React.CSSProperties);
const MAX_KMH = 220;

export const GameRoute: React.FC<{ onExit?: () => void }> = ({ onExit }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Connection and Room state
  const [roomCode] = useState<string>(() => generateRoomCode());
  const [networkState, setNetworkState] = useState<RoomConnectionState>({
    status: 'disconnected',
    roomId: null,
    pingMs: 0,
    packetsReceived: 0,
    lastPacketTime: 0
  });
  const [showPairingModal, setShowPairingModal] = useState<boolean>(true);
  const [keyboardActive, setKeyboardActive] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  // HUD telemetry sampled from the simulation (~12 Hz, keeps React renders cheap)
  const [hud, setHud] = useState({ kmh: 0, nitro: false, source: 'keyboard' as 'keyboard' | 'phone' });
  const inputSourceRef = useRef<'keyboard' | 'phone'>('keyboard');

  // Live game simulation state
  const vehicleRef = useRef<VehicleState>(createInitialVehicle(1000, 1000));
  const activeInputRef = useRef<ControllerInput>({
    steer: 0,
    throttle: 0,
    brake: 0,
    nitro: false,
    seq: 0,
    timestamp: Date.now()
  });

  // Track keyboard state
  const keysDownRef = useRef<{ [key: string]: boolean }>({});
  const lastPacketTimeRef = useRef<number>(0);
  const wasConnectedRef = useRef<boolean>(false);

  // 1. Initialize WebRTC Host
  useEffect(() => {
    const handleNetworkMessage = (packet: NetworkPacket) => {
      if ('steer' in packet) {
        lastPacketTimeRef.current = Date.now();
        activeInputRef.current = packet;
      }
    };

    const host = new GameHostNetwork(roomCode, handleNetworkMessage, (state) => {
      setNetworkState(state);
      if (state.status === 'connected') {
        // Automatically hide pairing dialog once phone connects
        setShowPairingModal(false);
        if (!wasConnectedRef.current) setToast('Phone connected');
        wasConnectedRef.current = true;
      } else if (wasConnectedRef.current && state.status !== 'reconnecting') {
        wasConnectedRef.current = false;
        setToast('Phone disconnected — keyboard active');
      }
    });

    host.init();

    return () => {
      host.destroy();
    };
  }, [roomCode]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(t);
  }, [toast]);

  // 2. Keyboard fallback listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysDownRef.current[e.code] = true;
      setKeyboardActive(true);

      // Shortcut to toggle pairing modal
      if (e.code === 'KeyP') {
        setShowPairingModal((prev) => !prev);
      }
      if (e.code === 'Escape') {
        setShowPairingModal(false);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysDownRef.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // 3. Game Simulation & Render Loop (unchanged logic)
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.1); // clamp dt to prevent giant physics jumps
      lastTime = currentTime;

      const keys = keysDownRef.current;
      const kbdSteer = (keys['ArrowRight'] || keys['KeyD'] ? 1 : 0) - (keys['ArrowLeft'] || keys['KeyA'] ? 1 : 0);
      const kbdThrottle = keys['ArrowUp'] || keys['KeyW'] ? 1 : 0;
      const kbdBrake = keys['ArrowDown'] || keys['KeyS'] ? 1 : 0;
      const kbdNitro = Boolean(keys['ShiftLeft'] || keys['ShiftRight'] || keys['Space']);

      const hasKbdInput = kbdSteer !== 0 || kbdThrottle !== 0 || kbdBrake !== 0 || kbdNitro;
      const phoneInputRecent = Date.now() - lastPacketTimeRef.current < 250;

      // Select active input: prioritize phone if recent, fallback to keyboard
      let effectiveInput: ControllerInput;
      if (hasKbdInput || !phoneInputRecent) {
        effectiveInput = {
          steer: kbdSteer,
          throttle: kbdThrottle,
          brake: kbdBrake,
          nitro: kbdNitro,
          seq: 0,
          timestamp: Date.now()
        };
        inputSourceRef.current = 'keyboard';
      } else {
        effectiveInput = activeInputRef.current;
        inputSourceRef.current = 'phone';
      }

      // Update vehicle physics
      vehicleRef.current = updateVehicle(vehicleRef.current, effectiveInput, dt);

      // Render frame to Canvas 2D
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          renderGame(ctx, canvas.width, canvas.height, vehicleRef.current);
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  // HUD sampler
  useEffect(() => {
    const t = window.setInterval(() => {
      const v = vehicleRef.current;
      setHud({ kmh: Math.round(Math.abs(v.speed) * 0.36), nitro: v.nitroActive, source: inputSourceRef.current });
    }, 80);
    return () => window.clearInterval(t);
  }, []);

  // Resize canvas to window dimensions
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const controllerUrl = `${window.location.origin}/controller?room=${roomCode}`;
  const connected = networkState.status === 'connected';
  const statusText = connected
    ? `Phone linked · ${networkState.pingMs} ms`
    : networkState.status === 'error'
      ? 'Signal error — reload to retry'
      : networkState.status === 'reconnecting'
        ? 'Re-establishing signal…'
        : `Room ${roomCode} · awaiting phone`;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: 'var(--ink-950)' }}>
      {/* 60 FPS HTML5 Canvas */}
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />

      {/* Top HUD */}
      <header
        style={{
          position: 'absolute',
          top: 20,
          left: 24,
          right: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pointerEvents: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {onExit && (
            <button
              onClick={onExit}
              className="glass-light reveal-fade"
              aria-label="Back to menu"
              style={{ ...i(0), pointerEvents: 'auto', width: 40, height: 40, display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--gold-pale)' }}
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div className="reveal" style={i(1)}>
            <div className="serif gold-text" style={{ fontSize: 26, lineHeight: 1, letterSpacing: '0.06em' }}>
              LAST SIGNAL
            </div>
            <div className="kicker" style={{ fontSize: 9, marginTop: 4 }}>
              Escape the city
            </div>
          </div>

          <div
            className="glass-light reveal"
            style={{ ...i(2), display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', marginLeft: 8, pointerEvents: 'auto' }}
          >
            <span className={`dot ${connected ? 'ok' : networkState.status === 'error' ? 'warn' : ''}`} />
            <span style={{ fontSize: 12, color: 'var(--gold-pale)', letterSpacing: '0.04em' }} className="num">
              {statusText}
            </span>
          </div>
        </div>

        <button
          onClick={() => setShowPairingModal((prev) => !prev)}
          className="btn btn-ghost reveal"
          style={{ ...i(3), pointerEvents: 'auto', padding: '10px 18px', background: 'rgba(20,12,6,0.6)' }}
        >
          <QrCode size={15} />
          {showPairingModal ? 'Hide pairing' : connected ? 'Re-pair phone' : 'Pair phone'}
        </button>
      </header>

      {/* Speedometer — bottom left */}
      <div
        className="glass reveal"
        style={{ ...i(4), position: 'absolute', bottom: 24, left: 24, padding: '16px 24px 16px 16px', display: 'flex', alignItems: 'center', gap: 14 }}
      >
        <div style={{ position: 'relative', width: 112, height: 112 }}>
          <SpeedArc value={hud.kmh / MAX_KMH} nitro={hud.nitro} size={112} />
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
            <div>
              <div className="serif num" style={{ fontSize: 38, lineHeight: 1, color: 'var(--cream)' }}>
                {hud.kmh}
              </div>
              <div className="kicker" style={{ fontSize: 8, letterSpacing: '0.28em' }}>
                km/h
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="kicker" style={{ fontSize: 9 }}>
            Driving with
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--gold-pale)', fontSize: 14 }}>
            {hud.source === 'phone' ? <Smartphone size={15} /> : <Keyboard size={15} />}
            <span className="serif" style={{ fontSize: 18 }}>
              {hud.source === 'phone' ? 'Phone' : 'Keyboard'}
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 10,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: hud.nitro ? 'var(--gold)' : 'var(--dim)',
              transition: 'color 200ms'
            }}
          >
            <Flame size={12} /> Nitro {hud.nitro ? 'on' : 'ready'}
          </div>
        </div>
      </div>

      {/* Controls hint — bottom right */}
      <div
        className="glass reveal"
        style={{ ...i(5), position: 'absolute', bottom: 24, right: 24, padding: '14px 18px', display: 'grid', gap: 8, fontSize: 11, color: 'var(--muted)' }}
      >
        {[
          ['W A S D', 'Drive'],
          ['Shift', 'Nitro'],
          ['P', 'Pairing']
        ].map(([k, label]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 22 }}>
            <span style={{ color: keyboardActive ? 'var(--gold-pale)' : 'var(--muted)', letterSpacing: '0.12em' }}>{k}</span>
            <span className="kicker" style={{ fontSize: 9 }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Connection toast */}
      {toast && (
        <div
          className="glass-light"
          style={{
            position: 'absolute',
            top: 84,
            left: '50%',
            padding: '10px 20px',
            fontSize: 13,
            color: 'var(--gold-pale)',
            animation: 'toastIn 500ms var(--ease-out) both',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            zIndex: 50
          }}
        >
          <span className={`dot ${connected ? 'ok' : 'warn'}`} /> {toast}
        </div>
      )}

      {/* Pairing modal */}
      {showPairingModal && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(80% 80% at 50% 40%, rgba(40,24,10,0.72), rgba(10,6,3,0.9))',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 100,
            animation: 'fadeIn 420ms var(--ease-out) both',
            padding: 20
          }}
          onClick={() => setShowPairingModal(false)}
        >
          <div className="rays" style={{ opacity: 0.6 }} />
          <div
            className="glass reveal-scale"
            onClick={(e) => e.stopPropagation()}
            style={{
              ...i(0),
              position: 'relative',
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              gap: 36,
              padding: '36px 40px',
              maxWidth: 760,
              width: '100%',
              borderColor: 'var(--line-strong)'
            }}
          >
            <button
              onClick={() => setShowPairingModal(false)}
              aria-label="Close"
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <span className="kicker reveal" style={i(1)}>
                Pair your controller
              </span>
              <div className="hairline reveal" style={{ ...i(2), margin: '14px 0 16px' }} />
              <h2 className="serif" style={{ fontSize: 44, lineHeight: 1, fontWeight: 400, color: 'var(--cream)' }}>
                <Letters text="Your phone" />
                <br />
                <span className="gold-text">
                  <Letters text="is the wheel" />
                </span>
              </h2>

              <ol style={{ listStyle: 'none', margin: '24px 0 26px', display: 'grid', gap: 12 }}>
                {[
                  'Join the same Wi-Fi as this laptop',
                  'Scan the code with your phone camera',
                  'Turn your phone sideways and drive'
                ].map((t, idx) => (
                  <li key={t} className="reveal" style={{ ...i(4 + idx), display: 'flex', gap: 14, alignItems: 'baseline' }}>
                    <span className="serif num" style={{ color: 'var(--gold)', fontSize: 18, width: 20 }}>
                      {idx + 1}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--gold-pale)' }}>{t}</span>
                  </li>
                ))}
              </ol>

              <div className="reveal" style={{ ...i(7), display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button className="btn btn-gold" onClick={() => setShowPairingModal(false)}>
                  <Keyboard size={15} /> Drive with keyboard
                </button>
              </div>
              <span className="reveal" style={{ ...i(8), fontSize: 11, color: 'var(--dim)', marginTop: 12 }}>
                Press P any time to reopen this panel.
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              {/* QR code (retained) on cream with a gold frame */}
              <div
                className="reveal-scale"
                style={{
                  ...i(3),
                  padding: 14,
                  borderRadius: 16,
                  background: 'var(--cream)',
                  boxShadow: '0 0 0 1px rgba(255,195,77,0.6), 0 0 0 7px rgba(255,195,77,0.08), 0 20px 50px rgba(0,0,0,0.5)'
                }}
              >
                <QRCodeSVG value={controllerUrl} size={188} bgColor="#f6ebd3" fgColor="#1f1206" level="M" />
              </div>

              <div className="reveal" style={{ ...i(5), textAlign: 'center' }}>
                <div className="kicker" style={{ fontSize: 9, marginBottom: 8 }}>
                  Room code
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  {roomCode.split('').map((ch, idx) => (
                    <span
                      key={idx}
                      className="serif reveal-scale num"
                      style={{
                        ...i(6 + idx),
                        width: 42,
                        height: 50,
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 30,
                        color: 'var(--gold)',
                        border: '1px solid var(--line-strong)',
                        borderRadius: 10,
                        background: 'rgba(255,195,77,0.05)'
                      }}
                    >
                      {ch}
                    </span>
                  ))}
                </div>
              </div>

              <a
                href={controllerUrl}
                target="_blank"
                rel="noreferrer"
                className="reveal"
                style={{ ...i(10), fontSize: 10, color: 'var(--muted)', maxWidth: 220, wordBreak: 'break-all', textAlign: 'center', textDecoration: 'none' }}
              >
                {controllerUrl}
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
