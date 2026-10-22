/**
 * SKYSERVE - AI READINESS ROCKET LAUNCH CHECKER
 * Production-Grade Mission Control Plain Node.js HTTP Server
 * Zero external frameworks. Pure Node built-in modules only.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const zlib = require('zlib');

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);

// -----------------------------------------------------------------------------
// 1. PROCESS-LEVEL ERROR HANDLERS (FAIL-FAST ON UNHANDLED DEFECTS)
// -----------------------------------------------------------------------------
process.on('uncaughtException', (err) => {
  console.error('[FATAL] uncaughtException:', err && err.stack ? err.stack : err);
  if (!isServerless) process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] unhandledRejection at:', promise, 'reason:', reason);
  if (!isServerless) process.exit(1);
});

// -----------------------------------------------------------------------------
// 2. ENVIRONMENT CONFIGURATION & PORTS
// -----------------------------------------------------------------------------
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (key && !(key in process.env)) {
          process.env[key] = val;
        }
      }
    }
  } catch (err) {
    console.error('[SKYSERVE-ENV] Failed to parse .env:', err.message);
  }
}
loadEnv();

const PORT = parseInt(process.env.PORT, 10) || 8080;
const HOST = '0.0.0.0';

// DATA_DIR: read from environment so production can point to a mounted volume (e.g. /data)
// In serverless environments (e.g. Vercel), fall back to writable /tmp
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : isServerless
    ? path.join(os.tmpdir(), 'skyserve_data')
    : path.join(__dirname, 'data');

const USERS_FILE    = path.join(DATA_DIR, 'users.json');
const AUDIT_FILE    = path.join(DATA_DIR, 'audit.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const BACKUPS_DIR   = path.join(DATA_DIR, 'backups');

// Ensure data directory (and backups sub-dir) exist on startup
function ensureDataDirs() {
  try {
    if (!fs.existsSync(DATA_DIR))    fs.mkdirSync(DATA_DIR,    { recursive: true });
    if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  } catch (err) {
    console.error('[SKYSERVE] Warning creating data directories:', err.message);
  }
}
ensureDataDirs();

// -----------------------------------------------------------------------------
// 3. PER-FILE WRITE QUEUE  (serialises all writes to a given path)
// -----------------------------------------------------------------------------
// Ensures two concurrent requests never interleave writes to the same file.
const _writeQueues = new Map(); // filePath -> Promise (tail of the chain)

/**
 * Enqueue an async write operation for `filePath`.
 * `fn` must return a Promise that resolves once the write is complete.
 */
function enqueueWrite(filePath, fn) {
  const prev = _writeQueues.get(filePath) || Promise.resolve();
  const next = prev.then(() => fn()).catch((err) => {
    console.error(`[WRITE-QUEUE] Error writing ${filePath}:`, err.message);
  });
  _writeQueues.set(filePath, next);
  return next;
}

// -----------------------------------------------------------------------------
// 4. ATOMIC STORAGE HELPERS
// -----------------------------------------------------------------------------
/**
 * Atomically write JSON to filePath through the per-file write queue.
 * Uses write-to-temp-then-rename so no partial file is ever observed.
 */
function atomicWriteJson(filePath, data) {
  return enqueueWrite(filePath, () => new Promise((resolve, reject) => {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = `${filePath}.tmp.${Date.now()}.${crypto.randomBytes(4).toString('hex')}`;
    const json = JSON.stringify(data, null, 2);
    fs.writeFile(tmp, json, 'utf8', (writeErr) => {
      if (writeErr) return reject(writeErr);
      fs.rename(tmp, filePath, (renameErr) => {
        if (renameErr) {
          // Clean up temp file on rename failure
          fs.unlink(tmp, () => {});
          return reject(renameErr);
        }
        resolve();
      });
    });
  }));
}

/**
 * Synchronous atomic write — only used during startup seeding and
 * graceful-shutdown flush where the event loop is effectively single-threaded.
 */
function atomicWriteJsonSync(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.tmp.${Date.now()}.${crypto.randomBytes(4).toString('hex')}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

function readJsonSync(filePath, fallback = []) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error(`[STORAGE] Error reading ${filePath}:`, e.message);
    return fallback;
  }
}

// -----------------------------------------------------------------------------
// 5. CRYPTOGRAPHIC HASHING & POLICY
// -----------------------------------------------------------------------------
function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

function verifyPassword(password, storedHash) {
  return new Promise((resolve) => {
    if (!storedHash || typeof storedHash !== 'string' || !storedHash.includes(':')) {
      return resolve(false);
    }
    const [salt, keyHex] = storedHash.split(':');
    const expectedKey = Buffer.from(keyHex, 'hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return resolve(false);
      if (expectedKey.length !== derivedKey.length) return resolve(false);
      try {
        const match = crypto.timingSafeEqual(expectedKey, derivedKey);
        resolve(match);
      } catch (e) {
        resolve(false);
      }
    });
  });
}

function validatePasswordPolicy(password) {
  if (typeof password !== 'string') return 'Password must be a valid string.';
  if (password.length < 10) return 'Password must be at least 10 characters long.';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter (A-Z).';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter (a-z).';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one numeric digit (0-9).';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must contain at least one special symbol (!@#$%^&*...).';
  return null;
}

