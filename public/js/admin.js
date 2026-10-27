/* ============================================
   KKPL – Admin Dashboard JS  (v2)
   All monetary values stored internally in LAKHS.
   ============================================ */

let currentAuctionPlayerId = null;
let queueFilter = 'Available';
let queueRoleFilter = '';
let playerPhotoPreviewUrl = null;

// ---- Navigation ----
function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const el = document.getElementById('section-' + name);
  if (el) el.classList.add('active');
  const titles = {
    dashboard: 'Dashboard', teams: 'Manage Teams',
    players: 'Player Pool', auction: 'Live Auction', results: 'Auction Results',
    matches: 'Match Schedule & Scorecards', stats: 'Player Stats & League Points'
  };
  document.getElementById('page-title').textContent = titles[name] || name;
  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.getAttribute('onclick') && n.getAttribute('onclick').includes("'" + name + "'")) {
      n.classList.add('active');
    }
  });
  if (name === 'dashboard') renderDashboard();
  if (name === 'teams')     renderTeams();
  if (name === 'players')   renderPlayers();
  if (name === 'auction')   renderAuction();
  if (name === 'results')   renderResults();
  if (name === 'matches')   renderAdminMatches();
  if (name === 'stats')     renderSeasonStats('admin-season-stats');
}

// ---- DASHBOARD ----
function renderDashboard() {
  const teams   = getTeams();
  const players = getPlayers();
  const sold      = players.filter(p => p.status === 'Sold');
  const unsold    = players.filter(p => p.status === 'Unsold');
  const available = players.filter(p => p.status === 'Available');
  const totalSpentL = sold.reduce((s, p) => s + (p.soldPrice || 0), 0);

  const stats = [
    { icon: '🏆', label: 'Teams',        val: teams.length,    color: '#ff6b00' },
    { icon: '🧍', label: 'Total Players', val: players.length,  color: '#a855f7' },
    { icon: '✅', label: 'Sold',          val: sold.length,     color: '#22c55e' },
    { icon: '⏳', label: 'Available',     val: available.length, color: '#f59e0b' },
    { icon: '❌', label: 'Unsold',        val: unsold.length,   color: '#ef4444' },
    { icon: '💰', label: 'Total Spent',   val: formatPrice(totalSpentL), color: '#38bdf8' },
  ];

  document.getElementById('stats-grid').innerHTML = stats.map(s => `
    <div class="stat-card" style="--stat-color:${s.color}">
      <div class="stat-icon">${s.icon}</div>
      <div class="stat-val">${s.val}</div>
      <div class="stat-label">${s.label}</div>
    </div>
  `).join('');

  // Teams list
  const tl = document.getElementById('dash-teams-list');
  tl.innerHTML = teams.length === 0
    ? '<div class="mini-item"><span class="mi-name" style="color:var(--text-muted)">No teams yet</span></div>'
    : teams.map(t => {
      const bL = t.budgetLakhs || 0;
      const sL = t.spentLakhs  || 0;
      const remL = Math.max(0, bL - sL);
      return `
        <div class="mini-item">
          <span class="color-dot" style="background:${t.color}"></span>
          <span class="mi-name">${t.name}</span>
          <span style="font-size:0.75rem;color:var(--text-muted)">${formatPrice(remL)} left</span>
          <span class="mi-badge" style="background:${t.color}22;color:${t.color};border:1px solid ${t.color}44">
            ${t.players ? t.players.length : 0} Players
          </span>
        </div>`;
    }).join('');

  // Recent bids
  const bl = document.getElementById('dash-bids-list');
  const recentSold = sold.slice(-6).reverse();
  bl.innerHTML = recentSold.length === 0
    ? '<div class="mini-item"><span class="mi-name" style="color:var(--text-muted)">No bids yet</span></div>'
    : recentSold.map(p => `
        <div class="mini-item">
          <span class="mi-name">${p.name}</span>
          <span class="badge ${categoryBadge(p.category)}">${p.category}</span>
          <span style="color:var(--success);font-weight:600;font-size:0.82rem">${formatPrice(p.soldPrice)}</span>
        </div>`).join('');
}

