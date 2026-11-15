import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import os from 'node:os';

/** First private IPv4 address of this machine (Wi-Fi, hotspot or Ethernet). */
function lanIp(): string {
  const all = Object.values(os.networkInterfaces()).flat();
  const v4 = all.filter((n): n is os.NetworkInterfaceInfo => !!n && n.family === 'IPv4' && !n.internal);
  const priv = v4.find((n) => /^(192\.168|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(n.address));
  return (priv ?? v4[0])?.address ?? '';
}

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  define: {
    // only meaningful in dev; production uses the public Base44 origin
    __LAN_IP__: JSON.stringify(command === 'serve' ? lanIp() : '')
  },
  server: {
    host: true, // Listen on all local IP addresses for phone controller connection
    port: 5173
  }
}));