function generateStrongPassword() {
  const uppers  = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowers  = 'abcdefghijkmnpqrstuvwxyz';
  const digits  = '23456789';
  const symbols = '!@#$%^&*()_+~';
  const all     = uppers + lowers + digits + symbols;

  const chars = [
    uppers [crypto.randomInt(0, uppers.length)],
    lowers [crypto.randomInt(0, lowers.length)],
    digits [crypto.randomInt(0, digits.length)],
    symbols[crypto.randomInt(0, symbols.length)]
  ];

  for (let i = 0; i < 10; i++) {
    chars.push(all[crypto.randomInt(0, all.length)]);
  }

  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}

function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

// -----------------------------------------------------------------------------
// 6. AUDIT LOGGING  (async, queued)
// -----------------------------------------------------------------------------
function logAudit(event, username, actor, ip, details, outcome = 'SUCCESS') {
  const audit = readJsonSync(AUDIT_FILE, []);
  const record = {
    id: `aud_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    timestamp: new Date().toISOString(),
    event,
    username: username || 'UNKNOWN',
    actor:    actor    || 'system',
    ip:       ip       || '127.0.0.1',
    details:  details  || '',
    outcome
  };
  audit.unshift(record);
  if (audit.length > 2000) audit.length = 2000;
  atomicWriteJson(AUDIT_FILE, audit).catch((err) => {
    console.error('[AUDIT] Failed to persist audit record:', err.message);
  });
}

// -----------------------------------------------------------------------------
// 7. SEED ADMIN ACCOUNTS  (only when users.json does not yet exist)
// -----------------------------------------------------------------------------
async function seedAdminAccounts() {
  // ⚠️  Seed ONLY when the file is entirely absent — never on redeployment
  //     so real users and passwords are never overwritten.
  if (fs.existsSync(USERS_FILE)) {
    console.log('[SKYSERVE] users.json found — skipping admin seed (existing data preserved).');
    return;
  }

  console.log('[SKYSERVE] users.json not found — seeding initial administrator accounts…');
  const users = [];

  const defaultAdmins = [
    { name: 'Aayush Devre',   username: 'aayush.devre',   envKey: 'ADMIN_AAYUSH_PASSWORD', fallback: 'SkyServe#Aayush2026!'  },
    { name: 'Gayatri Kakade', username: 'gayatri.kakade', envKey: 'ADMIN_GAYATRI_PASSWORD', fallback: 'SkyServe#Gayatri2026!' }
  ];

  for (const item of defaultAdmins) {
    let initialPassword = (process.env[item.envKey] || item.fallback || '').trim();
    let wasGenerated = false;

    if (!initialPassword || validatePasswordPolicy(initialPassword) !== null) {
      initialPassword = generateStrongPassword();
      wasGenerated = true;
    }

    const hash = await hashPassword(initialPassword);
    const newAdmin = {
      id: `usr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      name:               item.name,
      username:           item.username,
      email:              `${item.username}@skyserve.aero`,
      role:               'ADMIN',
      passwordHash:       hash,
      mustChangePassword: true,
      disabled:           false,
      createdAt:          new Date().toISOString(),
      lastLogin:          null
    };

    users.push(newAdmin);

    console.log('================================================================');
    console.log(`[SKYSERVE SECURITY] Seeded ADMIN account : ${item.username}`);
    console.log(`[SKYSERVE SECURITY] Full Name             : ${item.name} | Role: ADMIN`);
    if (wasGenerated) {
      console.log(`[SKYSERVE SECURITY] ONE-TIME INITIAL PASSWORD: ${initialPassword}`);
      console.log(`[SKYSERVE SECURITY] Note: User must change password at first login.`);
    } else {
      console.log(`[SKYSERVE SECURITY] Initial password configured from ${item.envKey}.`);
    }
    console.log('================================================================');

    logAudit('ADMIN_SEEDED', item.username, 'system', '127.0.0.1', 'Initial mission administrator seeded');
  }

  atomicWriteJsonSync(USERS_FILE, users);
}

// -----------------------------------------------------------------------------
// 8. DAILY BACKUP OF users.json  (keep last 7)
// -----------------------------------------------------------------------------
function backupUsersFile() {
  if (isServerless) return;
  if (!fs.existsSync(USERS_FILE)) return;
  try {
    const stamp   = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const destFile = path.join(BACKUPS_DIR, `users.${stamp}.json`);
    // Skip if a backup for today already exists
    if (fs.existsSync(destFile)) return;

    fs.copyFileSync(USERS_FILE, destFile);
    console.log(`[BACKUP] users.json backed up to backups/users.${stamp}.json`);

    // Prune: keep only the 7 most recent backups
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => /^users\.\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .sort()           // lexicographic = chronological for YYYY-MM-DD
      .reverse();       // newest first

    for (const old of files.slice(7)) {
      try {
        fs.unlinkSync(path.join(BACKUPS_DIR, old));
        console.log(`[BACKUP] Pruned old backup: ${old}`);
      } catch (pruneErr) {
        console.warn(`[BACKUP] Could not prune ${old}:`, pruneErr.message);
      }
    }
  } catch (err) {
    console.error('[BACKUP] Failed to back up users.json:', err.message);
  }
}