// ---- TEAMS ----
function renderTeams() {
  const teams   = getTeams();
  const players = getPlayers();
  const tbody   = document.getElementById('teams-tbody');

  tbody.innerHTML = teams.length === 0
    ? `<tr><td colspan="10" style="text-align:center;color:var(--text-muted);padding:40px">No teams added yet. Click "+ Add Team" to begin.</td></tr>`
    : teams.map((t, i) => {
      const teamPlayers = players.filter(p => p.teamId === t.id);
      const budL = t.budgetLakhs || 0;
      const sptL = t.spentLakhs  || 0;
      const remL = Math.max(0, budL - sptL);
      return `
        <tr>
          <td>${i + 1}</td>
          <td>
            <div style="display:flex;align-items:center;gap:8px">
              <span class="color-dot" style="background:${t.color}"></span>
              <strong>${t.name}</strong>
            </div>
            ${t.sponsor ? `<div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px">🏢 ${t.sponsor}</div>` : ''}
          </td>
          <td>${t.city}</td>
          <td>${t.coach || '—'}</td>
          <td><div style="font-size:0.8rem;color:var(--text-secondary)">${t.email}</div></td>
          <td style="color:var(--available);font-weight:600">${formatPrice(budL)}</td>
          <td style="color:var(--danger);font-weight:600">${formatPrice(sptL)}</td>
          <td style="color:var(--success);font-weight:600">${formatPrice(remL)}</td>
          <td>
            <span class="badge" style="background:${t.color}22;color:${t.color};border:1px solid ${t.color}44">
              ${teamPlayers.length}
            </span>
          </td>
          <td style="white-space:nowrap">
            <button class="btn-icon" onclick="openTeamModal('${t.id}')">✏️ Edit</button>
            <button class="btn-icon danger" onclick="removeTeam('${t.id}')">🗑️ Delete</button>
          </td>
        </tr>
      `;
    }).join('');
}

// ---- PLAYERS ----
function renderPlayers() {
  const catFilter    = document.getElementById('filter-category').value;
  const statusFilter = document.getElementById('filter-status').value;
  const search       = document.getElementById('filter-search').value.toLowerCase();
  const tierFilter   = document.getElementById('filter-auction-tier').value;

  let players = getPlayers().filter(p => {
    const matchCat    = !catFilter    || p.category === catFilter;
    const matchTier   = !tierFilter   || p.auctionTier === tierFilter;
    const matchStatus = !statusFilter || p.status === statusFilter;
    const matchSearch = !search       || p.name.toLowerCase().includes(search) || (p.prevTeam || '').toLowerCase().includes(search);
    return matchCat && matchTier && matchStatus && matchSearch;
  });

  const teams = getTeams();
  const tbody = document.getElementById('players-tbody');

  tbody.innerHTML = players.length === 0
    ? `<tr><td colspan="11" style="text-align:center;color:var(--text-muted);padding:40px">No players found</td></tr>`
    : players.map((p, i) => {
      const team = p.teamId ? teams.find(t => t.id === p.teamId) : null;
      return `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${p.name}</strong></td>
          <td><span class="badge ${categoryBadge(p.category)}">${p.category}</span></td>
          <td><span class="tier-badge tier-${p.auctionTier.toLowerCase()}">Tier ${p.auctionTier}</span></td>
          <td>${formatPrice(p.basePrice, 'Rs')}</td>
          <td>${p.age}</td>
          <td>${p.nationality || '—'}</td>
          <td><span class="badge ${statusBadge(p.status)}">${p.status}</span></td>
          <td>
            ${team
              ? `<span style="display:flex;align-items:center;gap:5px"><span class="color-dot" style="background:${team.color}"></span>${team.name}</span>`
              : '—'}
          </td>
          <td>${p.soldPrice ? formatPrice(p.soldPrice) : '—'}</td>
          <td>
            <button class="btn-icon" onclick="openPlayerModal('${p.id}')">✏️</button>
            <button class="btn-icon danger" onclick="removePlayer('${p.id}')">🗑️</button>
          </td>
        </tr>
      `;
    }).join('');
}

// ---- AUCTION ----
function renderAuction() {
  renderQueue();
  if (!currentAuctionPlayerId && getCurrentAuction()) {
    currentAuctionPlayerId = getCurrentAuction().id;
  }
  if (currentAuctionPlayerId) showPlayerOnBlock(currentAuctionPlayerId);
}

function filterQueue(status, btn) {
  queueFilter = status;
  document.querySelectorAll('.q-filter').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderQueue();
}

function setAuctionRoleFilter(role) {
  queueRoleFilter = role;
  renderQueue();
}

function renderQueue() {
  const allPlayers = getPlayers();
  const availablePlayersRemain = allPlayers.some(p => p.status === 'Available');
  let players = allPlayers.filter(p => {
    const matchesStatus = queueFilter === 'all' ? p.status !== 'Sold' : p.status === queueFilter;
    return matchesStatus && (!queueRoleFilter || p.category === queueRoleFilter);
  });

  const list = document.getElementById('auction-queue-list');
  list.innerHTML = players.length === 0
    ? '<div style="color:var(--text-muted);text-align:center;padding:24px;font-size:0.85rem">No players</div>'
    : players.map(p => {
      const canSelect = p.status === 'Available' || (p.status === 'Unsold' && !availablePlayersRemain);
      return `
      <div class="queue-item ${p.id === currentAuctionPlayerId ? 'active-bid' : ''} ${canSelect ? '' : 'queue-item-disabled'}"
           ${canSelect ? `onclick="setAuctionPlayer('${p.id}')"` : 'aria-disabled="true" title="Unsold players can be re-auctioned after all available players are sold"'}>
        <div>
          <div class="qi-name">${p.name}</div>
          <span class="badge ${categoryBadge(p.category)} qi-cat">${p.category}</span>
          <span class="tier-badge tier-${p.auctionTier.toLowerCase()}">Tier ${p.auctionTier}</span>
        </div>
        <div style="text-align:right">
          <span class="badge ${statusBadge(p.status)} qi-status">${p.status}</span>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:3px">${formatPrice(p.basePrice, 'Rs')}</div>
        </div>
      </div>
    `;
    }).join('');
}

async function setAuctionPlayer(playerId) {
  try {
    await setCurrentAuctionPlayer(playerId);
  } catch (error) {
    showRequestError(error);
    return;
  }
  currentAuctionPlayerId = playerId;
  showPlayerOnBlock(playerId);
  renderQueue();
}

function showPlayerOnBlock(playerId) {
  const p = getPlayerById(playerId);
  if (!p) {
    currentAuctionPlayerId = null;
    document.getElementById('auction-player-display').innerHTML = '<div class="no-player-msg">Select a player to start auction</div>';
    document.getElementById('bid-controls').style.display = 'none';
    return;
  }
  const leadingTeam = p.currentTeamId ? getTeamById(p.currentTeamId) : null;
  const team = p.teamId ? getTeamById(p.teamId) : null;

  document.getElementById('auction-player-display').innerHTML = `
    <div class="obp-profile">
      ${p.photoUrl
        ? `<img class="obp-photo" src="${p.photoUrl}" alt="${p.name}"/>`
        : '<div class="obp-photo-placeholder" aria-hidden="true">🏉</div>'}
      <div class="obp-player-info">
        <div class="obp-name">${p.name}</div>
        <div class="obp-meta">
          <span class="badge ${categoryBadge(p.category)}">${p.category}</span>
          <span class="tier-badge tier-${p.auctionTier.toLowerCase()}">Tier ${p.auctionTier}</span>
          <span class="badge ${statusBadge(p.status)}">${p.status}</span>
        </div>
      </div>
    </div>
    <div class="obp-detail-row">
      <div class="obp-detail">
        <span class="obp-detail-key">Age</span>
        <span class="obp-detail-val">${p.age} yrs</span>
      </div>
      <div class="obp-detail">
        <span class="obp-detail-key">Nationality</span>
        <span class="obp-detail-val">${p.nationality || '—'}</span>
      </div>
      <div class="obp-detail">
        <span class="obp-detail-key">Prev Team</span>
        <span class="obp-detail-val">${p.prevTeam || '—'}</span>
      </div>
      <div class="obp-detail">
        <span class="obp-detail-key">Skills</span>
        <span class="obp-detail-val" style="font-size:0.85rem">${p.skills || '—'}</span>
      </div>
      <div class="obp-detail">
        <span class="obp-detail-key">Base Price</span>
        <span class="obp-detail-val obp-base-price">${formatPrice(p.basePrice, 'Rs')}</span>
      </div>
      <div class="obp-detail">
        <span class="obp-detail-key">Current Team</span>
        <span class="obp-detail-val">${team ? team.name : '—'}</span>
      </div>
    </div>
  `;

  document.getElementById('bid-controls').style.display = 'flex';
  const displayedBid = p.currentBid === null ? p.soldPrice || p.basePrice : p.currentBid;
  document.getElementById('current-bid-val').textContent = formatPrice(displayedBid, 'Rs');
  const bidIncrement = getBidIncrementRupees(displayedBid);
  document.getElementById('bid-increment-value').textContent = `₹${bidIncrement.toLocaleString('en-IN')}`;
  document.getElementById('leading-team').textContent = p.status === 'Sold' && team
    ? `Sold to ${team.name}`
    : leadingTeam
      ? `Leading bid: ${leadingTeam.name}`
      : 'No team has bid yet';
  document.querySelector('#bid-controls .btn-bid').disabled = p.status !== 'Available' || !p.currentTeamId;
  document.getElementById('undo-bid-button').disabled = p.status !== 'Available' || !p.currentTeamId;
  document.getElementById('restart-bid-button').disabled = p.status !== 'Available' || !p.currentTeamId;
  renderBidTeamButtons(p);
}

function getBidIncrementRupees(currentBidLakhs) {
  const currentBidRupees = Math.round(currentBidLakhs * 100000);
  if (currentBidRupees < 2000) return 50;
  if (currentBidRupees < 4000) return 100;
  if (currentBidRupees < 7000) return 200;
  if (currentBidRupees < 10000) return 300;
  if (currentBidRupees < 13000) return 400;
  if (currentBidRupees < 15000) return 450;
  if (currentBidRupees < 18000) return 500;
  if (currentBidRupees < 20000) return 550;
  if (currentBidRupees < 25000) return 600;
  if (currentBidRupees < 30000) return 700;
  if (currentBidRupees < 35000) return 800;
  if (currentBidRupees < 40000) return 900;
  return 1000;
}

function renderBidTeamButtons(player) {
  const container = document.getElementById('bid-team-buttons');
  container.replaceChildren();
  const displayedBid = player.currentBid === null ? player.basePrice : player.currentBid;
  const incrementRupees = getBidIncrementRupees(displayedBid);
  getTeams().forEach((team) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `bid-team-button${team.id === player.currentTeamId ? ' leading' : ''}`;
    button.innerHTML = `<span>${escapeHtml(team.name)}</span><strong>+₹${incrementRupees.toLocaleString('en-IN')}</strong>`;
    button.style.setProperty('--team-color', team.color);
    button.disabled = player.status !== 'Available';
    button.addEventListener('click', () => placeTeamBid(team.id));
    container.append(button);
  });
}

async function placeTeamBid(teamId) {
  if (!currentAuctionPlayerId) { showToast('No player selected', true); return; }
  const player = getPlayerById(currentAuctionPlayerId);
  if (!player) return;
  const currentBid = player.currentBid === null ? player.basePrice : player.currentBid;
  const incrementRupees = getBidIncrementRupees(currentBid);
  try {
    await submitTeamBid(currentAuctionPlayerId, teamId, incrementRupees);
  } catch (error) {
    showRequestError(error);
    return;
  }
  const updatedPlayer = getPlayerById(currentAuctionPlayerId);
  if (!updatedPlayer) {
    showToast('The player is no longer available. Refresh the auction queue.', true);
    renderQueue();
    return;
  }
  const leadingTeam = updatedPlayer && getTeamById(updatedPlayer.currentTeamId);
  showToast(`Bid updated: ${leadingTeam ? leadingTeam.name : 'Team'} leads at ${formatPrice(updatedPlayer.currentBid, 'Rs')}`);
  renderQueue();
  showPlayerOnBlock(currentAuctionPlayerId);
}

async function finalizeAuction() {
  if (!currentAuctionPlayerId) { showToast('No player selected', true); return; }
  const player = getPlayerById(currentAuctionPlayerId);
  if (!player || !player.currentTeamId || player.currentBid === null) {
    showToast('A team must place a bid before the player can be sold.', true);
    return;
  }
  const winningTeam = getTeamById(player.currentTeamId);
  try {
    await sellPlayer(currentAuctionPlayerId);
  } catch (error) {
    showRequestError(error);
    return;
  }
  showAuctionOutcome(getLastAuctionOutcome());
  showToast(`✅ ${player.name} SOLD to ${winningTeam ? winningTeam.name : 'leading team'} for ${formatPrice(player.currentBid, 'Rs')}`);
  renderQueue();
  showPlayerOnBlock(currentAuctionPlayerId);
}

async function undoLastBid() {
  if (!currentAuctionPlayerId) return;
  try {
    await undoAuctionBid(currentAuctionPlayerId);
  } catch (error) {
    showRequestError(error);
    return;
  }
  showToast('↶ Last bid undone');
  renderQueue();
  showPlayerOnBlock(currentAuctionPlayerId);
}

async function restartBidding() {
  if (!currentAuctionPlayerId) return;
  const player = getPlayerById(currentAuctionPlayerId);
  if (!player || !player.currentTeamId) {
    showToast('There are no bids to restart.', true);
    return;
  }
  if (!confirm(`Cancel all bids for ${player.name} and restart at the base price?`)) return;
  try {
    await restartAuctionBidding(currentAuctionPlayerId);
  } catch (error) {
    showRequestError(error);
    return;
  }
  showToast(`↻ Bidding restarted at ${formatPrice(player.basePrice, 'Rs')}`);
  renderQueue();
  showPlayerOnBlock(currentAuctionPlayerId);
}

async function cancelCurrentAuction() {
  if (!currentAuctionPlayerId) return;
  const player = getPlayerById(currentAuctionPlayerId);
  if (!player) return;
  if (!confirm(`Cancel the auction for ${player.name} and return them to Available?\n\nAll bids for this auction will be removed.`)) return;
  try {
    await cancelAuction(player.id);
  } catch (error) {
    showRequestError(error);
    return;
  }
  currentAuctionPlayerId = null;
  renderQueue();
  showPlayerOnBlock(null);
  showToast(`${player.name} returned to Available.`);
}

async function markUnsold() {
  if (!currentAuctionPlayerId) { showToast('No player selected', true); return; }
  const player = getPlayerById(currentAuctionPlayerId);
  if (!player) return;

  try {
    await markPlayerUnsold(player.id);
  } catch (error) {
    showRequestError(error);
    return;
  }

  showAuctionOutcome(getLastAuctionOutcome());
  showToast(`❌ ${player.name} marked UNSOLD`);
  renderQueue();
  showPlayerOnBlock(currentAuctionPlayerId);
}

// ---- RESULTS ----
function renderResults() {
  const players = getPlayers();
  const teams   = getTeams();
  const soldPlayers = players.filter((player) => player.status === 'Sold' && Number.isFinite(player.soldPrice));
  const highestByCategory = (category) => soldPlayers
    .filter((player) => !category || player.category === category)
    .sort((a, b) => b.soldPrice - a.soldPrice || a.name.localeCompare(b.name))[0] || null;
  const highlightCards = [
    { title: 'Most Expensive Player', player: highestByCategory(null) },
    { title: 'Most Expensive Raider', player: highestByCategory('Raider') },
    { title: 'Most Expensive Defender', player: highestByCategory('Defender') },
    { title: 'Most Expensive All-Rounder', player: highestByCategory('All-Rounder') }
  ];
  document.getElementById('auction-highlights').innerHTML = highlightCards.map(({ title, player }) => {
    if (!player) {
      return `<article class="auction-highlight-card glass">
        <span class="auction-highlight-label">${title}</span>
        <strong class="auction-highlight-empty">No sold player yet</strong>
      </article>`;
    }
    const team = teams.find((item) => item.id === player.teamId);
    return `<article class="auction-highlight-card glass">
      <span class="auction-highlight-label">${title}</span>
      <strong class="auction-highlight-name">${escapeHtml(player.name)}</strong>
      <span class="auction-highlight-team">${team ? escapeHtml(team.name) : '—'}</span>
      <span class="auction-highlight-price">${escapeHtml(formatPrice(player.soldPrice))}</span>
    </article>`;
  }).join('');

  const sel = document.getElementById('results-team-filter');
  const prevVal = sel.value;
  sel.innerHTML = '<option value="">All Teams</option>' +
    teams.map(t => `<option value="${t.id}" ${t.id === prevVal ? 'selected' : ''}>${t.name}</option>`).join('');

  const filterTeamId = sel.value;
  let sold = players.filter(p => p.status === 'Sold');
  if (filterTeamId) sold = sold.filter(p => p.teamId === filterTeamId);

  const tbody = document.getElementById('results-tbody');
  tbody.innerHTML = sold.length === 0
    ? `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:40px">No sold players yet</td></tr>`
    : sold.map((p, i) => {
      const team = p.teamId ? teams.find(t => t.id === p.teamId) : null;
      return `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${p.name}</strong></td>
          <td><span class="badge ${categoryBadge(p.category)}">${p.category}</span></td>
          <td>${p.nationality || '—'}</td>
          <td>
            ${team
              ? `<span style="display:flex;align-items:center;gap:5px"><span class="color-dot" style="background:${team.color}"></span>${team.name}</span>`
              : '—'}
          </td>
          <td style="color:var(--text-muted)">${formatPrice(p.basePrice, 'Rs')}</td>
          <td style="color:var(--success);font-weight:600">${formatPrice(p.soldPrice)}</td>
        </tr>
      `;
    }).join('');
}

function exportCSV() {
  const players = getPlayers().filter(p => p.status === 'Sold');
  const teams   = getTeams();
  const rows = [['#','Player Name','Age','Playing Role','Auction Tier','Nationality','Team','Base Price (₹)','Sold Price (₹)']];
  players.forEach((p, i) => {
    const team = p.teamId ? teams.find(t => t.id === p.teamId) : null;
    rows.push([i+1, p.name, p.age, p.category, p.auctionTier, p.nationality||'', team ? team.name : '', Math.round(p.basePrice * 100000), Number((p.soldPrice * 100000).toFixed(2))]);
  });
  const csv  = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'KKPL_Auction_Results.csv'; a.click();
  URL.revokeObjectURL(url);
  showToast('📥 CSV Exported!');
}

function exportPlayerPoolCSV() {
  const teams = getTeams();
  const rows = [[
    '#', 'Player ID', 'Player Name', 'Age', 'Playing Role', 'Auction Tier',
    'Nationality', 'Status', 'Team', 'Base Price (₹)', 'Sold Price (₹)',
    'Previous Team', 'Skills / Notes'
  ]];

  getPlayers().forEach((player, index) => {
    const team = player.teamId ? teams.find(item => item.id === player.teamId) : null;
    rows.push([
      index + 1,
      player.id,
      player.name,
      player.age,
      player.category,
      player.auctionTier,
      player.nationality || '',
      player.status,
      team ? team.name : '',
      Math.round(player.basePrice * 100000),
      player.soldPrice === null ? '' : Number((player.soldPrice * 100000).toFixed(2)),
      player.prevTeam || '',
      player.skills || ''
    ]);
  });

  const csv = rows.map(row => row.map(value => {
    const cell = String(value ?? '');
    const safeCell = /^[\s]*[=+\-@]/.test(cell) ? `'${cell}` : cell;
    return `"${safeCell.replace(/"/g, '""')}"`;
  }).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'KKPL_Player_Pool.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  showToast('📥 Player pool CSV exported!');
}

async function copyPlayerRegistrationLink() {
  const link = new URL('/player-registration', window.location.origin).href;
  try {
    await navigator.clipboard.writeText(link);
    showToast('Player registration link copied.');
  } catch (error) {
    window.prompt('Copy and share this player registration link:', link);
  }
}

// ---- TEAM MODAL ----
function openTeamModal(editId) {
  const f = document.getElementById('team-form');
  f.reset();
  document.getElementById('team-id').value = '';
  document.getElementById('team-modal-title').textContent = 'Add New Team';
  document.getElementById('t-password').required = true;
  document.getElementById('t-password').placeholder = 'Set team password';
  document.getElementById('budget-preview').textContent = 'Enter amount and select unit';

  if (editId) {
    const t = getTeamById(editId);
    if (t) {
      document.getElementById('team-id').value   = t.id;
      document.getElementById('team-modal-title').textContent = 'Edit Team';
      document.getElementById('t-name').value    = t.name;
      document.getElementById('t-city').value    = t.city;
      document.getElementById('t-coach').value   = t.coach || '';
      document.getElementById('t-color').value   = t.color || '#ff6600';
      document.getElementById('t-email').value   = t.email;
      document.getElementById('t-password').value = '';
      document.getElementById('t-password').placeholder = 'Leave blank to keep current password';
      document.getElementById('t-sponsor').value  = t.sponsor || '';
      document.getElementById('t-password').required = false;

      // Show budget in Crores by default when editing
      const bL = t.budgetLakhs || 0;
      document.getElementById('t-budget-unit').value = 'Cr';
      document.getElementById('t-budget').value = fromLakhs(bL, 'Cr');
      updateBudgetPreview();
    }
  }

  // Live preview as user types
  document.getElementById('t-budget').oninput = updateBudgetPreview;
  document.getElementById('t-budget-unit').onchange = updateBudgetPreview;

  document.getElementById('team-modal').classList.add('open');
}

function updateBudgetPreview() {
  const val  = parseFloat(document.getElementById('t-budget').value);
  const unit = document.getElementById('t-budget-unit').value;
  const prev = document.getElementById('budget-preview');
  if (!val || val <= 0) { prev.textContent = 'Enter amount and select unit'; return; }
  const lakhs = toLakhs(val, unit);
  prev.innerHTML = `
    <span style="color:var(--orange)">= ${formatPrice(lakhs)}</span>
    &nbsp;|&nbsp; ₹${(lakhs).toFixed(2)} L
    &nbsp;|&nbsp; ₹${(lakhs/100).toFixed(4)} Cr
    &nbsp;|&nbsp; ₹${Math.round(lakhs*100000).toLocaleString('en-IN')}
  `;
}

async function saveTeam(e) {
  e.preventDefault();
  const id    = document.getElementById('team-id').value;
  const rawBudget = parseFloat(document.getElementById('t-budget').value) || 0;
  const budUnit   = document.getElementById('t-budget-unit').value;
  const budgetL   = toLakhs(rawBudget, budUnit);

  if (budgetL <= 0) { showToast('❌ Budget must be greater than 0', true); return; }

  const teamData = {
    name:        document.getElementById('t-name').value.trim(),
    city:        document.getElementById('t-city').value.trim(),
    coach:       document.getElementById('t-coach').value.trim(),
    color:       document.getElementById('t-color').value,
    email:       document.getElementById('t-email').value.trim().toLowerCase(),
    password:    document.getElementById('t-password').value,
    budgetLakhs: budgetL,
    sponsor:     document.getElementById('t-sponsor').value.trim(),
  };

  try {
    if (id) await updateTeam(id, teamData);
    else await createTeam(teamData);
    showToast(`✅ Team "${teamData.name}" ${id ? 'updated' : 'added'}!`);
  } catch (error) {
    showRequestError(error);
    return;
  }

  closeModal('team-modal');
  renderTeams();
}

async function removeTeam(id) {
  const t = getTeamById(id);
  if (!t) return;
  if (!confirm(`Delete "${t.name}"?\n\nAll their players will be released back to Available.`)) return;
  try {
    await deleteTeam(id);
  } catch (error) {
    showRequestError(error);
    return;
  }
  showToast(`🗑️ Team "${t.name}" deleted`);
  renderTeams();
  renderDashboard();
}

// ---- PLAYER MODAL ----
function openPlayerModal(editId) {
  const f = document.getElementById('player-form');
  clearPlayerPhotoPreview();
  f.reset();
  document.getElementById('player-id').value = '';
  document.getElementById('player-modal-title').textContent = 'Add New Player';
  document.getElementById('p-base-unit').value = 'Rs';
  document.getElementById('player-base-preview').textContent = 'Enter amount in rupees';
  document.getElementById('p-photo-preview').hidden = true;
  document.getElementById('p-photo-preview').removeAttribute('src');

  if (editId) {
    const p = getPlayerById(editId);
    if (p) {
      document.getElementById('player-id').value     = p.id;
      document.getElementById('player-modal-title').textContent = 'Edit Player';
      document.getElementById('p-name').value        = p.name;
      document.getElementById('p-age').value         = p.age;
      document.getElementById('p-nationality').value = p.nationality || '';
      document.getElementById('p-category').value    = p.category;
      document.getElementById('p-auction-tier').value = p.auctionTier;
      document.getElementById('p-base-unit').value   = 'Rs';
      document.getElementById('p-base').value        = Math.round(p.basePrice * 100000);
      document.getElementById('p-prev-team').value   = p.prevTeam || '';
      document.getElementById('p-skills').value      = p.skills || '';
      if (p.photoUrl) showPlayerPhotoPreview(p.photoUrl);
    }
  }
  document.getElementById('p-base').oninput = updatePlayerBasePreview;
  document.getElementById('p-base-unit').onchange = updatePlayerBasePreview;
  document.getElementById('p-photo').onchange = handlePlayerPhotoChange;
  updatePlayerBasePreview();
  document.getElementById('player-modal').classList.add('open');
}

function clearPlayerPhotoPreview() {
  if (playerPhotoPreviewUrl) URL.revokeObjectURL(playerPhotoPreviewUrl);
  playerPhotoPreviewUrl = null;
}

function showPlayerPhotoPreview(src) {
  const preview = document.getElementById('p-photo-preview');
  preview.src = src;
  preview.hidden = false;
}

function handlePlayerPhotoChange() {
  clearPlayerPhotoPreview();
  const input = document.getElementById('p-photo');
  const file = input.files[0];
  if (!file) {
    const player = getPlayerById(document.getElementById('player-id').value);
    if (player && player.photoUrl) showPlayerPhotoPreview(player.photoUrl);
    else document.getElementById('p-photo-preview').hidden = true;
    return;
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size === 0 || file.size > 5 * 1024 * 1024) {
    input.value = '';
    document.getElementById('p-photo-preview').hidden = true;
    showToast('❌ Choose a JPG, PNG, or WebP photo no larger than 5 MB.', true);
    return;
  }
  playerPhotoPreviewUrl = URL.createObjectURL(file);
  showPlayerPhotoPreview(playerPhotoPreviewUrl);
}

function readPlayerPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Could not read the selected player photo.'));
    };
    reader.onerror = () => reject(new Error('Could not read the selected player photo.'));
    reader.readAsDataURL(file);
  });
}

