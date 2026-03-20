// ─────────────────────────────────────────────────────────────
//  ⚠️  Set BASE_URL to your PC's local IP address.
//
//  Windows : open CMD → ipconfig → IPv4 Address
//  Mac/Linux: open Terminal → ifconfig → inet under en0/wlan0
//
//  Example: http://192.168.1.45:5000
//  Phone and PC must be on the SAME WiFi network.
// ─────────────────────────────────────────────────────────────

export const BASE_URL = 'http://192.168.1.4:5000'; // ← CHANGE THIS

export const API = {
  login:   `${BASE_URL}/api/student/login`,
  borrows: (id: number) => `${BASE_URL}/api/student/borrows/${id}`,
  history: (id: number) => `${BASE_URL}/api/student/history/${id}`,
  update:  (id: number) => `${BASE_URL}/api/student/update/${id}`,
} as const;

export const SOCKET_URL = BASE_URL;
