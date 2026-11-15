import { Peer, DataConnection } from 'peerjs';
import { ControllerInput, NetworkPacket, RoomConnectionState } from '../types';
import { derivePeerId } from '../utils/room';

export type MessageHandler = (data: NetworkPacket) => void;
export type StateChangeHandler = (state: RoomConnectionState) => void;

/**
 * Verified ICE Servers Configuration:
 * Uses Google Public STUN servers with proven global uptime and sub-second DNS resolution.
 * Unverified, dead, or rate-limited third-party TURN servers are excluded to prevent ICE candidate gathering delays.
 */
export const VERIFIED_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' }
];

/**
 * Host Manager for /game route (Laptop)
 * Creates and registers the room on PeerJS cloud (0.peerjs.com) and accepts incoming connections.
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
    this.updateState({ status: 'connecting', roomId: this.roomCode, errorMessage: undefined });

    const hostPeerId = derivePeerId(this.roomCode);
    console.log(`[WebRTC Host] Attempting registration on signaling server with Peer ID: "${hostPeerId}" (Room: ${this.roomCode})`);

    this.peer = new Peer(hostPeerId, {
      debug: 2,
      config: {
        iceServers: VERIFIED_ICE_SERVERS
      }
    });

    this.peer.on('open', (id) => {
      if (this.isDestroyed) return;
      console.log(`[WebRTC Host] SUCCESS: Host Peer ID "${id}" is live and registered on signaling server.`);
      this.updateState({ status: 'connecting', roomId: this.roomCode, errorMessage: undefined });
    });

    this.peer.on('connection', (conn) => {
      if (this.isDestroyed) {
        conn.close();
        return;
      }
      console.log(`[WebRTC Host] INCOMING connection request from Controller Peer: "${conn.peer}"`);

      // Close previous stale connection if present
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
      console.error(`[WebRTC Host] Peer Error [${err?.type}]:`, err?.message);

      if (err?.type === 'unavailable-id') {
        this.updateState({
          status: 'error',
          errorMessage: `Room ID "${this.roomCode}" is currently locked by a previous session on the signaling server. Reload to acquire a fresh room.`
        });
      } else if (err?.type === 'network' || err?.type === 'server-error') {
        this.updateState({
          status: 'error',
          errorMessage: 'Unable to reach the PeerJS signaling server. Verify internet connection.'
        });
      } else {
        this.updateState({
          status: 'error',
          errorMessage: err?.message || 'Signaling error occurred'
        });
      }
    });

    this.peer.on('disconnected', () => {
      if (this.isDestroyed) return;
      console.warn('[WebRTC Host] Disconnected from signaling server. Attempting reconnect...');
      this.updateState({ status: 'reconnecting' });
      try {
        this.peer?.reconnect();
      } catch (e) {
        console.error('[WebRTC Host] Reconnect failed:', e);
      }
    });
  }

  private setupConnection(conn: DataConnection) {
    const pc = conn.peerConnection;
    if (pc) {
      pc.oniceconnectionstatechange = () => {
        console.log(`[WebRTC Host] ICE Connection State: "${pc.iceConnectionState}"`);
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          console.log('[WebRTC Host] WebRTC direct P2P link established.');
          this.logActiveCandidatePair(pc);
        } else if (pc.iceConnectionState === 'failed') {
          console.warn('[WebRTC Host] ICE negotiation failed. Attempting ICE restart...');
          if (pc.restartIce) pc.restartIce();
        }
      };

      pc.onconnectionstatechange = () => {
        console.log(`[WebRTC Host] Connection State: "${pc.connectionState}"`);
      };
    }

    conn.on('open', () => {
      if (this.isDestroyed) return;
      console.log(`[WebRTC Host] DataChannel OPENED with phone controller "${conn.peer}".`);
      this.updateState({ status: 'connected', errorMessage: undefined });
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
      console.log('[WebRTC Host] Controller DataChannel closed.');
      this.stopPingLoop();
      this.connection = null;
      if (!this.isDestroyed) {
        this.updateState({ status: 'connecting', pingMs: 0 });
      }
    });

    conn.on('error', (err) => {
      console.error('[WebRTC Host] DataChannel Error:', err);
      if (!this.isDestroyed) {
        this.updateState({ status: 'error', errorMessage: err?.message || 'DataChannel error' });
      }
    });
  }

  private async logActiveCandidatePair(pc: RTCPeerConnection) {
    try {
      const stats = await pc.getStats();
      stats.forEach((report) => {
        if (report.type === 'candidate-pair' && (report.state === 'succeeded' || report.nominated)) {
          const local = stats.get(report.localCandidateId);
          const remote = stats.get(report.remoteCandidateId);
          console.log(`[WebRTC Host] Active Candidate Pair: Local=[${local?.candidateType} ${local?.protocol} ${local?.address || local?.ip}:${local?.port}] <--> Remote=[${remote?.candidateType} ${remote?.protocol} ${remote?.address || remote?.ip}:${remote?.port}]`);
        }
      });
    } catch {
      /* safe ignore */
    }
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

    console.log(`[WebRTC Controller] Initializing client peer to connect to room: "${this.roomCode}"`);

    this.peer = new Peer({
      debug: 2,
      config: {
        iceServers: VERIFIED_ICE_SERVERS
      }
    });

    this.peer.on('open', (clientId) => {
      if (this.isDestroyed) return;
      const hostPeerId = derivePeerId(this.roomCode);
      console.log(`[WebRTC Controller] Registered with signaling server (Client ID: "${clientId}"). Connecting to Host ID: "${hostPeerId}"...`);

      const conn = this.peer!.connect(hostPeerId, {
        reliable: true,
        serialization: 'json'
      });

      this.setupConnection(conn);
      this.startWatchdog(conn);
    });

    this.peer.on('error', (err: any) => {
      if (this.isDestroyed) return;
      console.error(`[WebRTC Controller] Peer Error [${err?.type}]:`, err?.message);
      this.stopWatchdog();

      if (err?.type === 'peer-unavailable') {
        this.updateState({
          status: 'error',
          errorMessage: `Room "${this.roomCode}" was not found on the signaling server. Verify the room code on your laptop screen.`
        });
      } else if (err?.type === 'network' || err?.type === 'server-error') {
        this.updateState({
          status: 'error',
          errorMessage: 'Unable to reach the PeerJS signaling server. Check your phone internet connection.'
        });
      } else {
        this.updateState({
          status: 'error',
          errorMessage: err?.message || 'Connection error occurred'
        });
      }
    });

    this.peer.on('disconnected', () => {
      if (this.isDestroyed) return;
      console.warn('[WebRTC Controller] Disconnected from signaling server.');
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
        console.log(`[WebRTC Controller] ICE Connection State: "${pc.iceConnectionState}"`);
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          console.log('[WebRTC Controller] WebRTC direct P2P link established.');
        } else if (pc.iceConnectionState === 'failed') {
          console.warn('[WebRTC Controller] ICE negotiation failed. Attempting ICE restart...');
          if (pc.restartIce) pc.restartIce();
        }
      };

      pc.onconnectionstatechange = () => {
        console.log(`[WebRTC Controller] Connection State: "${pc.connectionState}"`);
      };
    }

    conn.on('open', () => {
      if (this.isDestroyed) return;
      this.stopWatchdog();
      console.log(`[WebRTC Controller] SUCCESS: DataChannel OPENED to host room "${this.roomCode}".`);
      this.updateState({ status: 'connected', errorMessage: undefined });
    });

    conn.on('data', (rawData) => {
      const packet = rawData as NetworkPacket;
      if ('type' in packet && packet.type === 'ping') {
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
      console.log('[WebRTC Controller] DataChannel closed.');
      this.stopWatchdog();
      if (!this.isDestroyed) {
        this.updateState({ status: 'disconnected', pingMs: 0 });
      }
    });

    conn.on('error', (err) => {
      console.error('[WebRTC Controller] DataChannel Error:', err);
      this.stopWatchdog();
      if (!this.isDestroyed) {
        this.updateState({ status: 'error', errorMessage: err?.message || 'DataChannel error' });
      }
    });
  }

  private startWatchdog(conn: DataConnection) {
    this.stopWatchdog();
    // 9-second connection watchdog: detects signaling/ICE stalls and provides exact diagnostics
    this.watchdogTimer = window.setTimeout(() => {
      if (!this.isDestroyed && (!conn.open || this.state.status !== 'connected')) {
        const iceState = conn.peerConnection?.iceConnectionState;
        console.warn(`[WebRTC Controller] Connection timed out after 9s. ICE State: "${iceState}"`);

        if (iceState === 'checking' || iceState === 'failed') {
          this.updateState({
            status: 'error',
            errorMessage: 'Direct peer connection timed out (NAT/firewall block). Both devices must have active internet access.'
          });
        } else {
          this.updateState({
            status: 'error',
            errorMessage: `Room "${this.roomCode}" did not respond. Check that the laptop game is open and active.`
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
