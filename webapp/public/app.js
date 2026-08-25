let token = localStorage.getItem('swl_token') || null;
let whitelistedUuids = new Set();
let whitelistedNames = new Set();

const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const passwordInput = document.getElementById('password-input');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');

const addUsername = document.getElementById('add-username');
const addBtn = document.getElementById('add-btn');
const addFeedback = document.getElementById('add-feedback');
const refreshBtn = document.getElementById('refresh-btn');
const playersBody = document.getElementById('players-body');
const kicksBody = document.getElementById('kicks-body');
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
    localStorage.setItem('swl_token', token);
    loginScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');
    await loadPlayers();
    loadKicks();
  } catch (err) {
    loginError.textContent = 'Could not reach server';
  }
}

function logout() {
  token = null;
  localStorage.removeItem('swl_token');
  appScreen.classList.add('hidden');
  loginScreen.classList.remove('hidden');
  passwordInput.value = '';
}

if (logoutBtn) logoutBtn.addEventListener('click', logout);
loginBtn.addEventListener('click', login);
passwordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') login(); });

async function initSession() {
  if (!token) return;
  try {
    const res = await fetch('/api/players', { headers: authHeaders() });
    if (res.ok) {
      loginScreen.classList.add('hidden');
      appScreen.classList.remove('hidden');
      await loadPlayers();
      loadKicks();
    } else {
      token = null;
      localStorage.removeItem('swl_token');
    }
  } catch (err) {}
}

initSession();

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

async function fetchAuth(url, options = {}) {
  const headers = { ...(options.headers || {}), ...authHeaders() };
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    logout();
    throw new Error('Session expired or unauthorized');
  }
  return res;
}

async function loadPlayers() {
  try {
    const res = await fetchAuth('/api/players');
    if (!res.ok) return;
    const players = await res.json();
    playerCount.textContent = `${players.length} player${players.length === 1 ? '' : 's'}`;

    whitelistedUuids = new Set(players.map(p => p.uuid));
    whitelistedNames = new Set(players.map(p => (p.username || '').toLowerCase()));

    if (players.length === 0) {
      playersBody.innerHTML = '<tr><td colspan="4" class="muted">no one whitelisted yet</td></tr>';
      return;
    }

    playersBody.innerHTML = players.map(p => `
      <tr>
        <td><strong>${escapeHtml(p.username)}</strong></td>
        <td class="uuid-cell">${escapeHtml(p.uuid)}</td>
        <td class="muted">${timeAgo(p.added_at)}</td>
        <td><button class="remove-btn" data-uuid="${escapeHtml(p.uuid)}">remove</button></td>
      </tr>
    `).join('');

    document.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', () => removePlayer(btn.dataset.uuid));
    });
  } catch (err) {}
}

async function loadKicks() {
  try {
    const res = await fetchAuth('/api/kicks');
    if (!res.ok) return;
    const rows = await res.json();
    if (rows.length === 0) {
      kicksBody.innerHTML = '<tr><td colspan="5" class="muted">no kicks or blocked attempts logged yet</td></tr>';
      return;
    }
    kicksBody.innerHTML = rows.map(r => {
      const isWhitelisted = (r.uuid && whitelistedUuids.has(r.uuid)) ||
                            (r.username && whitelistedNames.has(r.username.toLowerCase()));
      return `
        <tr>
          <td><strong>${escapeHtml(r.username)}</strong></td>
          <td><span class="tag-danger">${escapeHtml(r.reason || 'Not Whitelisted')}</span></td>
          <td class="muted">${escapeHtml(r.ip || '')}</td>
          <td class="muted">${timeAgo(r.kicked_at)}</td>
          <td>
            ${isWhitelisted
              ? '<span class="tag-allowed">whitelisted &#10003;</span>'
              : `<button class="allow-btn" data-name="${escapeHtml(r.username)}" data-uuid="${escapeHtml(r.uuid || '')}">allow connection</button>`
            }
          </td>
        </tr>
      `;
    }).join('');

    document.querySelectorAll('.allow-btn').forEach(btn => {
      btn.addEventListener('click', () => allowPlayer(btn.dataset.name, btn.dataset.uuid, btn));
    });
  } catch (err) {}
}

async function allowPlayer(username, uuid, btn) {
  if (!username) return;
  btn.disabled = true;
  btn.textContent = 'allowing...';
  try {
    const res = await fetchAuth('/api/players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, uuid })
    });
    const data = await res.json();
    if (!res.ok) {
      btn.textContent = 'failed';
      btn.disabled = false;
      addFeedback.textContent = data.error || 'Failed to allow player';
      addFeedback.className = 'feedback err';
      return;
    }
    btn.outerHTML = '<span class="tag-allowed">whitelisted &#10003;</span>';
    addFeedback.textContent = `allowed and whitelisted ${data.username}`;
    addFeedback.className = 'feedback ok';
    await loadPlayers();
  } catch (err) {
    btn.textContent = 'error';
    btn.disabled = false;
    addFeedback.textContent = err.message || 'Network error';
    addFeedback.className = 'feedback err';
  }
}

async function addPlayer() {
  const username = addUsername.value.trim();
  addFeedback.textContent = '';
  addFeedback.className = 'feedback';
  if (!username) return;

  addBtn.disabled = true;
  try {
    const res = await fetchAuth('/api/players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    const data = await res.json();
    if (!res.ok) {
      addFeedback.textContent = data.error || 'Failed to add player';
      addFeedback.className = 'feedback err';
      return;
    }
    addFeedback.textContent = `added ${data.username}`;
    addFeedback.className = 'feedback ok';
    addUsername.value = '';
    await loadPlayers();
    loadKicks();
  } catch (err) {
    addFeedback.textContent = err.message || 'Network error';
    addFeedback.className = 'feedback err';
  } finally {
    addBtn.disabled = false;
  }
}

addBtn.addEventListener('click', addPlayer);
addUsername.addEventListener('keydown', (e) => { if (e.key === 'Enter') addPlayer(); });

async function removePlayer(uuid) {
  try {
    await fetchAuth(`/api/players/${encodeURIComponent(uuid)}`, { method: 'DELETE' });
    await loadPlayers();
    loadKicks();
  } catch (err) {}
}

refreshBtn.addEventListener('click', async () => {
  await loadPlayers();
  loadKicks();
});

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

setInterval(async () => {
  if (token) {
    await loadPlayers();
    loadKicks();
  }
}, 10000);