function updatePlayerBasePreview() {
  const value = parseFloat(document.getElementById('p-base').value);
  const unit = document.getElementById('p-base-unit').value;
  const preview = document.getElementById('player-base-preview');
  if (!Number.isFinite(value) || value <= 0) {
    preview.textContent = 'Enter amount in rupees';
    return;
  }
  preview.textContent = `Stored as ${formatPrice(toLakhs(value, unit), 'Rs')}`;
}

async function savePlayer(e) {
  e.preventDefault();
  const id      = document.getElementById('player-id').value;
  const rawBasePrice = parseFloat(document.getElementById('p-base').value);
  const basePrice = toLakhs(rawBasePrice, document.getElementById('p-base-unit').value);
  if (!Number.isFinite(basePrice) || basePrice <= 0) {
    showToast('❌ Base price must be greater than 0', true);
    return;
  }

  const pData = {
    name:        document.getElementById('p-name').value.trim(),
    age:         parseInt(document.getElementById('p-age').value),
    nationality: document.getElementById('p-nationality').value.trim(),
    category:    document.getElementById('p-category').value,
    auctionTier: document.getElementById('p-auction-tier').value,
    basePrice,
    prevTeam:    document.getElementById('p-prev-team').value.trim(),
    skills:      document.getElementById('p-skills').value.trim(),
  };

  try {
    const photoFile = document.getElementById('p-photo').files[0];
    if (photoFile) pData.photoData = await readPlayerPhoto(photoFile);
    if (id) await updatePlayer(id, pData);
    else await createPlayer(pData);
    showToast(`✅ Player "${pData.name}" ${id ? 'updated' : 'added'}!`);
  } catch (error) {
    showRequestError(error);
    return;
  }

  closeModal('player-modal');
  renderPlayers();
  if (currentAuctionPlayerId === id) {
    showPlayerOnBlock(id);
    renderQueue();
  }
}

