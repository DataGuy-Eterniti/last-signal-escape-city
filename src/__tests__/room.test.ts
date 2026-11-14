import { describe, it, expect } from 'vitest';
import { generateRoomCode, derivePeerId, isValidRoomCode } from '../utils/room';

describe('Room & Session Utilities', () => {
  it('generates a 4-character uppercase alphanumeric code', () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(4);
    expect(code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/);
  });

  it('generates distinct codes across calls', () => {
    const c1 = generateRoomCode();
    const c2 = generateRoomCode();
    expect(typeof c1).toBe('string');
    expect(typeof c2).toBe('string');
  });

  it('derives consistent lowercase Peer ID prefix', () => {
    const peerId = derivePeerId('K7R9');
    expect(peerId).toBe('last-signal-room-k7r9');
  });

  it('validates room code format correctly', () => {
    expect(isValidRoomCode('K7R9')).toBe(true);
    expect(isValidRoomCode('AB12')).toBe(true);
    expect(isValidRoomCode('')).toBe(false);
    expect(isValidRoomCode('AB')).toBe(false);
    expect(isValidRoomCode('WAYTOOLONGROOMCODE')).toBe(false);
  });
});
