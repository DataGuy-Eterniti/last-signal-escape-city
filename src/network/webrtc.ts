import { Peer, DataConnection } from 'peerjs';
import { ControllerInput, NetworkPacket, RoomConnectionState } from '../types';
import { derivePeerId } from '../utils/room';

export type MessageHandler = (data: NetworkPacket) => void;
export type StateChangeHandler = (state: RoomConnectionState) => void;

/**
 * Robust ICE servers configuration:
 * Combines Google Public STUN, PeerJS Cloud TURN, and Open Relay Public TURN.
 * Traverses local Wi-Fi, mDNS masking, carrier-grade NAT, and symmetric cellular firewalls.
 */
export const ICE_SERVERS: RTCIceServer[] = [
  // Google Public STUN
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },

  // PeerJS Official Cloud TURN Servers (Built-in free tier)
  {
    urls: [
      'turn:eu-0.turn.peerjs.com:3478',
      'turn:us-0.turn.peerjs.com:3478'
    ],
    username: 'peerjs',
    credential: 'peerjsp'
  },

  // Open Relay Project Public Free STUN/TURN (Global fallback over UDP and TCP port 443)
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  }
];

/**
 * Host Manager for /game route (Laptop)
 * Creates the room on the PeerJS cloud and accepts incoming WebRTC connection from phone.
 */
export class GameHostNetwork {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private onMessage: MessageHandler;
  private onStateChange: StateChangeHandler;
  private roomCode: string;
  private pingInterval: number | null = null;
  private pingSeq = 0;
  private isDestroyed = false;

  private state: RoomConnectionState = {
    status: 'disconnected',
    roomId: null,
    pingMs: 0,
    packetsReceived: 0,
    lastPacketTime: 0
  };

  constructor(roomCode: string, onMessage: MessageHandler, onStateChange: StateChangeHandler) {
    this.roomCode = roomCode.trim().toUpperCase();
    this.onMessage = onMessage;
    this.onStateChange = onStateChange;
  }

  public init() {
    this.isDestroyed = false;
    this.updateState({ status: 'connecting', roomId: this.roomCode });

    const hostPeerId = derivePeerId(this.roomCode);
    console.log(`[WebRTC Host] Initializing Peer with ID: ${hostPeerId} for room: ${this.roomCode}`);

    this.peer = new Peer(hostPeerId, {
      debug: 2, // Informative logs
      config: {
        iceServers: ICE_SERVERS,
        iceCandidatePoolSize: 2
      }
    });

    this.peer.on('open', (id) => {
      if (this.isDestroyed) return;
      console.log(`[WebRTC Host] Successfully registered with signaling server. Peer ID: ${id}`);
      this.updateState({ status: 'connecting', roomId: this.roomCode });
    });

    this.peer.on('connection', (conn) => {
      if (this.isDestroyed) {
        conn.close();
        return;
      }
      console.log(`[WebRTC Host] Incoming connection request from phone client: ${conn.peer}`);

      // Close previous stale connection if one exists
      if (this.connection) {
        try {
          this.connection.close();
        } catch {
          /* safe ignore */
        }
      }

      this.connection = conn;
      this.setupConnection(conn);
    });

    this.peer.on('error', (err: any) => {
      if (this.isDestroyed) return;
      console.error('[WebRTC Host] Signaling Error:', err?.type, err?.message);

      if (err?.type === 'unavailable-id') {
        this.updateState({
          status: 'error',
          errorMessage: `Room code ${this.roomCode} is already registered on the signaling server.`
        });
      } else {
        this.updateState({
          status: 'error',
          errorMessage: err?.message || 'Host signaling error'
        });
      }
    });

    this.peer.on('disconnected', () => {
      if (this.isDestroyed) return;
      console.warn('[WebRTC Host] Disconnected from signaling server — reconnecting...');
      this.updateState({ status: 'reconnecting' });
      try {
        this.peer?.reconnect();
      } catch (e) {
        console.error('[WebRTC Host] Reconnect failed:', e);
      }
    });
  }

