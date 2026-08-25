let token = null;

const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const passwordInput = document.getElementById('password-input');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');

const addUsername = document.getElementById('add-username');
const addBtn = document.getElementById('add-btn');
const addFeedback = document.getElementById('add-feedback');
const refreshBtn = document.getElementById('refresh-btn');
const playersBody = document.getElementById('players-body');
const connectionsBody = document.getElementById('connections-body');
const playerCount = document.getElementById('player-count');

async function login() {
  loginError.textContent = '';
  const password = passwordInput.value;
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await res.json();
    if (!res.ok) {
      loginError.textContent = data.error || 'Login failed';
      return;
    }
    token = data.token;
    loginScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');
    loadPlayers();
    loadConnections();
  } catch (err) {
    loginError.textContent = 'Could not reach server';
  }
}

loginBtn.addEventListener('click', login);
passwordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') login(); });

function authHeaders() {
  return { 'Authorization': `Bearer ${token}` };
}

function timeAgo(ms) {
  if (!ms) return '--';
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

async function loadPlayers() {
  const res = await fetch('/api/players', { headers: authHeaders() });
  if (!res.ok) return;
  const players = await res.json();
  playerCount.textContent = `${players.length} player${players.length === 1 ? '' : 's'}`;

  if (players.length === 0) {
    playersBody.innerHTML = '<tr><td colspan="4" class="muted">no one whitelisted yet</td></tr>';
    return;
  }

  playersBody.innerHTML = players.map(p => `
    <tr>
      <td>${escapeHtml(p.username)}</td>
      <td class="uuid-cell">${p.uuid}</td>
      <td class="muted">${timeAgo(p.added_at)}</td>
      <td><button class="remove-btn" data-uuid="${p.uuid}">remove</button></td>
    </tr>
  `).join('');

  document.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', () => removePlayer(btn.dataset.uuid));
  });
}

async function loadConnections() {
  const res = await fetch('/api/connections', { headers: authHeaders() });
  if (!res.ok) return;
  const rows = await res.json();
  if (rows.length === 0) {
    connectionsBody.innerHTML = '<tr><td colspan="3" class="muted">no connections logged yet</td></tr>';
    return;
  }
  connectionsBody.innerHTML = rows.map(r => `
    <tr>
      <td>${escapeHtml(r.username)}</td>
      <td class="muted">${escapeHtml(r.ip || '')}</td>
      <td class="muted">${timeAgo(r.connected_at)}</td>
    </tr>
  `).join('');
}

async function addPlayer() {
  const username = addUsername.value.trim();
  addFeedback.textContent = '';
  addFeedback.className = 'feedback';
  if (!username) return;

  addBtn.disabled = true;
  try {
    const res = await fetch('/api/players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ username })
    });
    const data = await res.json();
    if (!res.ok) {
      addFeedback.textContent = data.error || 'Failed to add player';
      addFeedback.classList.add('err');
      return;
    }
    addFeedback.textContent = `added ${data.username}`;
    addFeedback.classList.add('ok');
    addUsername.value = '';
    loadPlayers();
  } catch (err) {
    addFeedback.textContent = 'Network error';
    addFeedback.classList.add('err');
  } finally {
    addBtn.disabled = false;
  }
}

addBtn.addEventListener('click', addPlayer);
addUsername.addEventListener('keydown', (e) => { if (e.key === 'Enter') addPlayer(); });

async function removePlayer(uuid) {
  await fetch(`/api/players/${uuid}`, { method: 'DELETE', headers: authHeaders() });
  loadPlayers();
}

refreshBtn.addEventListener('click', () => { loadPlayers(); loadConnections(); });

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

setInterval(() => { if (token) loadConnections(); }, 15000);