async function removePlayer(id) {
  const p = getPlayerById(id);
  if (!p) return;
  if (!confirm(`Remove "${p.name}" from the player pool?`)) return;
  try {
    await deletePlayer(id);
  } catch (error) {
    showRequestError(error);
    return;
  }
  showToast(`🗑️ Player "${p.name}" removed`);
  renderPlayers();
}

function renderAdminMatches() {
  const container = document.getElementById('admin-matches-list');
  const matches = getMatches();
  if (!matches.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">🏟️</div><div class="empty-text">No matches scheduled yet. Add teams, then schedule your first match.</div></div>';
    return;
  }

  container.innerHTML = matches.map((match) => {
    const home = match.homeTeam;
    const away = match.awayTeam;
    const statusLabel = match.status[0].toUpperCase() + match.status.slice(1);
    const playerTable = (team) => {
      const scored = new Map(match.playerPoints.map((entry) => [entry.playerId, entry]));
      const players = getPlayers().filter((player) => player.teamId === team.id);
      if (!players.length) return '<p class="match-no-players">No players assigned to this team yet.</p>';
      return `
        <div class="match-stats-scroll"><table class="match-stats-table">
          <thead><tr><th>Player</th><th>Raid</th><th>Tackle</th><th>Bonus</th><th>Other</th><th>Total</th></tr></thead>
          <tbody>${players.map((player) => {
            const points = scored.get(player.id);
            return `<tr><th scope="row">${escapeHtml(player.name)}</th>
              <td>${points?.raidPoints || 0}</td><td>${points?.tacklePoints || 0}</td>
              <td>${points?.bonusPoints || 0}</td><td>${points?.otherPoints || 0}</td>
              <td><strong>${points?.total || 0}</strong></td></tr>`;
          }).join('')}</tbody>
        </table></div>
      `;
    };
    const extras = (teamId) => teamId === home.id ? match.extras.home : match.extras.away;
    const teamPanel = (team) => `
      <section class="match-points-team">
        <h4>${escapeHtml(team.name)} — Player Points</h4>
        ${playerTable(team)}
        <p class="match-extras-line">Extras: All-outs <strong>${extras(team.id).allOut}</strong>
          · Technical <strong>${extras(team.id).technical}</strong>
          · Total <strong>${extras(team.id).total}</strong></p>
      </section>
    `;
    const eventLabel = (event) => ({
      raid: 'Raid', tackle: 'Tackle', bonus: 'Bonus', all_out: 'All-out',
      technical: 'Technical / extra', legacy: 'Other (migrated)'
    }[event.type] || event.type);
    const tossDecisionText = match.toss?.decision === 'raid' ? 'elected to raid' : 'elected to choose court side';
    const rosterOptions = (teamId) => getPlayers()
      .filter((player) => player.teamId === teamId)
      .map((player) => `<option value="${escapeHtml(player.id)}">${escapeHtml(player.name)}</option>`)
      .join('') || '<option value="">No players assigned to this team</option>';
    const tieBreakPhase = match.tieBreak?.phase;
    const tieBreakSummary = match.tieBreak?.phase ? `
      <p class="match-tiebreak-summary">
        Super 5: <strong>${escapeHtml(home.name)} ${match.tieBreak.homeScore} – ${match.tieBreak.awayScore} ${escapeHtml(away.name)}</strong>
        ${match.tieBreak.toss ? ` · Golden toss: <strong>${escapeHtml(match.tieBreak.toss.winnerTeamName)}</strong> chose to ${escapeHtml(match.tieBreak.toss.decision)}.` : ''}
      </p>
    ` : '';
    const liveScoringForm = match.status !== 'live' ? '' : tieBreakPhase === 'super5' ? `
      <div class="match-tiebreak-panel">
        <h4>Super 5 Tie-break — Raid ${match.tieBreak.raids + 1} of 10</h4>
        <p>${escapeHtml(home.name)} ${match.tieBreak.homeScore} – ${match.tieBreak.awayScore} ${escapeHtml(away.name)}</p>
        <p>Next raid: <strong>${escapeHtml(getTeamById(match.tieBreak.expectedTeamId)?.name || home.name)}</strong></p>
        <form class="match-event-form" onsubmit="saveMatchEvent(event,'${escapeHtml(match.id)}')">
          <input type="hidden" name="type" value="raid"/>
          <label>Raiding team
            <select name="teamId" required>
              <option value="${escapeHtml(match.tieBreak.expectedTeamId)}">${escapeHtml(getTeamById(match.tieBreak.expectedTeamId)?.name || home.name)}</option>
            </select>
          </label>
          <label>Raider
            <select name="playerId" required>${rosterOptions(match.tieBreak.expectedTeamId)}</select>
          </label>
          <label>Raid points (0–7)
            <input name="points" type="number" min="0" max="7" value="0" required/>
          </label>
          <button class="btn-primary" type="submit">Record Super 5 Raid</button>
        </form>
        ${match.tieBreak.raids === 10 && match.tieBreak.homeScore !== match.tieBreak.awayScore
          ? `<button class="btn-primary match-finish-tiebreak" type="button" onclick="setMatchStatus('${escapeHtml(match.id)}','completed')">Complete Match</button>`
          : ''}
      </div>
    ` : tieBreakPhase === 'golden_toss' ? `
      <div class="match-tiebreak-panel">
        <h4>Super 5 tied — Golden Raid Toss</h4>
        <p>${escapeHtml(home.name)} ${match.tieBreak.homeScore} – ${match.tieBreak.awayScore} ${escapeHtml(away.name)}</p>
        <form class="match-toss-form" onsubmit="saveGoldenToss(event,'${escapeHtml(match.id)}')">
          <label>Toss winner
            <select name="winnerTeamId" required>
              <option value="">Select team</option>
              <option value="${escapeHtml(home.id)}">${escapeHtml(home.name)}</option>
              <option value="${escapeHtml(away.id)}">${escapeHtml(away.name)}</option>
            </select>
          </label>
          <label>Toss winner chooses
            <select name="decision" required>
              <option value="">Choose raid or defend</option>
              <option value="raid">Raid</option>
              <option value="defend">Defend</option>
            </select>
          </label>
          <button class="btn-primary" type="submit">Save Golden Raid Toss</button>
        </form>
      </div>
    ` : tieBreakPhase === 'golden_raid' ? `
      <div class="match-tiebreak-panel">
        <h4>Golden Raid — One Deciding Raid</h4>
        <p>Toss: <strong>${escapeHtml(match.tieBreak.toss.winnerTeamName)}</strong> chose to ${match.tieBreak.toss.decision}.</p>
        <p><strong>${escapeHtml(getTeamById(match.tieBreak.goldenRaidTeamId)?.name || '')}</strong> takes the only raid.</p>
        <form class="match-event-form" onsubmit="saveMatchEvent(event,'${escapeHtml(match.id)}')">
          <input type="hidden" name="type" value="raid"/>
          <label>Raiding team
            <select name="teamId" required>
              <option value="${escapeHtml(match.tieBreak.goldenRaidTeamId)}">${escapeHtml(getTeamById(match.tieBreak.goldenRaidTeamId)?.name || '')}</option>
            </select>
          </label>
          <label>Raider
            <select name="playerId" required>${rosterOptions(match.tieBreak.goldenRaidTeamId)}</select>
          </label>
          <label>Raid points (0–7)
            <input name="points" type="number" min="0" max="7" value="0" required/>
          </label>
          <button class="btn-primary" type="submit">Record Golden Raid</button>
        </form>
      </div>
    ` : tieBreakPhase === 'completed' ? `
      <div class="match-tiebreak-panel">
        <h4>Tie-break winner determined</h4>
        <p>${escapeHtml(home.name)} ${match.tieBreak.homeScore} – ${match.tieBreak.awayScore} ${escapeHtml(away.name)}</p>
        <p>${escapeHtml(getMatchOutcome({ ...match, status: 'completed' }))}</p>
        <button class="btn-primary match-finish-tiebreak" type="button" onclick="setMatchStatus('${escapeHtml(match.id)}','completed')">Complete Match</button>
      </div>
    ` : `
      <form id="match-event-form-${escapeHtml(match.id)}" class="match-event-form" onsubmit="saveMatchEvent(event,'${escapeHtml(match.id)}')">
        <label>Team
          <select name="teamId" required onchange="updateMatchEventFields('${escapeHtml(match.id)}')">
            <option value="${escapeHtml(home.id)}">${escapeHtml(home.name)}</option>
            <option value="${escapeHtml(away.id)}">${escapeHtml(away.name)}</option>
          </select>
        </label>
        <label>Event
          <select name="type" required onchange="updateMatchEventFields('${escapeHtml(match.id)}')">
            <option value="raid">Raid points</option><option value="tackle">Tackle points</option>
            <option value="bonus">Bonus point</option><option value="all_out">All-out (2 points)</option>
            <option value="technical">Technical / extra points</option>
          </select>
        </label>
        <label data-player-control>Player <select name="playerId" required></select></label>
        <label data-points-control>Points <input name="points" type="number" min="1" max="5" value="1" required /></label>
        <button class="btn-primary" type="submit">Add scoring event</button>
      </form>
    `;

    return `
      <article class="match-card match-admin-card">
        <div class="match-card-header">
          <div>
            <span class="match-status match-status-${escapeHtml(match.status)}">${escapeHtml(statusLabel)}</span>
            <span class="match-round-label">${escapeHtml(getMatchRoundLabel(match))}</span>
            <h3>${escapeHtml(new Date(match.scheduledAt).toLocaleString())}</h3>
            <p class="match-venue">${escapeHtml(match.venue || 'Venue to be announced')}</p>
          </div>
          <div class="match-actions">
            ${(match.status === 'scheduled' || match.status === 'cancelled')
              ? `<button class="btn-icon" type="button" onclick="openMatchModal('${escapeHtml(match.id)}')">✏️ Edit Schedule</button>`
              : ''}
            ${match.status === 'scheduled'
              ? `<button class="btn-icon match-action-live" type="button" onclick="setMatchStatus('${escapeHtml(match.id)}','live')">▶ Start Match</button>
                 <button class="btn-icon danger" type="button" onclick="setMatchStatus('${escapeHtml(match.id)}','cancelled')">Cancel</button>`
              : ''}
            ${match.status === 'live'
              ? `<button class="btn-icon match-action-finish" type="button" onclick="setMatchStatus('${escapeHtml(match.id)}','completed')">✓ Complete Match</button>`
              : ''}
            ${match.status === 'completed'
              ? `<button class="btn-icon" type="button" onclick="setMatchStatus('${escapeHtml(match.id)}','live')">↻ Reopen Live</button>`
              : ''}
            ${match.status === 'cancelled'
              ? `<button class="btn-icon" type="button" onclick="setMatchStatus('${escapeHtml(match.id)}','scheduled')">↻ Restore Match</button>`
              : ''}
            <button class="btn-icon danger" type="button" onclick="removeMatch('${escapeHtml(match.id)}')">🗑 Delete Match</button>
          </div>
        </div>
        ${match.status === 'scheduled' ? `
          <form class="match-toss-form" onsubmit="saveMatchToss(event,'${escapeHtml(match.id)}')">
            <label>Toss won by
              <select name="winnerTeamId" required>
                <option value="">Select team</option>
                <option value="${escapeHtml(home.id)}" ${match.toss?.winnerTeamId === home.id ? 'selected' : ''}>${escapeHtml(home.name)}</option>
                <option value="${escapeHtml(away.id)}" ${match.toss?.winnerTeamId === away.id ? 'selected' : ''}>${escapeHtml(away.name)}</option>
              </select>
            </label>
            <label>Toss winner chose
              <select name="decision" required>
                <option value="">Select choice</option>
                <option value="raid" ${match.toss?.decision === 'raid' ? 'selected' : ''}>Raid</option>
                <option value="court_side" ${match.toss?.decision === 'court_side' ? 'selected' : ''}>Choose court side</option>
              </select>
            </label>
            <button class="btn-icon" type="submit">Save Toss</button>
          </form>
        ` : match.toss ? `
          <p class="match-toss-summary">Toss: <strong>${escapeHtml(match.toss.winnerTeamName)}</strong> won and ${tossDecisionText}.</p>
        ` : ''}
        ${match.status === 'completed' ? `
          <p class="match-outcome">${escapeHtml(getMatchOutcome(match))}</p>
          ${tieBreakSummary}
        ` : ''}
        ${match.status === 'completed' ? `
          <button class="match-scoreboard match-score-toggle" type="button"
            aria-expanded="false" aria-controls="admin-match-details-${escapeHtml(match.id)}"
            aria-label="Show player points for ${escapeHtml(home.name)} versus ${escapeHtml(away.name)}"
            onclick="toggleMatchDetails(event,'admin-match-details-${escapeHtml(match.id)}')">
            <span class="match-side" style="--match-team-color:${escapeHtml(home.color)}">
              <span class="match-team-name">${escapeHtml(home.name)}</span>
              <span class="match-score-value">${match.homeScore}</span>
            </span>
            <span class="match-score-separator">–</span>
            <span class="match-side" style="--match-team-color:${escapeHtml(away.color)}">
              <span class="match-team-name">${escapeHtml(away.name)}</span>
              <span class="match-score-value">${match.awayScore}</span>
            </span>
          </button>
          <p class="match-score-hint">Click the score to view player points</p>
          <div id="admin-match-details-${escapeHtml(match.id)}" class="match-player-points match-readonly-points" hidden>
            ${teamPanel(home)}${teamPanel(away)}
          </div>
        ` : `
          <div class="match-scoreboard">
            <div class="match-side" style="--match-team-color:${escapeHtml(home.color)}">
              <div class="match-team-name">${escapeHtml(home.name)}</div>
              <div class="match-score-value">${match.homeScore}</div>
            </div>
            <span class="match-score-separator">–</span>
            <div class="match-side" style="--match-team-color:${escapeHtml(away.color)}">
              <div class="match-team-name">${escapeHtml(away.name)}</div>
              <div class="match-score-value">${match.awayScore}</div>
            </div>
          </div>
          ${match.status === 'live' ? `
            <div class="match-player-points match-readonly-points">${teamPanel(home)}${teamPanel(away)}</div>
          ` : ''}
        `}
        ${liveScoringForm}
        ${match.status === 'live' ? `
          <section class="match-event-history">
            <h4>Scoring event history</h4>
            ${match.events.length ? match.events.map((event) => `
              <div class="match-event-row">
                <span><strong>${escapeHtml(eventLabel(event))}</strong>${event.period !== 'regular' ? ` (${escapeHtml(event.period)})` : ''} · ${escapeHtml(event.teamName)}
                  ${event.playerName ? `· ${escapeHtml(event.playerName)}` : ''} · ${event.points} pts</span>
                <button class="btn-icon danger" type="button" onclick="removeMatchEvent('${escapeHtml(match.id)}','${escapeHtml(event.id)}')">Remove</button>
              </div>
            `).join('') : '<p class="match-no-players">No scoring events yet.</p>'}
          </section>
        ` : ''}
      </article>
    `;
  }).join('');
  matches.filter((match) => match.status === 'live').forEach((match) => updateMatchEventFields(match.id));
}

