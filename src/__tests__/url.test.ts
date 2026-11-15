import { describe, it, expect, beforeEach } from 'vitest';
import { getControllerUrl } from '../utils/url';

describe('Controller URL Utility', () => {
  beforeEach(() => {
    // Reset window.location mock
    Object.defineProperty(globalThis, 'window', {
      value: {
        location: {
          protocol: 'http:',
          hostname: 'localhost',
          port: '5173',
          origin: 'http://localhost:5173',
          search: ''
        }
      },
      writable: true
    });
  });

  it('substitutes reachable LAN IP when accessed on localhost', () => {
    const url = getControllerUrl('QLNS');
    expect(url).toBe('http://10.211.24.122:5173/controller?room=QLNS');
  });

  it('preserves production Base44 origin when running on *.base44.app', () => {
    Object.defineProperty(globalThis, 'window', {
      value: {
        location: {
          protocol: 'https:',
          hostname: 'last-signal.base44.app',
          port: '',
          origin: 'https://last-signal.base44.app',
          search: ''
        }
      },
      writable: true
    });

    const url = getControllerUrl('K7R9');
    expect(url).toBe('https://last-signal.base44.app/controller?room=K7R9');
  });

  it('respects explicit query parameter origin override', () => {
    Object.defineProperty(globalThis, 'window', {
      value: {
        location: {
          protocol: 'http:',
          hostname: 'localhost',
          port: '5173',
          origin: 'http://localhost:5173',
          search: '?origin=http://192.168.1.50:5173'
        }
      },
      writable: true
    });

    const url = getControllerUrl('AB12');
    expect(url).toBe('http://192.168.1.50:5173/controller?room=AB12');
  });
});
