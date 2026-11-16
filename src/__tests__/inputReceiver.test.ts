import { describe, it, expect } from 'vitest';
import { InputReceiver } from '../network/inputReceiver';
import { ControllerInput } from '../types';

describe('InputReceiver', () => {
  it('initializes to neutral input', () => {
    const receiver = new InputReceiver();
    const input = receiver.getActiveInput(1000);
    expect(input.steer).toBe(0);
    expect(input.throttle).toBe(0);
    expect(input.brake).toBe(0);
    expect(input.nitro).toBe(false);
  });

  it('accepts strictly newer sequence numbers (latest-input-wins)', () => {
    const receiver = new InputReceiver();
    const packet1: ControllerInput = { steer: 0.5, throttle: 1, brake: 0, nitro: false, seq: 1, timestamp: 1000 };
    const packet2: ControllerInput = { steer: -0.5, throttle: 0, brake: 1, nitro: true, seq: 2, timestamp: 1040 };

    expect(receiver.receive(packet1, 1000)).toBe(true);
    expect(receiver.getActiveInput(1000).steer).toBe(0.5);

    expect(receiver.receive(packet2, 1040)).toBe(true);
    expect(receiver.getActiveInput(1040).steer).toBe(-0.5);
    expect(receiver.getActiveInput(1040).nitro).toBe(true);
  });

  it('drops out-of-order stale packets', () => {
    const receiver = new InputReceiver();
    const packet2: ControllerInput = { steer: 0.8, throttle: 1, brake: 0, nitro: false, seq: 2, timestamp: 1040 };
    const packet1: ControllerInput = { steer: -0.8, throttle: 0, brake: 0, nitro: false, seq: 1, timestamp: 1000 };

    // Newer packet 2 arrives first
    expect(receiver.receive(packet2, 1040)).toBe(true);
    // Stale packet 1 arrives later -> should be rejected!
    expect(receiver.receive(packet1, 1050)).toBe(false);

    // Active input must remain packet2
    expect(receiver.getActiveInput(1050).steer).toBe(0.8);
    expect(receiver.getStats().stalePacketsDropped).toBe(1);
  });

  it('drops duplicate sequence numbers', () => {
    const receiver = new InputReceiver();
    const packet: ControllerInput = { steer: 0.2, throttle: 0.5, brake: 0, nitro: false, seq: 10, timestamp: 1000 };
    expect(receiver.receive(packet, 1000)).toBe(true);
    expect(receiver.receive(packet, 1005)).toBe(false);
    expect(receiver.getStats().stalePacketsDropped).toBe(1);
  });

  it('reverts to safe neutral input on connection timeout (> 250ms)', () => {
    const receiver = new InputReceiver();
    const packet: ControllerInput = { steer: 1, throttle: 1, brake: 0, nitro: true, seq: 1, timestamp: 1000 };
    receiver.receive(packet, 1000);

    // At 1100ms (100ms later), still active
    expect(receiver.getActiveInput(1100).throttle).toBe(1);
    expect(receiver.isRecent(1100)).toBe(true);

    // At 1300ms (300ms later > 250ms timeout), reverts to neutral!
    const timedOut = receiver.getActiveInput(1300);
    expect(timedOut.throttle).toBe(0);
    expect(timedOut.steer).toBe(0);
    expect(timedOut.nitro).toBe(false);
    expect(receiver.isRecent(1300)).toBe(false);
  });

  it('clamps invalid steer and throttle values to safe ranges', () => {
    const receiver = new InputReceiver();
    const wildPacket: ControllerInput = { steer: 50, throttle: -10, brake: 99, nitro: true, seq: 1, timestamp: 1000 };
    receiver.receive(wildPacket, 1000);

    const clamped = receiver.getActiveInput(1000);
    expect(clamped.steer).toBe(1); // clamped to +1
    expect(clamped.throttle).toBe(0); // clamped to 0
    expect(clamped.brake).toBe(1); // clamped to 1
  });

  it('resets cleanly on disconnect', () => {
    const receiver = new InputReceiver();
    receiver.receive({ steer: 1, throttle: 1, brake: 0, nitro: true, seq: 5, timestamp: 1000 }, 1000);
    receiver.reset();
    expect(receiver.getActiveInput(1000).throttle).toBe(0);
    expect(receiver.isRecent(1000)).toBe(false);
  });
});