function openMatchModal(matchId) {
  const form = document.getElementById('match-form');
  const homeSelect = document.getElementById('match-home-team');
  const awaySelect = document.getElementById('match-away-team');
  const teams = getTeams();
  if (teams.length < 2) {
    showToast('Add at least two teams before scheduling a match.', true);
    return;
  }

  form.reset();
  document.getElementById('match-id').value = '';
  document.getElementById('match-modal-title').textContent = 'Schedule Match';
  document.getElementById('match-round-type').value = 'league';
  const options = teams.map((team) =>
    `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name)}</option>`
  ).join('');
  homeSelect.innerHTML = options;
  awaySelect.innerHTML = options;
  if (teams[1]) awaySelect.value = teams[1].id;

  if (matchId) {
    const match = getMatches().find((item) => item.id === matchId);
    if (!match) return;
    document.getElementById('match-id').value = match.id;
    document.getElementById('match-modal-title').textContent = 'Edit Match Schedule';
    document.getElementById('match-round-type').value = match.roundType || 'league';
    homeSelect.value = match.homeTeam.id;
    awaySelect.value = match.awayTeam.id;
    document.getElementById('match-venue').value = match.venue || '';
    const localDate = new Date(match.scheduledAt);
    localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset());
    document.getElementById('match-date').value = localDate.toISOString().slice(0, 16);
  }
  openModal('match-modal');
}

