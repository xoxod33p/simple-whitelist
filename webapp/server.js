require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const Database = require('better-sqlite3');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'whitelist.db');

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
`);

console.log(`Using whitelist database at: ${DB_PATH}`);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function requireAuth(req, res, next) {
  const auth = req.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (token !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  if (password === ADMIN_PASSWORD) {
    return res.json({ ok: true, token: ADMIN_PASSWORD });
  }
  res.status(401).json({ ok: false, error: 'Wrong password' });
});

function normalizeUuid(raw) {
  const hex = raw.replace(/-/g, '');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function lookupUuid(username) {
  const res = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Mojang API error: ${res.status}`);
  const data = await res.json();
  return { uuid: normalizeUuid(data.id), username: data.name };
}

app.get('/api/players', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT uuid, username, added_by, added_at FROM whitelist ORDER BY username COLLATE NOCASE').all();
  res.json(rows);
});

app.post('/api/players', requireAuth, async (req, res) => {
  const { username } = req.body || {};
  if (!username || !username.trim()) {
    return res.status(400).json({ error: 'username is required' });
  }
  try {
    const resolved = await lookupUuid(username.trim());
    if (!resolved) {
      return res.status(404).json({ error: `No Mojang account found for "${username}"` });
    }
    db.prepare(`
      INSERT INTO whitelist (uuid, username, added_by, added_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(uuid) DO UPDATE SET username = excluded.username
    `).run(resolved.uuid, resolved.username, 'webapp', Date.now());
    res.status(201).json({ uuid: resolved.uuid, username: resolved.username });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'Failed to resolve username against Mojang API' });
  }
});

app.delete('/api/players/:uuid', requireAuth, (req, res) => {
  const info = db.prepare('DELETE FROM whitelist WHERE uuid = ?').run(req.params.uuid);
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

app.listen(PORT, () => {
  console.log(`Whitelist panel running at http://localhost:${PORT}`);
});