// Run once at startup, then repeat every 24 hours
function scheduleBackups() {
  if (isServerless) return;
  backupUsersFile();
  setInterval(backupUsersFile, 24 * 60 * 60 * 1000).unref();
}

// -----------------------------------------------------------------------------
// 9. PERSISTENT SESSIONS  (hashed tokens stored in DATA_DIR/sessions.json)
// -----------------------------------------------------------------------------
// The raw 32-byte token is only ever sent in the Set-Cookie header.
// What we store on disk is SHA-256(token) so a sessions.json leak cannot be
// replayed directly. The in-memory Map still uses the raw token as key for
// O(1) lookup; the SHA-256 hash is only the on-disk key.

const sessions = new Map();  // rawToken -> { userId, username, role, name, expiresAt }

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/** Load sessions.json at startup, prune expired entries, rebuild in-memory Map. */
function loadSessions() {
  const stored = readJsonSync(SESSIONS_FILE, {});
  const now = Date.now();
  let pruned = 0;

  for (const [tokenHash, entry] of Object.entries(stored)) {
    if (!entry || typeof entry.expiresAt !== 'number') { pruned++; continue; }
    if (now > entry.expiresAt) { pruned++; continue; }
    // We cannot recover the raw token from its hash, so we store the hash as
    // the temporary in-memory key too, and the cookie value will continue to
    // work because getSession() hashes the incoming cookie token before lookup.
    sessions.set(tokenHash, entry);
  }
  if (pruned) console.log(`[SESSION] Pruned ${pruned} expired session(s) from sessions.json`);
  console.log(`[SESSION] Loaded ${sessions.size} active session(s) from sessions.json`);
}

// Debounced session persistence: coalesce rapid writes into one disk flush
let _sessionFlushTimer = null;
const SESSION_FLUSH_DEBOUNCE_MS = 500; // wait 500 ms after last change

function scheduleSessFlush() {
  if (_sessionFlushTimer) clearTimeout(_sessionFlushTimer);
  _sessionFlushTimer = setTimeout(() => {
    _sessionFlushTimer = null;
    flushSessions();
  }, SESSION_FLUSH_DEBOUNCE_MS);
}

function flushSessions() {
  const now = Date.now();
  const out = {};
  for (const [key, entry] of sessions.entries()) {
    if (now <= entry.expiresAt) out[key] = entry;
  }
  atomicWriteJson(SESSIONS_FILE, out).catch((err) => {
    console.error('[SESSION] Failed to flush sessions.json:', err.message);
  });
}

/** Immediate synchronous flush — used only during graceful shutdown. */
function flushSessionsSync() {
  const now = Date.now();
  const out = {};
  for (const [key, entry] of sessions.entries()) {
    if (now <= entry.expiresAt) out[key] = entry;
  }
  try {
    atomicWriteJsonSync(SESSIONS_FILE, out);
  } catch (err) {
    console.error('[SESSION] Failed to flush sessions.json on shutdown:', err.message);
  }
}

/**
 * Look up a session by the raw token from the cookie.
 * We hash it and look up in the Map (which uses hashed keys after restart
 * and raw keys before first restart — both work because getSession hashes).
 */
function getSession(req) {
  const cookie = parseCookies(req).skyserve_sid;
  if (!cookie) return null;

  // Try the hash (always correct key format on disk-loaded sessions & new ones)
  const hashed = hashToken(cookie);
  let entry = sessions.get(hashed);
  if (!entry) return null; // not found

  if (Date.now() > entry.expiresAt) {
    sessions.delete(hashed);
    scheduleSessFlush();
    return null;
  }
  // Return both the raw token (needed for cookie clearing) and the session data
  return { token: cookie, tokenHash: hashed, ...entry };
}

function createSession(user) {
  const rawToken  = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const entry = {
    userId:   user.id,
    username: user.username,
    role:     user.role,
    name:     user.name,
    expiresAt
  };
  sessions.set(tokenHash, entry);
  scheduleSessFlush();
  return rawToken;  // only the raw token is sent to the browser
}

function destroySession(rawToken) {
  if (!rawToken) return;
  const hashed = hashToken(rawToken);
  if (sessions.delete(hashed)) {
    scheduleSessFlush();
  }
}

// Clean expired sessions from memory every 10 minutes
setInterval(() => {
  const now = Date.now();
  let pruned = 0;
  for (const [key, entry] of sessions.entries()) {
    if (now > entry.expiresAt) { sessions.delete(key); pruned++; }
  }
  if (pruned) {
    scheduleSessFlush();
    console.log(`[SESSION] Evicted ${pruned} expired session(s) from memory`);
  }
}, 10 * 60 * 1000).unref();

// Rate limiting (in-memory only — acceptable for single instance)
const failedLogins = new Map();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS  = 5;

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of failedLogins.entries()) {
    if (record.lockedUntil && now > record.lockedUntil && (!record.attempts || record.attempts.length === 0)) {
      failedLogins.delete(key);
    }
  }
}, 10 * 60 * 1000).unref();