async function saveMatch(event) {
  event.preventDefault();
  const id = document.getElementById('match-id').value;
  const scheduledAt = document.getElementById('match-date').value;
  const scheduledDate = new Date(scheduledAt);
  if (!scheduledAt || !Number.isFinite(scheduledDate.getTime())) {
    showToast('Choose a valid match date and time.', true);
    return;
  }
  const match = {
    roundType: document.getElementById('match-round-type').value,
    homeTeamId: document.getElementById('match-home-team').value,
    awayTeamId: document.getElementById('match-away-team').value,
    scheduledAt: scheduledDate.toISOString(),
    venue: document.getElementById('match-venue').value.trim()
  };
  if (match.homeTeamId === match.awayTeamId) {
    showToast('Choose two different teams for the match.', true);
    return;
  }
  try {
    if (id) await updateMatchSchedule(id, match);
    else await createMatch(match);
  } catch (error) {
    showRequestError(error);
    return;
  }
  closeModal('match-modal');
  renderAdminMatches();
  showToast(id ? 'Match schedule updated.' : 'Match scheduled.');
}

async function setMatchStatus(matchId, status) {
  try {
    await updateMatchStatus(matchId, status);
    renderAdminMatches();
    showToast(`Match marked ${status}.`);
  } catch (error) {
    showRequestError(error);
  }
}

