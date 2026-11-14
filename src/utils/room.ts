const CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Generates a clean 4-character room token (e.g., 'K7R9')
 */
export function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < 4; i++) {
    const randomIndex = Math.floor(Math.random() * CHARS.length);
    code += CHARS[randomIndex];
  }
  return code;
}

/**
 * Derives the global PeerJS identifier from a room code
 */
export function derivePeerId(roomCode: string): string {
  const sanitized = roomCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `last-signal-room-${sanitized.toLowerCase()}`;
}

/**
 * Validates a room code format
 */
export function isValidRoomCode(code: string): boolean {
  if (!code) return false;
  const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return clean.length >= 4 && clean.length <= 8;
}
