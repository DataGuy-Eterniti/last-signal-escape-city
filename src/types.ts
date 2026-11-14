export interface ControllerInput {
  steer: number;     // -1.0 (full left) to +1.0 (full right)
  throttle: number;  // 0.0 to 1.0
  brake: number;     // 0.0 to 1.0 (or reverse)
  nitro: boolean;
  seq: number;       // Monotonically increasing sequence number
  timestamp: number; // Client timestamp in ms
}

export interface PingPacket {
  type: 'ping';
  seq: number;
  timestamp: number;
}

export interface PongPacket {
  type: 'pong';
  seq: number;
  timestamp: number;
}

export type NetworkPacket = ControllerInput | PingPacket | PongPacket;

export interface VehicleState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;       // Heading in radians (0 = facing right)
  speed: number;       // Forward speed in px/s
  maxSpeed: number;    // Base max forward speed
  accel: number;       // Acceleration rate
  brakeForce: number;  // Braking deceleration
  friction: number;    // Natural ground drag
  turnSpeed: number;   // Angular turn rate (rad/s)
  isBraking: boolean;
  nitroActive: boolean;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface RoomConnectionState {
  status: ConnectionStatus;
  roomId: string | null;
  pingMs: number;
  packetsReceived: number;
  lastPacketTime: number;
  errorMessage?: string;
}
