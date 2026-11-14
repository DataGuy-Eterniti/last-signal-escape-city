import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Flame, ArrowLeft, ArrowRight, RotateCw } from 'lucide-react';
import { ControllerInput, RoomConnectionState } from '../types';
import { ControllerNetwork } from '../network/webrtc';
import { isValidRoomCode } from '../utils/room';
import { GoldBackdrop, Letters } from '../components/Ornaments';

const i = (n: number) => ({ ['--i' as string]: n } as React.CSSProperties);

export const ControllerRoute: React.FC<{ onExit?: () => void }> = ({ onExit }) => {
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


  // Portrait hint (cockpit is designed for landscape; dismissible, never blocks input)
  const [portrait, setPortrait] = useState<boolean>(() => window.innerHeight > window.innerWidth);
  const [hintDismissed, setHintDismissed] = useState<boolean>(false);
  useEffect(() => {
    const onResize = () => setPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const codeValid = isValidRoomCode(inputRoomCode);

  // Render Room Code Entry if not connected
  if (!activeRoom || networkState.status === 'disconnected' || networkState.status === 'error') {
    return (
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: 24,
          touchAction: 'manipulation',
          overflowX: 'hidden',
          overflowY: 'auto'
        }}
      >
        <GoldBackdrop glowX="50%" glowY="30%" size={420} />

        {onExit && (
          <button
            onClick={onExit}
            className="glass-light reveal-fade"
            aria-label="Back"
            style={{ ...i(0), position: 'absolute', top: 18, left: 18, width: 40, height: 40, display: 'grid', placeItems: 'center', color: 'var(--gold-pale)', cursor: 'pointer', zIndex: 2 }}
          >
            <ArrowLeft size={16} />
          </button>
        )}

        <div style={{ position: 'relative', zIndex: 2, maxWidth: 380, width: '100%', textAlign: 'center', margin: 'auto 0' }}>
          <span className="kicker reveal" style={i(1)}>
            Controller
          </span>
          <div className="hairline reveal" style={{ ...i(2), margin: '14px auto 18px', background: 'linear-gradient(90deg, transparent, var(--gold-pale), transparent)', width: 60 }} />
          <h1 className="serif gold-text" style={{ fontSize: 'clamp(40px, min(15vw, 13vh), 64px)', lineHeight: 0.9, fontWeight: 400 }}>
            <Letters text="Take the" />
            <br />
            <Letters text="wheel" />
          </h1>
          <p className="serif reveal" style={{ ...i(5), fontStyle: 'italic', fontSize: 18, color: 'var(--gold-pale)', margin: '18px 0 26px' }}>
            Enter the room code shown on the game screen.
          </p>

          <div className="glass reveal" style={{ ...i(6), padding: 22 }}>
            <input
              type="text"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              maxLength={6}
              value={inputRoomCode}
              onChange={(e) => setInputRoomCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && codeValid) connectToRoom(inputRoomCode);
              }}
              placeholder="K7R9"
              aria-label="Room code"
              className="serif num"
              style={{
                width: '100%',
                fontSize: 44,
                textAlign: 'center',
                letterSpacing: '0.35em',
                padding: '10px 0 10px 0.35em',
                border: 'none',
                borderBottom: '1px solid var(--line-strong)',
                background: 'transparent',
                color: 'var(--gold)',
                outline: 'none',
                marginBottom: 20,
                userSelect: 'text',
                WebkitUserSelect: 'text'
              }}
            />

            <button className="btn btn-gold" onClick={() => connectToRoom(inputRoomCode)} disabled={!codeValid} style={{ width: '100%' }}>
              Connect to game <ArrowRight size={16} className="btn-arrow" />
            </button>

            {networkState.status === 'error' && (
              <p style={{ marginTop: 14, fontSize: 12, color: '#e9a06a', lineHeight: 1.5 }}>
                Couldn’t reach that room. Check the code and that both devices share the same Wi-Fi.
              </p>
            )}
          </div>

          <p className="reveal" style={{ ...i(8), fontSize: 11, color: 'var(--dim)', marginTop: 18 }}>
            Tip: scanning the QR code on the laptop fills this in for you.
          </p>
        </div>
      </div>
    );
  }

  const connected = networkState.status === 'connected';

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'radial-gradient(120% 100% at 50% 0%, #2a190b 0%, #140c06 55%, #0d0804 100%)',
        touchAction: 'none',
        overflow: 'hidden',
        userSelect: 'none'
      }}
    >
      <div className="grain" />

      {/* Top status bar */}
      <header
        className="reveal-fade"
        style={{
          ...i(0),
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 18px',
          borderBottom: '1px solid var(--line)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => {
              networkRef.current?.destroy();
              setActiveRoom(null);
            }}
            aria-label="Leave room"
            style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <ArrowLeft size={18} />
          </button>
          <span className="serif" style={{ fontSize: 18, color: 'var(--gold-pale)', fontStyle: 'italic' }}>
            Last Signal
          </span>
          <span className="kicker num" style={{ fontSize: 10, color: 'var(--gold)' }}>
            Room {activeRoom}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
          <span className={`dot ${connected ? 'ok' : ''}`} />
          <span className="kicker num" style={{ fontSize: 10, color: connected ? 'var(--gold-pale)' : 'var(--muted)' }}>
            {connected ? `Linked · ${networkState.pingMs} ms` : 'Connecting…'}
          </span>
        </div>
      </header>

      {/* Cockpit */}
      <main style={{ position: 'relative', zIndex: 2, flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', padding: 14, gap: 14 }}>
        {/* Left hand: steering */}
        <section
          className="glass reveal"
          style={{
            ...i(1),
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
            touchAction: 'none'
          }}
          onTouchStart={handleJoystickTouchStart}
          onTouchMove={handleJoystickTouchMove}
          onTouchEnd={handleJoystickTouchEnd}
          onTouchCancel={handleJoystickTouchEnd}
        >
          <span className="kicker" style={{ fontSize: 9, marginBottom: 14 }}>
            Steer
          </span>

          <div
            style={{
              width: 156,
              height: 156,
              borderRadius: '50%',
              position: 'relative',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              background: 'radial-gradient(circle at 50% 40%, #2c1c0d 0%, #140c06 75%)',
              boxShadow: 'inset 0 0 0 1px rgba(241,216,168,0.22), inset 0 8px 30px rgba(0,0,0,0.6), 0 0 0 8px rgba(255,195,77,0.04)'
            }}
          >
            {/* Track ticks */}
            <div style={{ position: 'absolute', left: 18, right: 18, top: '50%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(241,216,168,0.25), transparent)' }} />
            {[-1, -0.5, 0, 0.5, 1].map((t) => (
              <span key={t} style={{ position: 'absolute', top: 'calc(50% - 5px)', left: `calc(50% + ${t * 52}px)`, width: 1, height: 10, background: 'rgba(241,216,168,0.3)' }} />
            ))}

            {/* Thumb */}
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 30%, #fff1c4, #ffc34d 55%, #b9771f)',
                boxShadow: `0 0 ${10 + Math.abs(steerDisplay) * 22}px rgba(255,195,77,${0.35 + Math.abs(steerDisplay) * 0.4}), inset 0 -3px 6px rgba(90,50,10,0.5)`,
                transform: `translateX(${steerDisplay * 48}px)`,
                transition: steerDisplay === 0 ? 'transform 0.12s ease-out' : 'none'
              }}
            />
          </div>

          <div className="serif" style={{ marginTop: 14, fontSize: 16, color: 'var(--gold-pale)', fontStyle: 'italic', minHeight: 20 }}>
            {steerDisplay < -0.1 ? 'Left' : steerDisplay > 0.1 ? 'Right' : 'Centre'}
          </div>
        </section>

        {/* Right hand: nitro, brake, gas */}
        <section style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 14 }}>
          <button
            className="reveal"
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
              ...i(2),
              flex: 1,
              borderRadius: 'var(--radius)',
              border: '1px solid rgba(255,195,77,0.45)',
              background: isNitroPressed
                ? 'linear-gradient(180deg, #fff1c4, #ffc34d)'
                : 'linear-gradient(160deg, rgba(255,195,77,0.14), rgba(255,195,77,0.04))',
              color: isNitroPressed ? '#2a1808' : 'var(--gold)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              cursor: 'pointer',
              boxShadow: isNitroPressed ? '0 0 34px rgba(255,195,77,0.7)' : 'inset 0 1px 0 rgba(255,230,180,0.08)',
              transform: isNitroPressed ? 'scale(0.98)' : 'none',
              transition: 'background 120ms, box-shadow 120ms, transform 120ms'
            }}
          >
            <Flame size={20} />
            <span className="serif" style={{ fontSize: 24, letterSpacing: '0.12em' }}>
              NITRO
            </span>
          </button>

          <div style={{ flex: 2, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {/* Brake / reverse */}
            <button
              className="reveal"
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
                ...i(3),
                borderRadius: 'var(--radius)',
                border: '1px solid rgba(194,98,45,0.55)',
                background: isBrakePressed
                  ? 'linear-gradient(180deg, #e0834a, #9c451c)'
                  : 'linear-gradient(160deg, rgba(194,98,45,0.18), rgba(96,62,30,0.12))',
                color: isBrakePressed ? '#fff3e2' : '#e9a06a',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                boxShadow: isBrakePressed ? '0 0 26px rgba(224,131,74,0.55)' : 'none',
                transform: isBrakePressed ? 'scale(0.97)' : 'none',
                transition: 'background 120ms, box-shadow 120ms, transform 120ms'
              }}
            >
              <span className="serif" style={{ fontSize: 24 }}>
                Brake
              </span>
              <span className="kicker" style={{ fontSize: 8, color: 'inherit', opacity: 0.75 }}>
                Reverse
              </span>
            </button>

            {/* Gas */}
            <button
              className="reveal"
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
                ...i(4),
                borderRadius: 'var(--radius)',
                border: '1px solid rgba(241,216,168,0.45)',
                background: isGasPressed
                  ? 'linear-gradient(180deg, #ffd479, #ffc34d 55%, #d9952b)'
                  : 'linear-gradient(160deg, rgba(241,216,168,0.16), rgba(241,216,168,0.04))',
                color: isGasPressed ? '#2a1808' : 'var(--gold-pale)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                boxShadow: isGasPressed ? '0 0 30px rgba(255,195,77,0.6)' : 'none',
                transform: isGasPressed ? 'scale(0.97)' : 'none',
                transition: 'background 120ms, box-shadow 120ms, transform 120ms'
              }}
            >
              <span className="serif" style={{ fontSize: 28 }}>
                Gas
              </span>
              <span className="kicker" style={{ fontSize: 8, color: 'inherit', opacity: 0.75 }}>
                Accelerate
              </span>
            </button>
          </div>
        </section>
      </main>

      {/* Rotate hint */}
      {portrait && !hintDismissed && (
        <button
          onClick={() => setHintDismissed(true)}
          className="glass-light"
          style={{
            position: 'absolute',
            bottom: 18,
            left: '50%',
            zIndex: 5,
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: 'var(--gold-pale)',
            animation: 'toastIn 500ms var(--ease-out) both',
            cursor: 'pointer'
          }}
        >
          <RotateCw size={14} /> Turn your phone sideways for the best grip · tap to hide
        </button>
      )}
    </div>
  );
};