// -----------------------------------------------------------------------------
// 10. COOKIE / REQUEST UTILITIES
// -----------------------------------------------------------------------------
function parseCookies(req) {
  const list = {};
  const header = req.headers.cookie;
  if (header) {
    header.split(';').forEach(c => {
      const parts = c.split('=');
      if (parts.length >= 2) {
        list[parts[0].trim()] = decodeURIComponent(parts.slice(1).join('=').trim());
      }
    });
  }
  return list;
}

function isRequestSecure(req) {
  const isProd = process.env.NODE_ENV === 'production';
  const xFwdProto = (req.headers['x-forwarded-proto'] || '').toLowerCase();
  return isProd || (req.socket && req.socket.encrypted) || xFwdProto === 'https';
}

function getSessionCookieHeader(token, req, maxAgeSeconds = 28800) {
  const secureFlag = isRequestSecure(req) ? '; Secure' : '';
  return `skyserve_sid=${token}; HttpOnly; SameSite=Strict; Path=/${secureFlag}; Max-Age=${maxAgeSeconds}`;
}

function getClearSessionCookieHeader(req) {
  const secureFlag = isRequestSecure(req) ? '; Secure' : '';
  return `skyserve_sid=; HttpOnly; SameSite=Strict; Path=/${secureFlag}; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || '127.0.0.1';
}

function checkRateLimit(username, ip) {
  const key = `${ip}:${username.toLowerCase()}`;
  const now = Date.now();
  const record = failedLogins.get(key);
  if (!record) return { allowed: true };

  if (record.lockedUntil && now < record.lockedUntil) {
    const remainingMins = Math.ceil((record.lockedUntil - now) / 60000);
    return { allowed: false, message: `Too many failed login attempts. Account temporarily locked for ${remainingMins} minute(s).` };
  }

  record.attempts = (record.attempts || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (record.attempts.length >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + RATE_LIMIT_WINDOW_MS;
    return { allowed: false, message: 'Too many failed login attempts. Account temporarily locked for 15 minutes.' };
  }

  return { allowed: true };
}

function recordFailedLogin(username, ip) {
  const key = `${ip}:${username.toLowerCase()}`;
  const now = Date.now();
  let record = failedLogins.get(key);
  if (!record) { record = { attempts: [], lockedUntil: null }; failedLogins.set(key, record); }
  record.attempts = (record.attempts || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  record.attempts.push(now);
  if (record.attempts.length >= MAX_FAILED_ATTEMPTS) record.lockedUntil = now + RATE_LIMIT_WINDOW_MS;
}

function clearFailedLogins(username, ip) {
  failedLogins.delete(`${ip}:${username.toLowerCase()}`);
}

// -----------------------------------------------------------------------------
// 11. SECURITY HEADERS & GZIP COMPRESSION
// -----------------------------------------------------------------------------
function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self';"
  );
}

function sendResponse(req, res, statusCode, contentType, bodyBuffer, extraHeaders = {}) {
  setSecurityHeaders(res);

  for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
  res.setHeader('Content-Type', contentType);

  const isCompressible = /^(text\/|application\/javascript|application\/json|image\/svg\+xml)/i.test(contentType);
  const canGzip = /\bgzip\b/i.test(req.headers['accept-encoding'] || '');

  if (canGzip && isCompressible && bodyBuffer.length > 128) {
    zlib.gzip(bodyBuffer, (err, compressed) => {
      if (err) {
        res.setHeader('Content-Length', bodyBuffer.length);
        res.writeHead(statusCode);
        return res.end(bodyBuffer);
      }
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Content-Length', compressed.length);
      res.writeHead(statusCode);
      res.end(compressed);
    });
  } else {
    res.setHeader('Content-Length', bodyBuffer.length);
    res.writeHead(statusCode);
    res.end(bodyBuffer);
  }
}

function sendJson(req, res, statusCode, data, extraHeaders = {}) {
  const jsonBuf = Buffer.from(JSON.stringify(data), 'utf8');
  sendResponse(req, res, statusCode, 'application/json; charset=utf-8', jsonBuf, {
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
}

function parseJsonBody(req, limitBytes = 10 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > limitBytes) {
        const err = new Error('Payload Too Large');
        err.statusCode = 413;
        reject(err);
        req.destroy();
        return;
      }
      body += chunk.toString('utf8');
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try   { resolve(JSON.parse(body)); }
      catch (e) {
        const err = new Error('Malformed JSON');
        err.statusCode = 400;
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// -----------------------------------------------------------------------------
// 12. STATIC FILE SERVING WITH STRICT ALLOW-LIST & CACHING
// -----------------------------------------------------------------------------
const MIME_TYPES = {
  '.html':  'text/html; charset=utf-8',
  '.css':   'text/css; charset=utf-8',
  '.js':    'text/javascript; charset=utf-8',
  '.json':  'application/json; charset=utf-8',
  '.jpg':   'image/jpeg',
  '.jpeg':  'image/jpeg',
  '.png':   'image/png',
  '.svg':   'image/svg+xml',
  '.ico':   'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff':  'font/woff',
  '.ttf':   'font/ttf'
};

function serveStaticFile(req, res, session) {
  setSecurityHeaders(res);

  let parsedUrl;
  try { parsedUrl = new URL(req.url, 'http://localhost'); }
  catch (e) { res.writeHead(400, { 'Content-Type': 'text/plain' }); return res.end('400 Bad Request'); }

  let reqPath = decodeURIComponent(parsedUrl.pathname);
  if (reqPath === '/') reqPath = '/index.html';
  if (reqPath === '/login') reqPath = '/login.html';

  // Strict path traversal check with cwd fallback for serverless bundles
  let safeBase = path.resolve(__dirname);
  let resolvedPath = path.resolve(safeBase, '.' + path.normalize(reqPath));

  if (!fs.existsSync(resolvedPath)) {
    const cwdBase = path.resolve(process.cwd());
    const cwdPath = path.resolve(cwdBase, '.' + path.normalize(reqPath));
    if (fs.existsSync(cwdPath)) {
      safeBase = cwdBase;
      resolvedPath = cwdPath;
    }
  }

  if (!resolvedPath.startsWith(safeBase + path.sep) && resolvedPath !== safeBase) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('403 Forbidden: Path Traversal Detected');
  }

  const relativePath = path.relative(safeBase, resolvedPath).replace(/\\/g, '/');

  // Hard-block sensitive files & the data directory
  const forbiddenNames = ['server.js', 'package.json', 'package-lock.json', '.env', '.gitignore', 'readme.md', 'vercel.json'];
  if (
    forbiddenNames.includes(relativePath.toLowerCase()) ||
    relativePath.startsWith('.env') ||
    relativePath.startsWith('.') ||
    relativePath.startsWith('data/') ||
    relativePath === 'data'
  ) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('404 Not Found');
  }

  // Whitelist allowable static directories/files
  const isAllowedStatic =
    relativePath === 'index.html' ||
    relativePath === 'login.html' ||
    relativePath === 'favicon.ico' ||
    relativePath.startsWith('css/')    ||
    relativePath.startsWith('js/')     ||
    relativePath.startsWith('assets/');

  if (!isAllowedStatic) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('404 Not Found');
  }

  // Unauthenticated: only public assets
  const isPublicAsset =
    relativePath === 'login.html' ||
    relativePath === 'js/login.js' ||
    relativePath.startsWith('css/')    ||
    relativePath.startsWith('assets/') ||
    relativePath === 'favicon.ico';

  if (!session) {
    if (!isPublicAsset) { res.writeHead(302, { Location: '/login.html' }); return res.end(); }
  } else {
    if (relativePath === 'login.html') { res.writeHead(302, { Location: '/' }); return res.end(); }
  }

  fs.stat(resolvedPath, (statErr, stats) => {
    if (statErr || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('404 Not Found');
    }

    const ext         = path.extname(resolvedPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const cacheControl =
      relativePath.startsWith('css/') || relativePath.startsWith('js/')
        ? 'public, max-age=3600'
        : 'no-store';

    fs.readFile(resolvedPath, (err, content) => {
      if (err) { res.writeHead(500, { 'Content-Type': 'text/plain' }); return res.end('500 Server Error'); }
      sendResponse(req, res, 200, contentType, content, { 'Cache-Control': cacheControl });
    });
  });
}

// -----------------------------------------------------------------------------
// 13. HTTP REQUEST ROUTER & API HANDLERS
// -----------------------------------------------------------------------------
let isShuttingDown = false;

async function handleRequest(req, res) {
  const startTime = process.hrtime.bigint();
  const ip        = getClientIp(req);
  const session   = getSession(req);
  const matchedPath = req.headers['x-matched-path'];
  const incomingUrl = (matchedPath && (matchedPath.startsWith('/api/') || matchedPath === '/healthz'))
    ? matchedPath
    : (req.url || '/');
  const urlObj    = new URL(incomingUrl, 'http://localhost');
  const pathname  = urlObj.pathname;
  const method    = req.method.toUpperCase();

  // Audit-safe request logging — no bodies, passwords, or cookies
  res.on('finish', () => {
    const ms = (Number(process.hrtime.bigint() - startTime) / 1e6).toFixed(2);
    console.log(`[HTTP] ${method} ${pathname} ${res.statusCode} ${ms}ms`);
  });

  // Health check (unauthenticated, no-store)
  if (method === 'GET' && pathname === '/healthz') {
    return sendJson(req, res, 200, { status: 'ok' });
  }

  // 503 during graceful shutdown
  if (isShuttingDown) {
    res.setHeader('Connection', 'close');
    return sendJson(req, res, 503, { error: 'Server is shutting down' });
  }

  // Non-API requests → static file server
  if (!pathname.startsWith('/api/')) {
    return serveStaticFile(req, res, session);
  }

  setSecurityHeaders(res);

  // ---------------------------------------------------------------------------
  // AUTH ROUTE: POST /api/auth/login
  // ---------------------------------------------------------------------------
  if (method === 'POST' && pathname === '/api/auth/login') {
    let body;
    try   { body = await parseJsonBody(req); }
    catch (e) { return sendJson(req, res, e.statusCode || 400, { error: e.message }); }

    const username = (body.username || '').trim();
    const password = body.password || '';

    if (!username || !password) {
      return sendJson(req, res, 400, { error: 'Username and password are required.' });
    }

    const rateCheck = checkRateLimit(username, ip);
    if (!rateCheck.allowed) {
      logAudit('LOGIN_RATE_LIMITED', username, 'system', ip, 'Too many failed login attempts', 'FAIL');
      return sendJson(req, res, 429, { error: rateCheck.message });
    }

    const users = readJsonSync(USERS_FILE, []);
    const user  = users.find(u => u.username.toLowerCase() === username.toLowerCase());

    if (!user) {
      recordFailedLogin(username, ip);
      logAudit('LOGIN_FAILED', username, 'system', ip, 'Invalid username or password', 'FAIL');
      return sendJson(req, res, 401, { error: 'Invalid username or password.' });
    }

    if (user.disabled) {
      recordFailedLogin(username, ip);
      logAudit('LOGIN_BLOCKED_DISABLED', username, 'system', ip, 'User account is suspended', 'FAIL');
      return sendJson(req, res, 401, { error: 'Account has been disabled. Contact mission administrator.' });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      recordFailedLogin(username, ip);
      logAudit('LOGIN_FAILED', username, 'system', ip, 'Invalid username or password', 'FAIL');
      return sendJson(req, res, 401, { error: 'Invalid username or password.' });
    }

    clearFailedLogins(username, ip);
    user.lastLogin = new Date().toISOString();
    await atomicWriteJson(USERS_FILE, users);

    const token        = createSession(user);
    const cookieHeader = getSessionCookieHeader(token, req);

    logAudit('LOGIN_SUCCESS', user.username, user.username, ip, `Authenticated with role ${user.role}`);
    return sendJson(req, res, 200, {
      user: { id: user.id, name: user.name, username: user.username, role: user.role, mustChangePassword: !!user.mustChangePassword }
    }, { 'Set-Cookie': cookieHeader });
  }

  // ---------------------------------------------------------------------------
  // AUTH ROUTE: POST /api/auth/logout
  // ---------------------------------------------------------------------------
  if (method === 'POST' && pathname === '/api/auth/logout') {
    if (session) {
      destroySession(session.token);
      logAudit('LOGOUT', session.username, session.username, ip, 'Session terminated');
    }
    const clearCookie = getClearSessionCookieHeader(req);
    return sendJson(req, res, 200, { success: true, message: 'Logged out successfully.' }, { 'Set-Cookie': clearCookie });
  }

  // ---------------------------------------------------------------------------
  // AUTH MIDDLEWARE: All remaining API routes require active session
  // ---------------------------------------------------------------------------
  if (!session) {
    return sendJson(req, res, 401, { error: 'Authentication required. Please log in.' });
  }

  const users       = readJsonSync(USERS_FILE, []);
  const currentUser = users.find(u => u.id === session.userId);
  if (!currentUser || currentUser.disabled) {
    destroySession(session.token);
    const clearCookie = getClearSessionCookieHeader(req);
    return sendJson(req, res, 401, { error: 'Session invalid or account disabled.' }, { 'Set-Cookie': clearCookie });
  }

  // ---------------------------------------------------------------------------
  // AUTH ROUTE: GET /api/auth/me
  // ---------------------------------------------------------------------------
  if (method === 'GET' && pathname === '/api/auth/me') {
    return sendJson(req, res, 200, {
      id:                 currentUser.id,
      name:               currentUser.name,
      username:           currentUser.username,
      role:               currentUser.role,
      mustChangePassword: !!currentUser.mustChangePassword
    });
  }

  // ---------------------------------------------------------------------------
  // AUTH ROUTE: POST /api/auth/change-password
  // ---------------------------------------------------------------------------
  if (method === 'POST' && pathname === '/api/auth/change-password') {
    let body;
    try   { body = await parseJsonBody(req); }
    catch (e) { return sendJson(req, res, e.statusCode || 400, { error: e.message }); }

    const { currentPassword, newPassword } = body;
    if (!currentPassword || !newPassword) {
      return sendJson(req, res, 400, { error: 'Current password and new password are required.' });
    }

    const isMatch = await verifyPassword(currentPassword, currentUser.passwordHash);
    if (!isMatch) {
      logAudit('PASSWORD_CHANGE_FAIL', currentUser.username, currentUser.username, ip, 'Incorrect current password', 'FAIL');
      return sendJson(req, res, 400, { error: 'Current password is incorrect.' });
    }

    const policyErr = validatePasswordPolicy(newPassword);
    if (policyErr) return sendJson(req, res, 400, { error: policyErr });

    const isSame = await verifyPassword(newPassword, currentUser.passwordHash);
    if (isSame) return sendJson(req, res, 400, { error: 'New password cannot be identical to your current password.' });

    currentUser.passwordHash       = await hashPassword(newPassword);
    currentUser.mustChangePassword = false;
    await atomicWriteJson(USERS_FILE, users);

    logAudit('PASSWORD_CHANGED', currentUser.username, currentUser.username, ip, 'Password updated successfully');
    return sendJson(req, res, 200, { success: true, message: 'Password updated successfully.' });
  }

  // ---------------------------------------------------------------------------
  // ADMIN MIDDLEWARE: Admin-only API routes
  // ---------------------------------------------------------------------------
  if (pathname.startsWith('/api/admin/')) {
    if (currentUser.role !== 'ADMIN') {
      logAudit('ADMIN_UNAUTHORIZED_ACCESS', currentUser.username, currentUser.username, ip, `Attempted access to ${pathname}`, 'FAIL');
      return sendJson(req, res, 403, { error: 'Administrative privileges required.' });
    }

    // GET /api/admin/users
    if (method === 'GET' && pathname === '/api/admin/users') {
      return sendJson(req, res, 200, { users: users.map(sanitizeUser) });
    }

    // POST /api/admin/users
    if (method === 'POST' && pathname === '/api/admin/users') {
      let body;
      try   { body = await parseJsonBody(req); }
      catch (e) { return sendJson(req, res, e.statusCode || 400, { error: e.message }); }

      const name     = (body.name     || '').trim();
      const username = (body.username || '').trim().toLowerCase();
      const email    = (body.email    || '').trim().toLowerCase();
      const role     = body.role === 'ADMIN' ? 'ADMIN' : 'USER';

      if (!name || !username) {
        return sendJson(req, res, 400, { error: 'Full name and username are required.' });
      }
      if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
        return sendJson(req, res, 400, { error: 'Username must be 3-30 characters and contain only lowercase letters, numbers, dots, dashes, or underscores.' });
      }
      if (users.find(u => u.username.toLowerCase() === username)) {
        return sendJson(req, res, 409, { error: `Username '${username}' is already registered.` });
      }

      const temporaryPassword = generateStrongPassword();
      const hash              = await hashPassword(temporaryPassword);

      const newUser = {
        id:                 `usr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        name,
        username,
        email:              email || `${username}@skyserve.aero`,
        role,
        passwordHash:       hash,
        mustChangePassword: true,
        disabled:           false,
        createdAt:          new Date().toISOString(),
        lastLogin:          null
      };

      users.push(newUser);
      await atomicWriteJson(USERS_FILE, users);

      logAudit('USER_CREATED', newUser.username, currentUser.username, ip, `Created user with role ${newUser.role}`);
      return sendJson(req, res, 201, { user: sanitizeUser(newUser), temporaryPassword });
    }

    // PATCH /api/admin/users/:id
    const patchMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
    if (method === 'PATCH' && patchMatch) {
      const targetUser = users.find(u => u.id === patchMatch[1]);
      if (!targetUser) return sendJson(req, res, 404, { error: 'User not found.' });

      let body;
      try   { body = await parseJsonBody(req); }
      catch (e) { return sendJson(req, res, e.statusCode || 400, { error: e.message }); }

      // Self-protection
      if (targetUser.id === currentUser.id) {
        if (body.disabled === true) return sendJson(req, res, 400, { error: 'Administrators cannot disable their own account.' });
        if (body.role && body.role !== 'ADMIN') return sendJson(req, res, 400, { error: 'Administrators cannot demote their own account.' });
      }

      // Last-admin protection
      if (targetUser.role === 'ADMIN') {
        const otherActiveAdmins = users.filter(u => u.role === 'ADMIN' && !u.disabled && u.id !== targetUser.id);
        if (body.disabled === true && otherActiveAdmins.length === 0)
          return sendJson(req, res, 400, { error: 'Cannot disable the last active administrator account.' });
        if (body.role && body.role !== 'ADMIN' && otherActiveAdmins.length === 0)
          return sendJson(req, res, 400, { error: 'Cannot demote the last remaining administrator account.' });
      }

      let generatedTempPassword = null;

      if (body.role && (body.role === 'ADMIN' || body.role === 'USER')) {
        targetUser.role = body.role;
        logAudit('ROLE_UPDATED', targetUser.username, currentUser.username, ip, `Role changed to ${targetUser.role}`);
      }

      if (typeof body.disabled === 'boolean') {
        targetUser.disabled = body.disabled;
        if (targetUser.disabled) {
          // Terminate active sessions for disabled user
          for (const [key, entry] of sessions.entries()) {
            if (entry.userId === targetUser.id) { sessions.delete(key); }
          }
          scheduleSessFlush();
        }
        logAudit(
          targetUser.disabled ? 'USER_DISABLED' : 'USER_ENABLED',
          targetUser.username, currentUser.username, ip,
          targetUser.disabled ? 'Account suspended' : 'Account activated'
        );
      }

      if (body.resetPassword === true) {
        generatedTempPassword        = generateStrongPassword();
        targetUser.passwordHash      = await hashPassword(generatedTempPassword);
        targetUser.mustChangePassword = true;
        // Invalidate active sessions
        for (const [key, entry] of sessions.entries()) {
          if (entry.userId === targetUser.id) { sessions.delete(key); }
        }
        scheduleSessFlush();
        logAudit('PASSWORD_RESET', targetUser.username, currentUser.username, ip, 'Admin reset user temporary password');
      }

      await atomicWriteJson(USERS_FILE, users);
      return sendJson(req, res, 200, { user: sanitizeUser(targetUser), temporaryPassword: generatedTempPassword });
    }

    // DELETE /api/admin/users/:id
    const deleteMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
    if (method === 'DELETE' && deleteMatch) {
      const targetIdx  = users.findIndex(u => u.id === deleteMatch[1]);
      if (targetIdx === -1) return sendJson(req, res, 404, { error: 'User not found.' });

      const targetUser = users[targetIdx];
      if (targetUser.id === currentUser.id)
        return sendJson(req, res, 400, { error: 'Administrators cannot delete their own account.' });

      if (targetUser.role === 'ADMIN') {
        const otherAdmins = users.filter(u => u.role === 'ADMIN' && u.id !== targetUser.id);
        if (otherAdmins.length === 0)
          return sendJson(req, res, 400, { error: 'Cannot delete the last remaining administrator account.' });
      }

      for (const [key, entry] of sessions.entries()) {
        if (entry.userId === targetUser.id) { sessions.delete(key); }
      }
      scheduleSessFlush();

      users.splice(targetIdx, 1);
      await atomicWriteJson(USERS_FILE, users);

      logAudit('USER_DELETED', targetUser.username, currentUser.username, ip, `Deleted user account '${targetUser.username}'`);
      return sendJson(req, res, 200, { success: true, message: `User '${targetUser.username}' deleted successfully.` });
    }

    // GET /api/admin/audit
    if (method === 'GET' && pathname === '/api/admin/audit') {
      const audit = readJsonSync(AUDIT_FILE, []);
      return sendJson(req, res, 200, { audit });
    }
  }

  // Unhandled API endpoint
  return sendJson(req, res, 404, { error: 'API route not found' });
}

