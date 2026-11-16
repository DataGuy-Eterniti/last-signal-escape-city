import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { ControllerInput, RoomConnectionState } from '../types';
import { ControllerNetwork } from '../network/webrtc';
import { isValidRoomCode } from '../utils/room';
import { GoldBackdrop, Letters } from '../components/Ornaments';
import { Cockpit } from '../components/controller/Cockpit';

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
                {networkState.errorMessage ?? 'Couldn’t reach that room. Check the code on the laptop and try again.'}
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

  // Gold Noir 2.0 cockpit: 360° stick / D-pad, Classic & Advanced modes, left-handed layout.
  // It only writes the same four input refs the 25 Hz sender above already reads.
  return (
    <Cockpit
      room={activeRoom}
      link={networkState.status === 'connected' ? 'connected' : networkState.status === 'reconnecting' ? 'reconnecting' : 'connecting'}
      pingMs={networkState.pingMs}
      onLeave={() => {
        networkRef.current?.destroy();
        setActiveRoom(null);
      }}
      onInput={(o) => {
        steerRef.current = o.steer;
        throttleRef.current = o.throttle;
        brakeRef.current = o.brake;
        nitroRef.current = o.nitro;
      }}
    />
  );
};
