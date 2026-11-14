import React, { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Smartphone, Wifi, Keyboard, QrCode } from 'lucide-react';
import { ControllerInput, NetworkPacket, RoomConnectionState, VehicleState } from '../types';
import { createInitialVehicle, updateVehicle } from '../engine/physics';
import { renderGame } from '../engine/renderer';
import { GameHostNetwork } from '../network/webrtc';
import { generateRoomCode } from '../utils/room';

export const GameRoute: React.FC = () => {
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
      }
    });

    host.init();

    return () => {
      host.destroy();
    };
  }, [roomCode]);

  // 2. Keyboard fallback listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysDownRef.current[e.code] = true;
      setKeyboardActive(true);

      // Shortcut to toggle pairing modal
      if (e.code === 'KeyP') {
        setShowPairingModal((prev) => !prev);
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

  // 3. Game Simulation & Render Loop (Fixed Timestep 60Hz)
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.1); // clamp dt to prevent giant physics jumps
      lastTime = currentTime;

      const keys = keysDownRef.current;
      const kbdSteer = (keys['ArrowRight'] || keys['KeyD'] ? 1 : 0) - (keys['ArrowLeft'] || keys['KeyA'] ? 1 : 0);
      const kbdThrottle = (keys['ArrowUp'] || keys['KeyW'] ? 1 : 0);
      const kbdBrake = (keys['ArrowDown'] || keys['KeyS'] ? 1 : 0);
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
      } else {
        effectiveInput = activeInputRef.current;
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
  const speedKmh = Math.round(Math.abs(vehicleRef.current.speed) * 0.36);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* 60 FPS HTML5 Canvas */}
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />

      {/* Cyberpunk Top HUD Header */}
      <header
        style={{
          position: 'absolute',
          top: 16,
          left: 20,
          right: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pointerEvents: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid #00f0ff',
              borderRadius: 8,
              padding: '6px 14px',
              boxShadow: '0 0 15px rgba(0, 240, 255, 0.2)',
              pointerEvents: 'auto'
            }}
          >
            <h1 style={{ fontSize: 16, fontWeight: 800, letterSpacing: 2, color: '#00f0ff', margin: 0 }}>
              LAST SIGNAL
            </h1>
            <span style={{ fontSize: 10, color: '#94a3b8', letterSpacing: 1 }}>ESCAPE THE CITY</span>
          </div>

          {/* Connection Status Pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(15, 23, 42, 0.85)',
              border: `1px solid ${networkState.status === 'connected' ? '#10b981' : '#f59e0b'}`,
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 12,
              color: '#f8fafc',
              pointerEvents: 'auto'
            }}
          >
            <Wifi size={14} color={networkState.status === 'connected' ? '#10b981' : '#f59e0b'} />
            <span>
              {networkState.status === 'connected'
                ? `PHONE CONNECTED (${networkState.pingMs}ms)`
                : `ROOM ${roomCode} (WAITING FOR PHONE)`}
            </span>
          </div>
        </div>

        {/* Pairing / QR Code Button */}
        <button
          onClick={() => setShowPairingModal((prev) => !prev)}
          style={{
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid #38bdf8',
            color: '#38bdf8',
            borderRadius: 8,
            padding: '8px 14px',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            pointerEvents: 'auto'
          }}
        >
          <QrCode size={14} />
          {showPairingModal ? 'Hide QR Code' : 'Connect Android'}
        </button>
      </header>

      {/* Cyberpunk Telemetry HUD Bottom-Left */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: 24,
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid #1e293b',
          borderRadius: 10,
          padding: '14px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 36, fontWeight: 900, color: '#00f0ff', fontFamily: 'monospace' }}>
            {speedKmh}
          </span>
          <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 700 }}>KM/H</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b' }}>
          <Keyboard size={12} color={keyboardActive ? '#00f0ff' : '#64748b'} />
          <span>WASD / Arrows to drive {keyboardActive ? '(Active)' : ''} | Shift for Nitro</span>
        </div>
      </div>

      {/* Pairing QR Code Modal Overlay */}
      {showPairingModal && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(10, 14, 23, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 100
          }}
        >
          <div
            style={{
              background: '#0f172a',
              border: '2px solid #00f0ff',
              borderRadius: 16,
              padding: 32,
              maxWidth: 420,
              width: '90%',
              textAlign: 'center',
              boxShadow: '0 0 35px rgba(0, 240, 255, 0.25)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <Smartphone size={36} color="#00f0ff" />
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#f8fafc', marginBottom: 6 }}>
              PAIR ANDROID CONTROLLER
            </h2>
            <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 20 }}>
              Scan with your Android camera or open the link. No download or app login required.
            </p>

            {/* QR Code Container */}
            <div
              style={{
                display: 'inline-block',
                background: '#ffffff',
                padding: 14,
                borderRadius: 12,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                marginBottom: 16
              }}
            >
              <QRCodeSVG value={controllerUrl} size={180} />
            </div>

            {/* Room Code Badge */}
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>ROOM CODE</span>
              <span
                style={{
                  fontSize: 26,
                  fontWeight: 900,
                  letterSpacing: 4,
                  color: '#38bdf8',
                  background: '#1e293b',
                  padding: '6px 16px',
                  borderRadius: 8,
                  fontFamily: 'monospace'
                }}
              >
                {roomCode}
              </span>
            </div>

            <div style={{ fontSize: 11, color: '#94a3b8', wordBreak: 'break-all', marginBottom: 20 }}>
              <a
                href={controllerUrl}
                target="_blank"
                rel="noreferrer"
                style={{ color: '#00f0ff', textDecoration: 'none' }}
              >
                {controllerUrl}
              </a>
            </div>

            <button
              onClick={() => setShowPairingModal(false)}
              style={{
                background: '#00f0ff',
                color: '#0f172a',
                border: 'none',
                borderRadius: 8,
                padding: '10px 24px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                width: '100%'
              }}
            >
              Start Driving with Keyboard (Press P to re-open)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