const server = http.createServer(handleRequest);

// -----------------------------------------------------------------------------
// 14. GRACEFUL SHUTDOWN (STANDALONE ONLY)
// -----------------------------------------------------------------------------
function handleGracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n[SKYSERVE] Received ${signal}. Initiating graceful shutdown…`);

  server.close((err) => {
    if (err) { console.error('[SKYSERVE] Error closing server:', err); process.exit(1); }
    console.log('[SKYSERVE] All connections closed. Flushing state to disk…');
    try {
      // Final flush of sessions (synchronous so it completes before exit)
      flushSessionsSync();
      // Re-write users and audit in case any writes are still pending
      if (fs.existsSync(USERS_FILE)) atomicWriteJsonSync(USERS_FILE, readJsonSync(USERS_FILE, []));
      if (fs.existsSync(AUDIT_FILE)) atomicWriteJsonSync(AUDIT_FILE, readJsonSync(AUDIT_FILE, []));
      console.log('[SKYSERVE] State flushed successfully. Goodbye.');
      process.exit(0);
    } catch (flushErr) {
      console.error('[SKYSERVE] Error flushing storage on exit:', flushErr);
      process.exit(1);
    }
  });

  // Force-exit fallback if connections linger
  setTimeout(() => { console.warn('[SKYSERVE] Shutdown timed out. Forcing termination.'); process.exit(0); }, 5000).unref();
}

if (!isServerless) {
  process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
  process.on('SIGINT',  () => handleGracefulShutdown('SIGINT'));
  if (process.send) {
    process.on('message', (msg) => {
      if (msg === 'shutdown' || msg === 'SIGTERM' || msg === 'SIGINT') handleGracefulShutdown('SIGTERM');
    });
  }
}

// -----------------------------------------------------------------------------
// 15. INITIALIZATION & EXPORTS
// -----------------------------------------------------------------------------
let initPromise = null;
function initializeServer() {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        console.log(`[SKYSERVE] DATA_DIR = ${DATA_DIR} (serverless=${isServerless})`);
        ensureDataDirs();
        await seedAdminAccounts();    // seed only if users.json is absent
        loadSessions();               // hydrate in-memory session Map from disk
        if (!isServerless) {
          scheduleBackups();          // daily backup of users.json
        }
      } catch (err) {
        console.error('[SKYSERVE] Initialization error:', err);
      }
    })();
  }
  return initPromise;
}

// Export handler for Vercel / serverless runtime
const handler = (req, res) => {
  return new Promise((resolve) => {
    let resolved = false;
    const done = () => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };
    res.once('finish', done);
    res.once('close', done);

    (async () => {
      try {
        await initializeServer();
        await handleRequest(req, res);
      } catch (err) {
        console.error('[SKYSERVE] Unhandled handler error:', err);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal Server Error' }));
        }
        done();
      }
    })();
  });
};

module.exports = handler;
module.exports.default = handler;
module.exports.server = server;

// Standalone execution (Local dev, Docker, VPS)
if (!isServerless) {
  initializeServer().then(() => {
    server.listen(PORT, HOST, () => {
      const envMode = process.env.NODE_ENV || 'development';
      console.log(`[SKYSERVE] Mission Control active at http://${HOST}:${PORT}/ (NODE_ENV=${envMode})`);
    });
  }).catch((err) => {
    console.error('[SKYSERVE] Fatal initialization error:', err);
    process.exit(1);
  });
}
