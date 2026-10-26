/* ============================================
   KKPL – API data layer
   ============================================ */

let teamsCache = [];
let playersCache = [];
let sessionCache = null;
let currentAuctionCache = null;
let lastAuctionOutcomeCache = null;
let matchesCache = [];

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
    const [teams, players, auctionSnapshot, matches] = await Promise.all([
      apiRequest('/api/teams'),
      apiRequest('/api/players'),
      apiRequest('/api/auction/state'),
      apiRequest('/api/matches')
    ]);
    teamsCache = teams;
    playersCache = players;
    currentAuctionCache = auctionSnapshot.currentAuction;
    lastAuctionOutcomeCache = auctionSnapshot.lastOutcome;
    matchesCache = matches;
    return;
  }
  if (sessionCache.type === 'team') {
    const result = await apiRequest('/api/team/portal');
    teamsCache = result.teams;
    playersCache = result.players;
    currentAuctionCache = result.currentAuction;
    lastAuctionOutcomeCache = result.lastOutcome;
    matchesCache = result.matches || [];
  }
}

function getTeams() { return teamsCache; }
function getPlayers() { return playersCache; }
function getTeamById(id) { return teamsCache.find((team) => team.id === id) || null; }
function getPlayerById(id) { return playersCache.find((player) => player.id === id) || null; }
function getCurrentAuction() { return currentAuctionCache; }
function getLastAuctionOutcome() { return lastAuctionOutcomeCache; }
function getMatches() { return matchesCache; }
function getSession() { return sessionCache; }
function setSession(user) { sessionCache = user; }

function getMatchOutcome(match) {
  if (match.status !== 'completed') return null;
  if (match.tieBreak?.phase === 'completed') {
    if (match.tieBreak.goldenRaid) {
      const winner = match.tieBreak.winnerTeamId === match.homeTeam.id ? match.homeTeam : match.awayTeam;
      return `${winner.name} won the Golden Raid`;
    }
    if (match.tieBreak.homeScore !== match.tieBreak.awayScore) {
      const winner = match.tieBreak.homeScore > match.tieBreak.awayScore ? match.homeTeam : match.awayTeam;
      const margin = Math.abs(match.tieBreak.homeScore - match.tieBreak.awayScore);
      return `${winner.name} won the Super 5 by ${margin} ${margin === 1 ? 'point' : 'points'}`;
    }
  }
  if (match.homeScore === match.awayScore) return 'Match tied';
  const winner = match.homeScore > match.awayScore ? match.homeTeam : match.awayTeam;
  const margin = Math.abs(match.homeScore - match.awayScore);
  return `${winner.name} won by ${margin} ${margin === 1 ? 'point' : 'points'}`;
}

function getMatchRoundLabel(match) {
  const labels = {
    league: 'Match',
    quarterfinal: 'Quarterfinal',
    semifinal: 'Semifinal',
    final: 'Final'
  };
  return `${labels[match.roundType] || 'Match'} ${match.roundNumber}`;
}

