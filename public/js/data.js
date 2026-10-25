/* ============================================
   KKPL – API data layer
   ============================================ */

let teamsCache = [];
let playersCache = [];
let sessionCache = null;
let currentAuctionCache = null;
let lastAuctionOutcomeCache = null;

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    },
    credentials: 'same-origin'
  });

  if (response.status === 204) return null;
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'The request could not be completed.');
  return result;
}

async function initData() {
  const result = await apiRequest('/api/auth/session');
  sessionCache = result.user;
  return sessionCache;
}

async function refreshData() {
  if (!sessionCache) return;
  if (sessionCache.type === 'admin') {
    const [teams, players, auctionSnapshot] = await Promise.all([
      apiRequest('/api/teams'),
      apiRequest('/api/players'),
      apiRequest('/api/auction/state')
    ]);
    teamsCache = teams;
    playersCache = players;
    currentAuctionCache = auctionSnapshot.currentAuction;
    lastAuctionOutcomeCache = auctionSnapshot.lastOutcome;
    return;
  }
  if (sessionCache.type === 'team') {
    const result = await apiRequest('/api/team/portal');
    teamsCache = result.teams;
    playersCache = result.players;
    currentAuctionCache = result.currentAuction;
    lastAuctionOutcomeCache = result.lastOutcome;
  }
}

function getTeams() { return teamsCache; }
function getPlayers() { return playersCache; }
function getTeamById(id) { return teamsCache.find((team) => team.id === id) || null; }
function getPlayerById(id) { return playersCache.find((player) => player.id === id) || null; }
function getCurrentAuction() { return currentAuctionCache; }
function getLastAuctionOutcome() { return lastAuctionOutcomeCache; }
function getSession() { return sessionCache; }
function setSession(user) { sessionCache = user; }
function clearSession() {
  sessionCache = null;
  teamsCache = [];
  playersCache = [];
  currentAuctionCache = null;
  lastAuctionOutcomeCache = null;
}

async function createTeam(team) {
  await apiRequest('/api/teams', { method: 'POST', body: JSON.stringify(team) });
  await refreshData();
}

async function updateTeam(id, team) {
  await apiRequest(`/api/teams/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(team) });
  await refreshData();
}

async function deleteTeam(id) {
  await apiRequest(`/api/teams/${encodeURIComponent(id)}`, { method: 'DELETE' });
  await refreshData();
}

async function createPlayer(player) {
  await apiRequest('/api/players', { method: 'POST', body: JSON.stringify(player) });
  await refreshData();
}

async function updatePlayer(id, player) {
  await apiRequest(`/api/players/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(player) });
  await refreshData();
}

async function deletePlayer(id) {
  await apiRequest(`/api/players/${encodeURIComponent(id)}`, { method: 'DELETE' });
  await refreshData();
}

async function setCurrentAuctionPlayer(playerId) {
  await apiRequest('/api/auction/state', {
    method: 'PUT',
    body: JSON.stringify({ playerId })
  });
  await refreshData();
}

async function submitTeamBid(playerId, teamId, incrementRupees) {
  await apiRequest('/api/auction/bid', {
    method: 'POST',
    body: JSON.stringify({ playerId, teamId, incrementRupees })
  });
  await refreshData();
}

async function undoAuctionBid(playerId) {
  await apiRequest('/api/auction/undo-bid', {
    method: 'POST',
    body: JSON.stringify({ playerId })
  });
  await refreshData();
}

async function restartAuctionBidding(playerId) {
  await apiRequest('/api/auction/restart-bidding', {
    method: 'POST',
    body: JSON.stringify({ playerId })
  });
  await refreshData();
}

async function sellPlayer(playerId) {
  await apiRequest('/api/auction/sell', {
    method: 'POST',
    body: JSON.stringify({ playerId })
  });
  await refreshData();
}

async function markPlayerUnsold(playerId) {
  await apiRequest('/api/auction/unsold', {
    method: 'POST',
    body: JSON.stringify({ playerId })
  });
  await refreshData();
}

