import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ═════════════════════════════════════════���═════════════════════
// CONFIGURATION
// ══════════════════════════��════════════════════════════════════
export const CONFIG = {
  appUrl: 'http://localhost:5173',
  homeserver: 'http://127.0.0.1:8008',
  // Shared secret from Synapse homeserver.yaml (registration_shared_secret)
  sharedSecret: 'G*gx.o9QSemZMvlXMSu7dj&ki-~BX7GgRpziZGPl9XD_M9#_~:',
  users: [
    { username: 'testuser1', password: 'testpass123', role: 'primary', token: null, userId: null },
    { username: 'testuser2', password: 'testpass123', role: 'secondary', token: null, userId: null },
  ],
  // Rooms created during setup (filled at runtime)
  rooms: {
    general: null,    // roomId — group room with both users (no E2E, API messages)
    direct: null,     // roomId — DM between users (no E2E, API messages)
    empty: null,      // roomId — room with no messages
    media: null,      // roomId — room for media tests
    encrypted: null,  // roomId — E2E room (for encryption tests, client-side messages only)
  },
  screenshotDir: path.join(__dirname, '..', 'qa-output', 'screenshots'),
  reportPath: path.join(__dirname, '..', 'qa-output', 'bug-report.md'),
  timeout: 12000,
  slowMo: 120,
};

// ═════════════════════════���═════════════════════════════════════
// STATE
// ══════════════════════════��════════════════════════════════════
export const bugs = [];
export const testLog = [];
export const consoleErrors = [];
export const networkErrors = [];
let screenshotIdx = 0;

export function incrementScreenshotIdx() {
  return ++screenshotIdx;
}

export function getScreenshotIdx() {
  return screenshotIdx;
}