async function saveMatchToss(event, matchId) {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    await updateMatchToss(matchId, {
      winnerTeamId: form.elements.winnerTeamId.value,
      decision: form.elements.decision.value
    });
    renderAdminMatches();
    showToast('Match toss details saved.');
  } catch (error) {
    showRequestError(error);
  }
}

async function saveGoldenToss(event, matchId) {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    await updateGoldenRaidToss(matchId, {
      winnerTeamId: form.elements.winnerTeamId.value,
      decision: form.elements.decision.value
    });
    renderAdminMatches();
    showToast('Golden-raid toss details saved.');
  } catch (error) {
    showRequestError(error);
  }
}

function toggleMatchDetails(event, detailsId) {
  const details = document.getElementById(detailsId);
  if (!details) return;
  details.hidden = !details.hidden;
  event.currentTarget.setAttribute('aria-expanded', String(!details.hidden));
}

async function removeMatch(matchId) {
  const match = getMatches().find((item) => item.id === matchId);
  if (!match) return;
  if (!confirm(`Delete the match between ${match.homeTeam.name} and ${match.awayTeam.name}?\n\nThis also deletes its score events and cannot be undone.`)) return;
  try {
    await deleteMatch(matchId);
    renderAdminMatches();
    showToast('Match and its score events deleted.');
  } catch (error) {
    showRequestError(error);
  }
}

