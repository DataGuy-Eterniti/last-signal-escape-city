import { Peer, DataConnection } from 'peerjs';
import { ControllerInput, NetworkPacket, RoomConnectionState } from '../types';
import { derivePeerId } from '../utils/room';

export type MessageHandler = (data: NetworkPacket) => void;
export type StateChangeHandler = (state: RoomConnectionState) => void;

/**
 * Host Manager for /game route (Laptop)
 * Creates the room and accepts incoming WebRTC connection from Android controller
 */
export class GameHostNetwork {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private onMessage: MessageHandler;
  private onStateChange: StateChangeHandler;
  private roomCode: string;
  private pingInterval: number | null = null;
  private pingSeq = 0;

  private state: RoomConnectionState = {
    status: 'disconnected',
    roomId: null,
    pingMs: 0,
    packetsReceived: 0,
    lastPacketTime: 0
  };

  constructor(roomCode: string, onMessage: MessageHandler, onStateChange: StateChangeHandler) {
    this.roomCode = roomCode;
    this.onMessage = onMessage;
    this.onStateChange = onStateChange;
  }

  public init() {
    this.updateState({ status: 'connecting', roomId: this.roomCode });

    const hostPeerId = derivePeerId(this.roomCode);
    this.peer = new Peer(hostPeerId, {
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });

    this.peer.on('open', (id) => {
      console.log('[WebRTC Host] Room opened with Peer ID:', id);
      this.updateState({ status: 'connecting', roomId: this.roomCode });
    });

    this.peer.on('connection', (conn) => {
      console.log('[WebRTC Host] Controller connected:', conn.peer);
      // Close any previous active connection
      if (this.connection) {
        this.connection.close();
      }
      this.connection = conn;
      this.setupConnection(conn);
    });

    this.peer.on('error', (err) => {
      console.error('[WebRTC Host] Error:', err);
      this.updateState({ status: 'error', errorMessage: err.message });
    });

    this.peer.on('disconnected', () => {
      console.warn('[WebRTC Host] Disconnected from signaling server');
      this.updateState({ status: 'reconnecting' });
      this.peer?.reconnect();
    });
  }

  private setupConnection(conn: DataConnection) {
    conn.on('open', () => {
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
        const rtt = Date.now() - packet.timestamp;
        this.updateState({ pingMs: rtt });
        return;
      }

      this.onMessage(packet);
    });

    conn.on('close', () => {
      console.log('[WebRTC Host] Controller DataChannel closed');
      this.stopPingLoop();
      this.connection = null;
      this.updateState({ status: 'connecting', pingMs: 0 });
    });

    conn.on('error', (err) => {
      console.error('[WebRTC Host] Connection error:', err);
      this.updateState({ status: 'error', errorMessage: err.message });
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
    this.stopPingLoop();
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.updateState({ status: 'disconnected', roomId: null });
  }
}

/**
 * Controller Client Manager for /controller route (Android)
 * Connects to the host peer via room code
 */
export class ControllerNetwork {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private onStateChange: StateChangeHandler;
  private roomCode: string;

  private state: RoomConnectionState = {
    status: 'disconnected',
    roomId: null,
    pingMs: 0,
    packetsReceived: 0,
    lastPacketTime: 0
  };

  constructor(roomCode: string, onStateChange: StateChangeHandler) {
    this.roomCode = roomCode;
    this.onStateChange = onStateChange;
  }

  public connect() {
    this.updateState({ status: 'connecting', roomId: this.roomCode });

    // Client gets an ephemeral random peer ID
    this.peer = new Peer({
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });

    this.peer.on('open', (id) => {
      console.log('[WebRTC Controller] Client Peer ID:', id);
      const hostPeerId = derivePeerId(this.roomCode);
      console.log('[WebRTC Controller] Connecting to Host:', hostPeerId);

      const conn = this.peer!.connect(hostPeerId, {
        reliable: false // Unreliable low-latency UDP for realtime gaming controls
      });

      this.setupConnection(conn);
    });

    this.peer.on('error', (err) => {
      console.error('[WebRTC Controller] Peer error:', err);
      this.updateState({ status: 'error', errorMessage: err.message });
    });
  }

  private setupConnection(conn: DataConnection) {
    this.connection = conn;

    conn.on('open', () => {
      console.log('[WebRTC Controller] Connected to Host game screen');
      this.updateState({ status: 'connected' });
    });

    conn.on('data', (rawData) => {
      const packet = rawData as NetworkPacket;
      if ('type' in packet && packet.type === 'ping') {
        // Immediately reply with pong for RTT latency measurement
        conn.send({
          type: 'pong',
          seq: packet.seq,
          timestamp: packet.timestamp
        });
      }
    });

    conn.on('close', () => {
      console.log('[WebRTC Controller] Connection closed');
      this.updateState({ status: 'disconnected', pingMs: 0 });
    });

    conn.on('error', (err) => {
      console.error('[WebRTC Controller] Conn error:', err);
      this.updateState({ status: 'error', errorMessage: err.message });
    });
  }

  public sendInput(input: ControllerInput) {
    if (this.connection && this.connection.open) {
      this.connection.send(input);
    }
  }

  private updateState(partial: Partial<RoomConnectionState>) {
    this.state = { ...this.state, ...partial };
    this.onStateChange({ ...this.state });
  }

  public destroy() {
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.updateState({ status: 'disconnected', roomId: null });
  }
}
