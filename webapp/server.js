require('dotenv').config();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const Database = require('better-sqlite3');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'whitelist.db');

if (ADMIN_PASSWORD === 'changeme') {
  console.warn('\x1b[33m%s\x1b[0m', '[SECURITY WARNING] Default ADMIN_PASSWORD ("changeme") is in use! Set a strong ADMIN_PASSWORD in your .env file.');
}

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS whitelist (
    uuid TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    added_by TEXT,
    added_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS connections (
    uuid TEXT,
    username TEXT,
    ip TEXT,
    connected_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS kicks (
    uuid TEXT,
    username TEXT,
    ip TEXT,
    reason TEXT,
    kicked_at INTEGER
  );
`);

console.log(`Using whitelist database at: ${DB_PATH}`);

const app = express();

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

function verifyPassword(inputPassword) {
  if (typeof inputPassword !== 'string') return false;
  const hashInput = crypto.createHash('sha256').update(inputPassword, 'utf8').digest();
  const hashTarget = crypto.createHash('sha256').update(ADMIN_PASSWORD, 'utf8').digest();
  return crypto.timingSafeEqual(hashInput, hashTarget);
}

function createSessionToken() {
  const payload = {
    iat: Date.now(),
    exp: Date.now() + TOKEN_TTL_MS,
    nonce: crypto.randomBytes(16).toString('hex')
  };
  const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payloadEncoded).digest('base64url');
  return `${payloadEncoded}.${signature}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [payloadEncoded, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payloadEncoded).digest('base64url');

  const bufActual = Buffer.from(signature, 'utf8');
  const bufExpected = Buffer.from(expectedSig, 'utf8');

  if (bufActual.length !== bufExpected.length || !crypto.timingSafeEqual(bufActual, bufExpected)) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadEncoded, 'base64url').toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_PERIOD_MS = 15 * 60 * 1000;

function checkRateLimit(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record) return { allowed: true };

  if (now - record.firstAttempt > LOCKOUT_PERIOD_MS) {
    loginAttempts.delete(ip);
    return { allowed: true };
  }

  if (record.count >= MAX_LOGIN_ATTEMPTS) {
    const remainingMs = LOCKOUT_PERIOD_MS - (now - record.firstAttempt);
    return { allowed: false, remainingMinutes: Math.ceil(remainingMs / 60000) };
  }

  return { allowed: true };
}

function recordLoginFailure(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || now - record.firstAttempt > LOCKOUT_PERIOD_MS) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
  } else {
    record.count += 1;
  }
}

function clearLoginAttempts(ip) {
  loginAttempts.delete(ip);
}

function requireAuth(req, res, next) {
  const auth = req.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!verifySessionToken(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.post('/api/login', (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const rateStatus = checkRateLimit(clientIp);

  if (!rateStatus.allowed) {
    return res.status(429).json({
      ok: false,
      error: `Too many failed attempts. Try again in ${rateStatus.remainingMinutes} minute(s).`
    });
  }

  const { password } = req.body || {};
  if (verifyPassword(password)) {
    clearLoginAttempts(clientIp);
    const token = createSessionToken();
    return res.json({ ok: true, token });
  }

  recordLoginFailure(clientIp);
  res.status(401).json({ ok: false, error: 'Wrong password' });
});

function normalizeUuid(raw) {
  const hex = raw.replace(/-/g, '');
  if (hex.length !== 32) return raw;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function isValidUuid(uuid) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(uuid) ||
         /^[0-9a-fA-F]{32}$/.test(uuid);
}

function isValidUsername(username) {
  return typeof username === 'string' && /^[a-zA-Z0-9_.* -]{1,36}$/.test(username.trim());
}

function getOfflineUuid(username) {
  const hash = crypto.createHash('md5').update('OfflinePlayer:' + username, 'utf8').digest('hex');
  const chars = hash.split('');
  chars[12] = '3';
  chars[16] = ((parseInt(chars[16], 16) & 0x3) | 0x8).toString(16);
  const hex = chars.join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function lookupUuid(username) {
  try {
    const res = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`);
    if (res.ok) {
      const data = await res.json();
      return { uuid: normalizeUuid(data.id), username: data.name };
    }
  } catch (err) {}
  return { uuid: getOfflineUuid(username), username: username };
}

app.get('/api/players', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT uuid, username, added_by, added_at FROM whitelist ORDER BY username COLLATE NOCASE').all();
  res.json(rows);
});

app.post('/api/players', requireAuth, async (req, res) => {
  const { username, uuid } = req.body || {};
  if (!username || typeof username !== 'string' || !isValidUsername(username)) {
    return res.status(400).json({ error: 'Invalid Minecraft username' });
  }

  const cleanName = username.trim();

  if (uuid && typeof uuid === 'string' && isValidUuid(uuid.trim())) {
    const finalUuid = normalizeUuid(uuid.trim());
    db.prepare(`
      INSERT INTO whitelist (uuid, username, added_by, added_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(uuid) DO UPDATE SET username = excluded.username
    `).run(finalUuid, cleanName, 'webapp', Date.now());
    return res.status(201).json({ uuid: finalUuid, username: cleanName });
  }

  try {
    const resolved = await lookupUuid(cleanName);
    db.prepare(`
      INSERT INTO whitelist (uuid, username, added_by, added_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(uuid) DO UPDATE SET username = excluded.username
    `).run(resolved.uuid, resolved.username, 'webapp', Date.now());
    res.status(201).json({ uuid: resolved.uuid, username: resolved.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add player' });
  }
});

app.delete('/api/players/:id', requireAuth, (req, res) => {
  const param = req.params.id;
  const info = db.prepare('DELETE FROM whitelist WHERE uuid = ? OR username = ? COLLATE NOCASE').run(param, param);
  if (info.changes === 0) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.json({ ok: true });
});

app.get('/api/connections', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT uuid, username, ip, connected_at
    FROM connections
    ORDER BY connected_at DESC
    LIMIT 50
  `).all();
  res.json(rows);
});

app.get('/api/kicks', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT uuid, username, ip, reason, kicked_at
    FROM kicks
    ORDER BY kicked_at DESC
    LIMIT 50
  `).all();
  res.json(rows);
});

app.listen(PORT, () => {
  console.log(`Whitelist panel running at http://localhost:${PORT}`);
});