function updateMatchEventFields(matchId) {
  const form = document.getElementById(`match-event-form-${matchId}`);
  if (!form) return;
  const type = form.elements.type.value;
  const playerControl = form.querySelector('[data-player-control]');
  const pointsControl = form.querySelector('[data-points-control]');
  const playerSelect = form.elements.playerId;
  const teamId = form.elements.teamId.value;
  const requiresPlayer = ['raid', 'tackle', 'bonus'].includes(type);
  const teamPlayers = getPlayers().filter((player) => player.teamId === teamId);
  playerControl.hidden = !requiresPlayer;
  playerSelect.required = requiresPlayer;
  playerSelect.innerHTML = teamPlayers.map((player) =>
    `<option value="${escapeHtml(player.id)}">${escapeHtml(player.name)} (${escapeHtml(player.category)})</option>`
  ).join('') || '<option value="">No players assigned to this team</option>';
  const fixedPoints = type === 'all_out' || type === 'bonus';
  pointsControl.hidden = fixedPoints;
  form.elements.points.required = !fixedPoints;
  if (type === 'technical') {
    form.elements.points.max = '99';
    form.elements.points.value = '1';
  } else {
    form.elements.points.max = type === 'raid' ? '7' : '2';
    if (fixedPoints) form.elements.points.value = type === 'all_out' ? '2' : '1';
  }
}

async function saveMatchEvent(event, matchId) {
  event.preventDefault();
  const form = event.currentTarget;
  const type = form.elements.type.value;
  try {
    await createMatchEvent(matchId, {
      teamId: form.elements.teamId.value,
      type,
      playerId: ['raid', 'tackle', 'bonus'].includes(type) ? form.elements.playerId.value : null,
      points: ['raid', 'tackle', 'technical'].includes(type) ? Number(form.elements.points.value) : undefined
    });
    renderAdminMatches();
    showToast('Scoring event added.');
  } catch (error) {
    showRequestError(error);
  }
}

async function removeMatchEvent(matchId, eventId) {
  if (!confirm('Remove this scoring event and recalculate the match score?')) return;
  try {
    await deleteMatchEvent(matchId, eventId);
    renderAdminMatches();
    showToast('Scoring event removed and score recalculated.');
  } catch (error) {
    showRequestError(error);
  }
}

// ---- MODAL UTILS ----
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', function(e) {
    if (e.target === this) this.classList.remove('open');
  });
});

(async function initializeAdmin() {
  try {
    const user = await initData();
    if (!user || user.type !== 'admin') {
      window.location.href = '/';
      return;
    }
    await refreshData();
    currentAuctionPlayerId = getCurrentAuction() ? getCurrentAuction().id : null;
    showSection('dashboard');
  } catch (error) {
    showRequestError(error);
  }
})();