function categoryBadge(cat) {
  if (cat === 'Raider') return 'badge-raider';
  if (cat === 'Defender') return 'badge-defender';
  return 'badge-allrounder';
}

function statusBadge(status) {
  if (status === 'Sold') return 'badge-sold';
  if (status === 'Unsold') return 'badge-unsold';
  return 'badge-available';
}

/**
 * formatPrice – all internal values are in Lakhs.
 * < 1L    → shows in Rupees  e.g. ₹50,000
 * 1–99L   → shows as Lakhs   e.g. ₹75 L
 * ≥ 100L  → shows as Crores  e.g. ₹4.00 Cr
 */
function formatPrice(lakhs, forceUnit) {
  if (!lakhs && lakhs !== 0) return '—';
  const n = parseFloat(lakhs);
  if (forceUnit === 'L')  return '₹' + n.toFixed(n % 1 === 0 ? 0 : 2) + ' L';
  if (forceUnit === 'Cr') return '₹' + (n / 100).toFixed(2) + ' Cr';
  if (forceUnit === 'Rs') return '₹' + (n * 100000).toLocaleString('en-IN');
  if (n === 0) return '₹0';
  if (n >= 100) return '₹' + (n / 100).toFixed(2) + ' Cr';
  if (n >= 1) return '₹' + (Number.isInteger(n) ? n : n.toFixed(2)) + ' L';
  return '₹' + Math.round(n * 100000).toLocaleString('en-IN');
}

function toLakhs(value, unit) {
  const v = parseFloat(value) || 0;
  if (unit === 'Cr') return v * 100;
  if (unit === 'Rs') return v / 100000;
  return v;
}

function fromLakhs(lakhs, unit) {
  const v = parseFloat(lakhs) || 0;
  if (unit === 'Cr') return parseFloat((v / 100).toFixed(4));
  if (unit === 'Rs') return Math.round(v * 100000);
  return v;
}

function showToast(msg, isError = false) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.className = 'toast'; }, 3000);
}

function showRequestError(error) {
  showToast(error.message || 'The request could not be completed.', true);
}

function showAuctionOutcome(outcome) {
  const overlay = document.getElementById('auction-result-overlay');
  if (!overlay || !outcome || !outcome.player) return;

  const sold = outcome.status === 'Sold';
  const photo = document.getElementById('auction-result-photo');
  const placeholder = document.getElementById('auction-result-photo-placeholder');
  document.getElementById('auction-result-kicker').textContent = sold ? 'PLAYER SOLD' : 'AUCTION RESULT';
  document.getElementById('auction-result-title').textContent = sold ? 'SOLD' : 'UNSOLD';
  document.getElementById('auction-result-player').textContent = outcome.player.name;
  document.getElementById('auction-result-team').textContent = sold
    ? `SOLD TO ${outcome.teamName || 'the leading team'}`
    : 'DID NOT SELL';
  document.getElementById('auction-result-price').textContent = sold
    ? formatPrice(outcome.player.soldPrice)
    : '';
  document.getElementById('auction-result-price').hidden = !sold;
  photo.hidden = !outcome.player.photoUrl;
  photo.alt = outcome.player.name;
  if (outcome.player.photoUrl) photo.src = outcome.player.photoUrl;
  placeholder.hidden = Boolean(outcome.player.photoUrl);
  overlay.classList.toggle('is-unsold', !sold);
  overlay.hidden = false;
  document.body.classList.add('auction-result-open');
  clearTimeout(overlay._timer);
  overlay._timer = setTimeout(closeAuctionOutcome, 8000);
}

function closeAuctionOutcome() {
  const overlay = document.getElementById('auction-result-overlay');
  if (!overlay) return;
  clearTimeout(overlay._timer);
  overlay.hidden = true;
  document.body.classList.remove('auction-result-open');
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeAuctionOutcome();
});

async function logout() {
  try {
    await apiRequest('/api/auth/logout', { method: 'POST' });
    clearSession();
    window.location.href = '/';
  } catch (error) {
    showRequestError(error);
  }
}

function toggleSidebar() {
  const s = document.getElementById('sidebar');
  s.classList.toggle('collapsed');
  s.classList.toggle('open');
}