  private setupConnection(conn: DataConnection) {
    // Monitor ICE connection state transitions on the underlying RTCPeerConnection
    const pc = conn.peerConnection;
    if (pc) {
      pc.oniceconnectionstatechange = () => {
        console.log(`[WebRTC Host] ICE State: ${pc.iceConnectionState}`);
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          console.log('[WebRTC Host] WebRTC ICE handshake completed successfully');
        } else if (pc.iceConnectionState === 'failed') {
          console.warn('[WebRTC Host] ICE failed — attempting ICE restart');
          if (pc.restartIce) pc.restartIce();
        }
      };

      pc.onconnectionstatechange = () => {
        console.log(`[WebRTC Host] PeerConnection State: ${pc.connectionState}`);
      };
    }

    conn.on('open', () => {
      if (this.isDestroyed) return;
      console.log('[WebRTC Host] DataChannel opened with phone controller');
      this.updateState({ status: 'connected' });
      this.startPingLoop();
    });

    conn.on('data', (rawData) => {
      const packet = rawData as NetworkPacket;
      this.state.packetsReceived++;
      this.state.lastPacketTime = Date.now();

      // Handle pong from phone
      if ('type' in packet && packet.type === 'pong') {
        const rtt = Math.max(1, Date.now() - packet.timestamp);
        this.updateState({ pingMs: rtt });
        return;
      }

      this.onMessage(packet);
    });

    conn.on('close', () => {
      console.log('[WebRTC Host] Controller DataChannel closed');
      this.stopPingLoop();
      this.connection = null;
      if (!this.isDestroyed) {
        this.updateState({ status: 'connecting', pingMs: 0 });
      }
    });

    conn.on('error', (err) => {
      console.error('[WebRTC Host] Connection error:', err);
      if (!this.isDestroyed) {
        this.updateState({ status: 'error', errorMessage: err?.message || 'DataChannel error' });
      }
    });
  }

  private startPingLoop() {
    this.stopPingLoop();
    this.pingInterval = window.setInterval(() => {
      if (this.connection && this.connection.open) {
        this.pingSeq++;
        this.connection.send({
          type: 'ping',
          seq: this.pingSeq,
          timestamp: Date.now()
        });
      }
    }, 1000);
  }

  private stopPingLoop() {
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private updateState(partial: Partial<RoomConnectionState>) {
    this.state = { ...this.state, ...partial };
    this.onStateChange({ ...this.state });
  }

  public destroy() {
    this.isDestroyed = true;
    this.stopPingLoop();
    if (this.connection) {
      try {
        this.connection.close();
      } catch {
        /* safe ignore */
      }
      this.connection = null;
    }
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {
        /* safe ignore */
      }
      this.peer = null;
    }
    this.updateState({ status: 'disconnected', roomId: null });
  }
}

/**
 * Controller Client Manager for /controller route (Android)
 * Connects to the host peer via room code over WebRTC DataChannel.
 */
export class ControllerNetwork {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private onStateChange: StateChangeHandler;
  private roomCode: string;
  private watchdogTimer: number | null = null;
  private isDestroyed = false;

  private state: RoomConnectionState = {
    status: 'disconnected',
    roomId: null,
    pingMs: 0,
    packetsReceived: 0,
    lastPacketTime: 0
  };

  constructor(roomCode: string, onStateChange: StateChangeHandler) {
    this.roomCode = roomCode.trim().toUpperCase();
    this.onStateChange = onStateChange;
  }

  public connect() {
    this.isDestroyed = false;
    this.updateState({ status: 'connecting', roomId: this.roomCode, errorMessage: undefined });

    console.log(`[WebRTC Controller] Creating client peer to connect to room: ${this.roomCode}`);

    // Client gets an ephemeral random peer ID from signaling server
    this.peer = new Peer({
      debug: 2, // Informative logs
      config: {
        iceServers: ICE_SERVERS,
        iceCandidatePoolSize: 2
      }
    });

    this.peer.on('open', (clientId) => {
      if (this.isDestroyed) return;
      console.log(`[WebRTC Controller] Registered with signaling server. Client Peer ID: ${clientId}`);

      const hostPeerId = derivePeerId(this.roomCode);
      console.log(`[WebRTC Controller] Initiating DataChannel connection to Host: ${hostPeerId}`);

      // Connect with reliable: true and json serialization to guarantee reliable handshake completion
      const conn = this.peer!.connect(hostPeerId, {
        reliable: true,
        serialization: 'json'
      });

      this.setupConnection(conn);
      this.startWatchdog(conn);
    });

    this.peer.on('error', (err: any) => {
      if (this.isDestroyed) return;
      console.error('[WebRTC Controller] Peer Error:', err?.type, err?.message);
      this.stopWatchdog();

      if (err?.type === 'peer-unavailable') {
        this.updateState({
          status: 'error',
          errorMessage: `Room ${this.roomCode} not found. Please verify the room code on your laptop screen.`
        });
      } else {
        this.updateState({
          status: 'error',
          errorMessage: err?.message || 'Connection to signaling server failed'
        });
      }
    });

    this.peer.on('disconnected', () => {
      if (this.isDestroyed) return;
      console.warn('[WebRTC Controller] Disconnected from signaling server');
      try {
        this.peer?.reconnect();
      } catch {
        /* safe ignore */
      }
    });
  }