function renderSeasonStats(containerId, ranking = document.getElementById(`${containerId}-ranking`)?.value || 'total') {
  const container = document.getElementById(containerId);
  const rankingOptions = {
    total: { label: 'Total points', points: (stat) => stat.total },
    tackle: { label: 'Tackle points', points: (stat) => stat.tacklePoints },
    raidBonus: { label: 'Raid + bonus points', points: (stat) => stat.raidPoints + stat.bonusPoints }
  };
  if (!rankingOptions[ranking]) ranking = 'total';
  const selectedRanking = rankingOptions[ranking];
  const teams = getTeams();
  const players = getPlayers();
  const matches = getMatches();
  const playerStats = new Map();
  const standings = new Map(teams.map((team) => [team.id, {
    team,
    played: 0,
    won: 0,
    tied: 0,
    lost: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    leaguePoints: 0
  }]));

  matches.forEach((match) => {
    if (!['live', 'completed'].includes(match.status)) return;
    match.playerPoints.forEach((score) => {
      const stat = playerStats.get(score.playerId) || {
        playerId: score.playerId,
        playerName: score.playerName,
        teamId: score.teamId,
        matches: new Set(),
        raidPoints: 0,
        tacklePoints: 0,
        bonusPoints: 0,
        otherPoints: 0,
        total: 0
      };
      stat.matches.add(match.id);
      stat.raidPoints += score.raidPoints;
      stat.tacklePoints += score.tacklePoints;
      stat.bonusPoints += score.bonusPoints;
      stat.otherPoints += score.otherPoints;
      stat.total += score.total;
      playerStats.set(score.playerId, stat);
    });

    if (match.status !== 'completed') return;
    const home = standings.get(match.homeTeam.id);
    const away = standings.get(match.awayTeam.id);
    if (!home || !away) return;
    home.played += 1;
    away.played += 1;
    home.pointsFor += match.homeScore;
    home.pointsAgainst += match.awayScore;
    away.pointsFor += match.awayScore;
    away.pointsAgainst += match.homeScore;
    if (match.homeScore === match.awayScore) {
      home.tied += 1;
      away.tied += 1;
      home.leaguePoints += 2;
      away.leaguePoints += 2;
    } else {
      const winner = match.homeScore > match.awayScore ? home : away;
      const loser = winner === home ? away : home;
      const margin = Math.abs(match.homeScore - match.awayScore);
      winner.won += 1;
      winner.leaguePoints += 5;
      loser.lost += 1;
      if (margin <= 5) loser.leaguePoints += 1;
    }
  });

  const playerRows = [...playerStats.values()]
    .sort((a, b) => selectedRanking.points(b) - selectedRanking.points(a) ||
      b.total - a.total || a.playerName.localeCompare(b.playerName))
    .map((stat, index) => {
      const player = players.find((item) => item.id === stat.playerId);
      const team = teams.find((item) => item.id === stat.teamId) ||
        teams.find((item) => item.id === player?.teamId);
      return `<tr><td>${index + 1}</td><th scope="row">${escapeHtml(stat.playerName)}</th>
        <td>${escapeHtml(team?.name || '—')}</td><td>${escapeHtml(player?.category || '—')}</td>
        <td>${stat.matches.size}</td><td>${stat.raidPoints}</td><td>${stat.tacklePoints}</td>
        <td>${stat.bonusPoints}</td><td>${stat.otherPoints}</td><td><strong>${stat.total}</strong></td>
        <td><strong>${selectedRanking.points(stat)}</strong></td></tr>`;
    }).join('') || '<tr><td colspan="11" class="season-stats-empty">No player points have been recorded yet.</td></tr>';

  const teamRows = [...standings.values()]
    .sort((a, b) => b.leaguePoints - a.leaguePoints || b.won - a.won ||
      (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst) ||
      b.pointsFor - a.pointsFor || a.team.name.localeCompare(b.team.name))
    .map((row, index) => `<tr>
      <td>${index + 1}</td><th scope="row">${escapeHtml(row.team.name)}</th>
      <td>${row.played}</td><td>${row.won}</td><td>${row.tied}</td><td>${row.lost}</td>
      <td>${row.pointsFor}</td><td>${row.pointsAgainst}</td>
      <td>${row.pointsFor - row.pointsAgainst}</td><td><strong>${row.leaguePoints}</strong></td>
    </tr>`).join('') || '<tr><td colspan="10" class="season-stats-empty">No teams are registered.</td></tr>';

  container.innerHTML = `
    <section class="card glass season-stats-card">
      <div class="card-header">🏅 Player Statistics</div>
      <p class="season-stats-note">Totals include recorded events from live and completed matches.</p>
      <label class="season-stats-filter" for="${containerId}-ranking">Rank players by
        <select id="${containerId}-ranking" onchange="renderSeasonStats('${containerId}', this.value)">
          <option value="total" ${ranking === 'total' ? 'selected' : ''}>Total points</option>
          <option value="tackle" ${ranking === 'tackle' ? 'selected' : ''}>Tackle points</option>
          <option value="raidBonus" ${ranking === 'raidBonus' ? 'selected' : ''}>Raid + bonus points</option>
        </select>
      </label>
      <div class="table-wrap">
        <table class="data-table season-stats-table">
          <thead><tr><th>#</th><th>Player</th><th>Team</th><th>Role</th><th>Matches</th>
            <th>Raid</th><th>Tackle</th><th>Bonus</th><th>Other</th><th>Total</th>
            <th>Ranked: ${escapeHtml(selectedRanking.label)}</th></tr></thead>
          <tbody>${playerRows}</tbody>
        </table>
      </div>
    </section>
    <section class="card glass season-stats-card">
      <div class="card-header">🏆 League Points Table</div>
      <p class="season-stats-note">Completed matches only. Win: 5 points · Tie: 2 points · Loss by 5 or fewer: 1 point · Loss by more than 5: 0 points.</p>
      <div class="table-wrap">
        <table class="data-table season-stats-table">
          <thead><tr><th>#</th><th>Team</th><th>Played</th><th>Won</th><th>Tied</th>
            <th>Lost</th><th>For</th><th>Against</th><th>Diff</th><th>Pts</th></tr></thead>
          <tbody>${teamRows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function clearSession() {
  sessionCache = null;
  teamsCache = [];
  playersCache = [];
  currentAuctionCache = null;
  lastAuctionOutcomeCache = null;
  matchesCache = [];
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

async function cancelAuction(playerId) {
  await apiRequest('/api/auction/cancel', {
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

async function createMatch(match) {
  await apiRequest('/api/matches', { method: 'POST', body: JSON.stringify(match) });
  await refreshData();
}

async function deleteMatch(id) {
  await apiRequest(`/api/matches/${encodeURIComponent(id)}`, { method: 'DELETE' });
  await refreshData();
}

async function updateMatchSchedule(id, match) {
  await apiRequest(`/api/matches/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(match)
  });
  await refreshData();
}

async function updateMatchStatus(id, status) {
  await apiRequest(`/api/matches/${encodeURIComponent(id)}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status })
  });
  await refreshData();
}

async function updateMatchToss(id, toss) {
  await apiRequest(`/api/matches/${encodeURIComponent(id)}/toss`, {
    method: 'PUT',
    body: JSON.stringify(toss)
  });
  await refreshData();
}

async function updateGoldenRaidToss(id, toss) {
  await apiRequest(`/api/matches/${encodeURIComponent(id)}/golden-toss`, {
    method: 'PUT',
    body: JSON.stringify(toss)
  });
  await refreshData();
}

async function createMatchEvent(id, scoreEvent) {
  await apiRequest(`/api/matches/${encodeURIComponent(id)}/events`, {
    method: 'POST',
    body: JSON.stringify(scoreEvent)
  });
  await refreshData();
}

async function deleteMatchEvent(id, eventId) {
  await apiRequest(`/api/matches/${encodeURIComponent(id)}/events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE'
  });
  await refreshData();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
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
