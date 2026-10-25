/* ============================================
   KKPL – Admin Dashboard JS  (v2)
   All monetary values stored internally in LAKHS.
   ============================================ */

let currentAuctionPlayerId = null;
let queueFilter = 'Available';
let queueTierFilter = '';
let playerPhotoPreviewUrl = null;

// ---- Navigation ----
function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const el = document.getElementById('section-' + name);
  if (el) el.classList.add('active');
  const titles = {
    dashboard: 'Dashboard', teams: 'Manage Teams',
    players: 'Player Pool', auction: 'Live Auction', results: 'Auction Results'
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

function setAuctionTierFilter(tier) {
  queueTierFilter = tier;
  renderQueue();
}

function renderQueue() {
  const allPlayers = getPlayers();
  const availablePlayersRemain = allPlayers.some(p => p.status === 'Available');
  let players = allPlayers.filter(p => {
    const matchesStatus = queueFilter === 'all' ? p.status !== 'Sold' : p.status === queueFilter;
    return matchesStatus && (!queueTierFilter || p.auctionTier === queueTierFilter);
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

function renderBidTeamButtons(player) {
  const container = document.getElementById('bid-team-buttons');
  container.replaceChildren();
  getTeams().forEach((team) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `bid-team-button${team.id === player.currentTeamId ? ' leading' : ''}`;
    button.textContent = team.name;
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
  const incrementRupees = Number(document.getElementById('bid-increment').value);
  if (!Number.isSafeInteger(incrementRupees) || incrementRupees < 1) {
    showToast('Enter a whole-number bid increase in rupees.', true);
    return;
  }
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
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
    input.value = '';
    document.getElementById('p-photo-preview').hidden = true;
    showToast('❌ Choose a JPG, PNG, or WebP photo smaller than 2 MB.', true);
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
