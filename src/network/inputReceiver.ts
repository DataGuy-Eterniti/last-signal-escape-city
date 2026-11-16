import { ControllerInput } from '../types';

export const NEUTRAL_INPUT: Readonly<ControllerInput> = Object.freeze({
  steer: 0,
  throttle: 0,
  brake: 0,
  nitro: false,
  seq: 0,
  timestamp: 0
});

/**
 * Host-Side Input Receiver
 *
 * Implements:
 * 1. Monotonic sequence ordering and stale-input rejection (latest-input-wins).
 * 2. Connection timeout detection.
 * 3. Safe fallback to neutral input on packet timeout or disconnect (prevents runaway vehicle).
 */
export class InputReceiver {
  private lastSeq = 0;
  private lastPacketTime = 0;
  private latestInput: ControllerInput = { ...NEUTRAL_INPUT };
  private stalePacketsDropped = 0;
  private totalPacketsReceived = 0;

  /**
   * Processes an incoming controller packet.
   * Discards out-of-order or duplicate sequence numbers to prevent jitter.
   * @returns true if packet was accepted as newest input, false if dropped as stale.
   */
  public receive(packet: ControllerInput, now = Date.now()): boolean {
    this.totalPacketsReceived++;

    // Sequence wrap-around handling: standard monotonic check
    const isNewer = packet.seq > this.lastSeq || (this.lastSeq > 1000000 && packet.seq < 1000);
    if (!isNewer && this.lastSeq > 0) {
      this.stalePacketsDropped++;
      return false;
    }

    this.lastSeq = packet.seq;
    this.lastPacketTime = now;
    this.latestInput = {
      steer: Math.max(-1, Math.min(1, Number(packet.steer) || 0)),
      throttle: Math.max(0, Math.min(1, Number(packet.throttle) || 0)),
      brake: Math.max(0, Math.min(1, Number(packet.brake) || 0)),
      nitro: Boolean(packet.nitro),
      seq: packet.seq,
      timestamp: packet.timestamp
    };
    return true;
  }

  /**
   * Returns current active input.
   * If packets have timed out (> timeoutMs since last packet), safely returns neutral input.
   */
  public getActiveInput(now = Date.now(), timeoutMs = 250): ControllerInput {
    if (this.lastPacketTime === 0 || now - this.lastPacketTime > timeoutMs) {
      return { ...NEUTRAL_INPUT, timestamp: now };
    }
    return { ...this.latestInput };
  }

  public isRecent(now = Date.now(), timeoutMs = 250): boolean {
    return this.lastPacketTime > 0 && now - this.lastPacketTime <= timeoutMs;
  }

  public reset() {
    this.lastSeq = 0;
    this.lastPacketTime = 0;
    this.latestInput = { ...NEUTRAL_INPUT };
  }

  public getStats() {
    return {
      lastSeq: this.lastSeq,
      lastPacketTime: this.lastPacketTime,
      stalePacketsDropped: this.stalePacketsDropped,
      totalPacketsReceived: this.totalPacketsReceived
    };
  }
}