  private setupConnection(conn: DataConnection) {
    this.connection = conn;

    const pc = conn.peerConnection;
    if (pc) {
      pc.oniceconnectionstatechange = () => {
        console.log(`[WebRTC Controller] ICE State: ${pc.iceConnectionState}`);
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          console.log('[WebRTC Controller] ICE connection established');
        } else if (pc.iceConnectionState === 'failed') {
          console.warn('[WebRTC Controller] ICE connection failed — attempting ICE restart');
          if (pc.restartIce) pc.restartIce();
        }
      };

      pc.onconnectionstatechange = () => {
        console.log(`[WebRTC Controller] PeerConnection State: ${pc.connectionState}`);
      };
    }

    conn.on('open', () => {
      if (this.isDestroyed) return;
      this.stopWatchdog();
      console.log('[WebRTC Controller] Connected to Host game screen! DataChannel is open.');
      this.updateState({ status: 'connected', errorMessage: undefined });
    });

    conn.on('data', (rawData) => {
      const packet = rawData as NetworkPacket;
      if ('type' in packet && packet.type === 'ping') {
        // Immediately reply with pong for RTT latency measurement
        if (conn.open) {
          conn.send({
            type: 'pong',
            seq: packet.seq,
            timestamp: packet.timestamp
          });
        }
      }
    });

    conn.on('close', () => {
      console.log('[WebRTC Controller] Connection closed');
      this.stopWatchdog();
      if (!this.isDestroyed) {
        this.updateState({ status: 'disconnected', pingMs: 0 });
      }
    });

    conn.on('error', (err) => {
      console.error('[WebRTC Controller] Conn error:', err);
      this.stopWatchdog();
      if (!this.isDestroyed) {
        this.updateState({ status: 'error', errorMessage: err?.message || 'Connection error' });
      }
    });
  }

  private startWatchdog(conn: DataConnection) {
    this.stopWatchdog();
    // 9-second connection watchdog: if ICE negotiation or handshake hangs, report actionable state
    this.watchdogTimer = window.setTimeout(() => {
      if (!this.isDestroyed && (!conn.open || this.state.status !== 'connected')) {
        const iceState = conn.peerConnection?.iceConnectionState;
        console.warn(`[WebRTC Controller] Connection timed out after 9s. ICE State: ${iceState}`);

        if (iceState === 'checking' || iceState === 'failed') {
          this.updateState({
            status: 'error',
            errorMessage: 'Connecting took too long (NAT/firewall block). Ensure both devices have internet access.'
          });
        } else {
          this.updateState({
            status: 'error',
            errorMessage: `Room ${this.roomCode} is not responding. Please check that the laptop game is open.`
          });
        }
      }
    }, 9000);
  }

  private stopWatchdog() {
    if (this.watchdogTimer !== null) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  public sendInput(input: ControllerInput) {
    if (this.connection && this.connection.open) {
      try {
        this.connection.send(input);
      } catch (err) {
        console.error('[WebRTC Controller] Error sending input:', err);
      }
    }
  }

  private updateState(partial: Partial<RoomConnectionState>) {
    this.state = { ...this.state, ...partial };
    this.onStateChange({ ...this.state });
  }

  public destroy() {
    this.isDestroyed = true;
    this.stopWatchdog();
    if (this.connection) {
      try {
        this.connection.close();
      } catch {
        /* safe ignore */
      }
      this.connection = null;
    }
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {
        /* safe ignore */
      }
      this.peer = null;
    }
    this.updateState({ status: 'disconnected', roomId: null });
  }
}
