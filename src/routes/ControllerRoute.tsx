import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Wifi, Zap, Flame, ArrowLeft } from 'lucide-react';
import { ControllerInput, RoomConnectionState } from '../types';
import { ControllerNetwork } from '../network/webrtc';
import { isValidRoomCode } from '../utils/room';

export const ControllerRoute: React.FC = () => {
  // Read room from URL query param
  const getQueryRoom = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room') || '';
  };

  const [inputRoomCode, setInputRoomCode] = useState<string>(getQueryRoom());
  const [activeRoom, setActiveRoom] = useState<string | null>(getQueryRoom() || null);
  const [networkState, setNetworkState] = useState<RoomConnectionState>({
    status: 'disconnected',
    roomId: null,
    pingMs: 0,
    packetsReceived: 0,
    lastPacketTime: 0
  });

  const networkRef = useRef<ControllerNetwork | null>(null);
  const seqRef = useRef<number>(0);

  // Live touch state values
  const steerRef = useRef<number>(0);       // -1.0 to 1.0
  const throttleRef = useRef<number>(0);    // 0.0 to 1.0
  const brakeRef = useRef<number>(0);       // 0.0 to 1.0
  const nitroRef = useRef<boolean>(false);

  // Visual UI feedback states
  const [isGasPressed, setIsGasPressed] = useState<boolean>(false);
  const [isBrakePressed, setIsBrakePressed] = useState<boolean>(false);
  const [isNitroPressed, setIsNitroPressed] = useState<boolean>(false);
  const [steerDisplay, setSteerDisplay] = useState<number>(0);

  // Joystick touch tracking
  const joystickTouchIdRef = useRef<number | null>(null);
  const joystickCenterRef = useRef<{ x: number; y: number } | null>(null);

  // Connect to Host WebRTC Room
  const connectToRoom = useCallback((roomToJoin: string) => {
    if (!isValidRoomCode(roomToJoin)) return;

    if (networkRef.current) {
      networkRef.current.destroy();
    }

    setActiveRoom(roomToJoin.toUpperCase());
    const client = new ControllerNetwork(roomToJoin, (state) => {
      setNetworkState(state);
    });
    networkRef.current = client;
    client.connect();
  }, []);

  // Auto-connect if room is present in URL
  useEffect(() => {
    const urlRoom = getQueryRoom();
    if (urlRoom && isValidRoomCode(urlRoom)) {
      connectToRoom(urlRoom);
    }

    return () => {
      networkRef.current?.destroy();
    };
  }, [connectToRoom]);

  // Transmit inputs at 25 Hz (every 40ms)
  useEffect(() => {
    const timer = setInterval(() => {
      if (networkRef.current && networkState.status === 'connected') {
        seqRef.current++;
        const packet: ControllerInput = {
          steer: steerRef.current,
          throttle: throttleRef.current,
          brake: brakeRef.current,
          nitro: nitroRef.current,
          seq: seqRef.current,
          timestamp: Date.now()
        };
        networkRef.current.sendInput(packet);
      }
    }, 40);

    return () => clearInterval(timer);
  }, [networkState.status]);

  // Virtual Joystick Touch Handlers
  const handleJoystickTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.changedTouches[0];
    joystickTouchIdRef.current = touch.identifier;
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    joystickCenterRef.current = { x: centerX, y: centerY };

    updateJoystickPosition(touch.clientX, rect.width / 2);
  };

  const handleJoystickTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (joystickTouchIdRef.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === joystickTouchIdRef.current) {
        const rect = e.currentTarget.getBoundingClientRect();
        updateJoystickPosition(touch.clientX, rect.width / 2);
        break;
      }
    }
  };

  const handleJoystickTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickTouchIdRef.current) {
        joystickTouchIdRef.current = null;
        steerRef.current = 0;
        setSteerDisplay(0);
        break;
      }
    }
  };

  const updateJoystickPosition = (clientX: number, radius: number) => {
    if (!joystickCenterRef.current) return;
    const deltaX = clientX - joystickCenterRef.current.x;
    const normalized = Math.max(-1, Math.min(1, deltaX / (radius * 0.75)));
    steerRef.current = normalized;
    setSteerDisplay(normalized);
  };

  // Trigger safe device vibration
  const triggerHaptic = (ms: number = 25) => {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(ms);
      } catch (e) {
        // Safe ignore
      }
    }
  };

  // Render Room Code Entry if not connected
  if (!activeRoom || networkState.status === 'disconnected' || networkState.status === 'error') {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b0f19',
          padding: 24,
          touchAction: 'none'
        }}
      >
        <div
          style={{
            maxWidth: 360,
            width: '100%',
            background: '#111827',
            border: '2px solid #00f0ff',
            borderRadius: 16,
            padding: 28,
            textAlign: 'center',
            boxShadow: '0 0 25px rgba(0, 240, 255, 0.2)'
          }}
        >
          <Zap size={32} color="#00f0ff" style={{ margin: '0 auto 12px' }} />
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#f8fafc', marginBottom: 4 }}>
            LAST SIGNAL CONTROLLER
          </h2>
          <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 20 }}>
            Enter the 4-character Room Code displayed on your laptop game screen:
          </p>

          <input
            type="text"
            maxLength={6}
            value={inputRoomCode}
            onChange={(e) => setInputRoomCode(e.target.value.toUpperCase())}
            placeholder="e.g. K7R9"
            style={{
              width: '100%',
              fontSize: 28,
              fontWeight: 900,
              textAlign: 'center',
              letterSpacing: 4,
              padding: '12px 16px',
              borderRadius: 8,
              border: '2px solid #38bdf8',
              background: '#1e293b',
              color: '#f8fafc',
              marginBottom: 16,
              fontFamily: 'monospace'
            }}
          />

          <button
            onClick={() => connectToRoom(inputRoomCode)}
            disabled={!isValidRoomCode(inputRoomCode)}
            style={{
              width: '100%',
              padding: '14px 20px',
              borderRadius: 8,
              border: 'none',
              background: isValidRoomCode(inputRoomCode) ? '#00f0ff' : '#334155',
              color: isValidRoomCode(inputRoomCode) ? '#0f172a' : '#64748b',
              fontSize: 14,
              fontWeight: 800,
              cursor: isValidRoomCode(inputRoomCode) ? 'pointer' : 'not-allowed'
            }}
          >
            CONNECT TO GAME
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#090d16',
        touchAction: 'none',
        overflow: 'hidden',
        userSelect: 'none'
      }}
    >
      {/* Top Status Bar */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 20px',
          background: 'rgba(15, 23, 42, 0.95)',
          borderBottom: '1px solid #1e293b'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => {
              networkRef.current?.destroy();
              setActiveRoom(null);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <ArrowLeft size={18} />
          </button>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#00f0ff', letterSpacing: 1 }}>
            ROOM: {activeRoom}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <Wifi size={14} color={networkState.status === 'connected' ? '#10b981' : '#f59e0b'} />
          <span style={{ color: networkState.status === 'connected' ? '#10b981' : '#f59e0b', fontWeight: 700 }}>
            {networkState.status === 'connected' ? 'CONNECTED' : 'CONNECTING...'}
          </span>
        </div>
      </header>

      {/* Main Dual-Cockpit Touch Controller Area */}
      <main
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          padding: 16,
          gap: 16
        }}
      >
        {/* Left Hand: Horizontal Steering Wheel / Thumbstick */}
        <section
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            background: 'rgba(15, 23, 42, 0.6)',
            borderRadius: 16,
            border: '1px solid #1e293b',
            position: 'relative',
            touchAction: 'none'
          }}
          onTouchStart={handleJoystickTouchStart}
          onTouchMove={handleJoystickTouchMove}
          onTouchEnd={handleJoystickTouchEnd}
          onTouchCancel={handleJoystickTouchEnd}
        >
          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 16, letterSpacing: 1 }}>
            TOUCH STEERING
          </span>

          {/* Steering Visual Disc */}
          <div
            style={{
              width: 140,
              height: 140,
              borderRadius: '50%',
              border: '3px solid #334155',
              background: 'radial-gradient(circle, #1e293b 0%, #0f172a 100%)',
              position: 'relative',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              boxShadow: 'inset 0 0 15px rgba(0,0,0,0.5)'
            }}
          >
            {/* Center Thumb Marker */}
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: '50%',
                background: '#00f0ff',
                boxShadow: '0 0 16px rgba(0, 240, 255, 0.6)',
                transform: `translateX(${steerDisplay * 45}px)`,
                transition: steerDisplay === 0 ? 'transform 0.1s ease-out' : 'none'
              }}
            />
          </div>

          <div style={{ marginTop: 16, fontSize: 11, color: '#38bdf8', fontFamily: 'monospace' }}>
            {steerDisplay < -0.1 ? 'LEFT' : steerDisplay > 0.1 ? 'RIGHT' : 'CENTER'}
          </div>
        </section>

        {/* Right Hand: Accelerator (Gas), Brake / Reverse, Nitro */}
        <section
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 12
          }}
        >
          {/* Nitro Boost Button (Top Right) */}
          <button
            onTouchStart={() => {
              nitroRef.current = true;
              setIsNitroPressed(true);
              triggerHaptic(40);
            }}
            onTouchEnd={() => {
              nitroRef.current = false;
              setIsNitroPressed(false);
            }}
            style={{
              flex: 1,
              background: isNitroPressed ? '#ff0055' : 'rgba(255, 0, 85, 0.2)',
              border: '2px solid #ff0055',
              borderRadius: 14,
              color: '#ffffff',
              fontSize: 16,
              fontWeight: 900,
              letterSpacing: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: 'pointer',
              boxShadow: isNitroPressed ? '0 0 25px rgba(255, 0, 85, 0.7)' : 'none'
            }}
          >
            <Flame size={20} />
            NITRO
          </button>

          {/* Gas & Brake Pedals (Bottom Right) */}
          <div style={{ flex: 2, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* Brake / Reverse Pedal */}
            <button
              onTouchStart={() => {
                brakeRef.current = 1.0;
                throttleRef.current = 0.0;
                setIsBrakePressed(true);
                triggerHaptic(20);
              }}
              onTouchEnd={() => {
                brakeRef.current = 0.0;
                setIsBrakePressed(false);
              }}
              style={{
                background: isBrakePressed ? '#ef4444' : 'rgba(239, 68, 68, 0.2)',
                border: '2px solid #ef4444',
                borderRadius: 14,
                color: '#ffffff',
                fontSize: 15,
                fontWeight: 900,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                boxShadow: isBrakePressed ? '0 0 20px rgba(239, 68, 68, 0.6)' : 'none'
              }}
            >
              <span>BRAKE</span>
              <span style={{ fontSize: 10, color: '#fca5a5' }}>REVERSE</span>
            </button>

            {/* Gas / Accelerate Pedal */}
            <button
              onTouchStart={() => {
                throttleRef.current = 1.0;
                brakeRef.current = 0.0;
                setIsGasPressed(true);
                triggerHaptic(20);
              }}
              onTouchEnd={() => {
                throttleRef.current = 0.0;
                setIsGasPressed(false);
              }}
              style={{
                background: isGasPressed ? '#10b981' : 'rgba(16, 185, 129, 0.2)',
                border: '2px solid #10b981',
                borderRadius: 14,
                color: '#ffffff',
                fontSize: 16,
                fontWeight: 900,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                boxShadow: isGasPressed ? '0 0 20px rgba(16, 185, 129, 0.6)' : 'none'
              }}
            >
              <span>GAS</span>
              <span style={{ fontSize: 10, color: '#a7f3d0' }}>ACCEL</span>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};
