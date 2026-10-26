/* ============================================
   KKPL – Team Portal JS
   ============================================ */

let currentTeam = null;
let lastSeenAuctionOutcomeAt = null;

function applyTeamBranding() {
  if (!currentTeam) return;
  // Set team branding
  document.getElementById('team-logo-name').textContent = currentTeam.name.split(' ').map(w => w[0]).join('').slice(0,4);
  document.getElementById('team-topbar-badge').textContent = '🏆 ' + currentTeam.name;
  document.title = currentTeam.name + ' – KKPL Portal';

  // Apply team color as CSS variable
  document.documentElement.style.setProperty('--team-accent', currentTeam.color);
  document.querySelector('.sidebar').style.borderRightColor = currentTeam.color + '33';
}

// ---- Navigation ----
function showTeamSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const el = document.getElementById('section-' + name.replace('-', '-'));
  const sectionEl = document.getElementById('section-' + name);
  if (sectionEl) sectionEl.classList.add('active');

  const titles = {
    overview: 'Team Overview',
    squad: 'My Squad',
    'auction-live': 'Auction Status',
    'all-results': 'Full Auction Results',
    matches: 'Match Schedule & Scorecards',
    stats: 'Player Stats & League Points'
  };
  document.getElementById('team-page-title').textContent = titles[name] || name;

  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.getAttribute('onclick') && n.getAttribute('onclick').includes("'" + name + "'")) {
      n.classList.add('active');
    }
  });

  if (name === 'overview') renderOverview();
  if (name === 'squad') renderSquad('all');
  if (name === 'auction-live') renderAuctionStatus();
  if (name === 'all-results') renderAllResults();
  if (name === 'matches') renderTeamMatches();
  if (name === 'stats') renderSeasonStats('team-season-stats');
}

// ---- OVERVIEW ----
function renderOverview() {
  if (!currentTeam) return;
  const players = getPlayers();
  const bL   = currentTeam.budgetLakhs || 0;
  const sL   = currentTeam.spentLakhs  || 0;
  const remL = Math.max(0, bL - sL);
  const teamPlayers = players.filter(p => p.teamId === currentTeam.id);

  // Hero
  const heroEl = document.getElementById('team-hero-card');
  heroEl.style.cssText += `;--team-color:${currentTeam.color}`;
  heroEl.innerHTML = `
    <div class="team-hero-color" style="background:${currentTeam.color}22;border-color:${currentTeam.color}55">
      🏉
    </div>
    <div class="team-hero-info">
      <div class="th-name">${currentTeam.name}</div>
      <div class="th-city">📍 ${currentTeam.city} &nbsp;|&nbsp; 🎽 Coach: ${currentTeam.coach || 'TBD'}</div>
      <div class="th-badges">
        <span class="badge" style="background:${currentTeam.color}22;color:${currentTeam.color};border:1px solid ${currentTeam.color}44">${currentTeam.city}</span>
        ${currentTeam.sponsor ? `<span class="badge badge-available">🏢 ${currentTeam.sponsor}</span>` : ''}
      </div>
    </div>
    <div class="team-hero-budget">
      <div class="thb-val">${formatPrice(remL)}</div>
      <div class="thb-label">Remaining Purse</div>
    </div>
  `;

  // Stats
  const raiders    = teamPlayers.filter(p => p.category === 'Raider').length;
  const defenders  = teamPlayers.filter(p => p.category === 'Defender').length;
  const allrounders= teamPlayers.filter(p => p.category === 'All-Rounder').length;

  const statsEl = document.getElementById('team-stats-row');
  statsEl.innerHTML = [
    { icon: '🧍', label: 'Total Players', val: teamPlayers.length,          color: currentTeam.color },
    { icon: '⚡', label: 'Raiders',        val: raiders,                     color: '#ff6b00' },
    { icon: '🛡️', label: 'Defenders',     val: defenders,                   color: '#7c3aed' },
    { icon: '🔄', label: 'All-Rounders',   val: allrounders,                 color: '#0ea5e9' },
    { icon: '💰', label: 'Spent',          val: formatPrice(sL),             color: '#ef4444' },
    { icon: '💚', label: 'Budget Left',    val: formatPrice(remL),           color: '#22c55e' },
  ].map(s => `
    <div class="stat-card" style="--stat-color:${s.color}">
      <div class="stat-icon">${s.icon}</div>
      <div class="stat-val">${s.val}</div>
      <div class="stat-label">${s.label}</div>
    </div>
  `).join('');

  // Key players (sort by sold price)
  const keyPlayers = [...teamPlayers].sort((a, b) => (b.soldPrice || 0) - (a.soldPrice || 0)).slice(0, 5);
  const kpEl = document.getElementById('team-key-players');
  kpEl.innerHTML = keyPlayers.length === 0
    ? '<div class="mini-item"><span class="mi-name" style="color:var(--text-muted)">No players acquired yet</span></div>'
    : keyPlayers.map(p => `
      <div class="mini-item">
        <span class="mi-name">${p.name}</span>
        <span class="badge ${categoryBadge(p.category)}">${p.category}</span>
        <span style="color:var(--success);font-size:0.8rem;font-weight:600">${formatPrice(p.soldPrice)}</span>
      </div>
    `).join('');

  // Category breakdown
  const catEl = document.getElementById('team-cat-breakdown');
  catEl.innerHTML = [
    { name: 'Raiders', count: raiders, badge: 'badge-raider' },
    { name: 'Defenders', count: defenders, badge: 'badge-defender' },
    { name: 'All-Rounders', count: allrounders, badge: 'badge-allrounder' },
  ].map(c => `
    <div class="mini-item">
      <span class="mi-name">${c.name}</span>
      <span class="mi-badge ${c.badge}">${c.count} Players</span>
    </div>
  `).join('');
}

// ---- SQUAD ----
let squadFilterActive = 'all';

function filterSquad(cat, btn) {
  squadFilterActive = cat;
  document.querySelectorAll('.squad-filters .q-filter').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderSquad(cat);
}

function renderSquad(cat) {
  if (!currentTeam) return;
  const players = getPlayers();
  let teamPlayers = players.filter(p => p.teamId === currentTeam.id);
  if (cat !== 'all') teamPlayers = teamPlayers.filter(p => p.category === cat);

  const grid = document.getElementById('squad-grid');

  if (teamPlayers.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🏉</div>
        <div class="empty-text">${cat === 'all' ? 'No players acquired yet' : 'No ' + cat + 's in your squad'}</div>
      </div>
    `;
    return;
  }

  grid.innerHTML = teamPlayers.map((p, i) => `
    <div class="player-card">
      <div class="pc-number">${i + 1}</div>
      <div class="pc-cat">
        <span class="badge ${categoryBadge(p.category)}">${p.category}</span>
        <span class="tier-badge tier-${p.auctionTier.toLowerCase()}">Tier ${p.auctionTier}</span>
      </div>
      <div class="pc-name">${p.name}</div>
      <div class="pc-details">
        <div class="pc-detail">
          <span>Age</span>
          <span class="val">${p.age} yrs</span>
        </div>
        <div class="pc-detail">
          <span>Nationality</span>
          <span class="val">${p.nationality || '—'}</span>
        </div>
        <div class="pc-detail">
          <span>Prev Team</span>
          <span class="val">${p.prevTeam || '—'}</span>
        </div>
        ${p.skills ? `<div class="pc-detail" style="flex-direction:column;gap:2px">
          <span>Skills</span>
          <span class="val" style="font-size:0.78rem;color:var(--text-secondary)">${p.skills}</span>
        </div>` : ''}
      </div>
      <div class="pc-price">
        <div class="pc-price-val">${formatPrice(p.soldPrice)}</div>
        <div class="pc-price-label">Acquired Price</div>
      </div>
    </div>
  `).join('');
}

// ---- AUCTION STATUS ----
function renderAuctionStatus() {
  const players = getPlayers();
  const teams = getTeams();
  const grid = document.getElementById('auction-status-grid');

  const sold = players.filter(p => p.status === 'Sold');
  const available = players.filter(p => p.status === 'Available');
  const unsold = players.filter(p => p.status === 'Unsold');

  // Summary cards
  let html = `
    ${getCurrentAuction() ? (() => {
      const player = getCurrentAuction();
      const leadingTeam = player.currentTeamId ? teams.find(team => team.id === player.currentTeamId) : null;
      const amount = player.currentBid === null ? player.basePrice : player.currentBid;
      return `
        <div class="live-auction-card">
          ${player.photoUrl ? `<img src="${player.photoUrl}" alt="${player.name}" class="live-auction-photo"/>` : ''}
          <div class="live-auction-info">
            <div class="live-auction-kicker"><span class="live-pulse"></span> LIVE AUCTION</div>
            <div class="live-auction-player">${player.name}</div>
            <div class="live-auction-category">
              ${player.category} · <span class="tier-badge tier-${player.auctionTier.toLowerCase()}">Tier ${player.auctionTier}</span>
            </div>
          </div>
          <div class="live-auction-bid">
            <span>Current bid</span>
            <strong>${formatPrice(amount, 'Rs')}</strong>
            <span>${leadingTeam ? `Leading: ${leadingTeam.name}` : 'Waiting for first team bid'}</span>
          </div>
        </div>
      `;
    })() : `
      <div class="live-auction-card live-auction-idle">
        <div class="live-auction-info">
          <div class="live-auction-kicker">AUCTION STATUS</div>
          <div class="live-auction-player">No player is currently on the auction block</div>
        </div>
      </div>
    `}
    <div class="stat-card" style="--stat-color:#22c55e;grid-column:span 1">
      <div class="stat-icon">✅</div>
      <div class="stat-val">${sold.length}</div>
      <div class="stat-label">Sold Players</div>
    </div>
    <div class="stat-card" style="--stat-color:#f59e0b;grid-column:span 1">
      <div class="stat-icon">⏳</div>
      <div class="stat-val">${available.length}</div>
      <div class="stat-label">Still Available</div>
    </div>
    <div class="stat-card" style="--stat-color:#ef4444;grid-column:span 1">
      <div class="stat-icon">❌</div>
      <div class="stat-val">${unsold.length}</div>
      <div class="stat-label">Unsold</div>
    </div>
  `;

  // Per-team cards
  teams.forEach(t => {
    const tp    = players.filter(p => p.teamId === t.id);
    const bL    = t.budgetLakhs || 0;
    const sL    = t.spentLakhs  || 0;
    const remL  = Math.max(0, bL - sL);
    const isMyTeam = t.id === currentTeam.id;
    html += `
      <div class="team-bid-card" style="${isMyTeam ? 'border-color:' + t.color + ';background:rgba(' + hexToRgb(t.color) + ',0.05)' : ''}">
        <div class="tbc-header">
          <div class="tbc-color" style="background:${t.color}"></div>
          <div class="tbc-name">${t.name} ${isMyTeam ? '⭐' : ''}</div>
          <div class="tbc-count">${tp.length}</div>
        </div>
        <div class="tbc-players">
          ${tp.length === 0
            ? '<div style="color:var(--text-muted);font-size:0.8rem;padding:4px">No players yet</div>'
            : tp.map(p => `
              <div class="tbc-player-row">
                <span class="tbc-player-name">${p.name}</span>
                <span class="badge ${categoryBadge(p.category)}" style="font-size:0.68rem">${p.category}</span>
                <span style="color:var(--success);font-size:0.78rem;margin-left:6px">${formatPrice(p.soldPrice)}</span>
              </div>
            `).join('')}
        </div>
        <div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border);font-size:0.78rem;color:var(--text-muted)">
          Purse: ${formatPrice(bL)} &nbsp;|&nbsp; Spent: ${formatPrice(sL)} &nbsp;|&nbsp; Left: <span style="color:var(--success)">${formatPrice(remL)}</span>
        </div>
      </div>
    `;
  });

  grid.innerHTML = html;
}

// ---- ALL RESULTS ----
function renderAllResults() {
  const players = getPlayers().filter(p => p.status === 'Sold');
  const teams = getTeams();
  const tbody = document.getElementById('all-results-tbody');

  tbody.innerHTML = players.length === 0
    ? `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:40px">Auction hasn't concluded yet</td></tr>`
    : players.map((p, i) => {
      const team = p.teamId ? teams.find(t => t.id === p.teamId) : null;
      const isMyTeam = team && team.id === currentTeam.id;
      return `
        <tr ${isMyTeam ? 'style="background:rgba(255,107,0,0.05)"' : ''}>
          <td>${i + 1}</td>
          <td><strong>${p.name}</strong> ${isMyTeam ? '⭐' : ''}</td>
          <td><span class="badge ${categoryBadge(p.category)}">${p.category}</span></td>
          <td>
            ${team
              ? `<span style="display:flex;align-items:center;gap:5px">
                  <span class="color-dot" style="background:${team.color}"></span>${team.name}
                </span>`
              : '—'}
          </td>
          <td style="color:var(--success);font-weight:600">${formatPrice(p.soldPrice)}</td>
          <td>${p.nationality || '—'}</td>
        </tr>
      `;
    }).join('');
}

function renderTeamMatches() {
  const container = document.getElementById('team-matches-list');
  const matches = getMatches();
  const groups = [
    { status: 'live', title: '🔴 Live Matches' },
    { status: 'scheduled', title: '📅 Upcoming Schedule' },
    { status: 'completed', title: '✅ Completed Matches' },
    { status: 'cancelled', title: 'Cancelled Matches' }
  ];
  const sections = groups.map(({ status, title }) => {
    const groupedMatches = matches.filter((match) => match.status === status);
    if (!groupedMatches.length) return '';
    return `
      <section class="match-group">
        <h3 class="match-group-heading">${title}</h3>
        <div class="match-list">
          ${groupedMatches.map((match) => {
            const home = match.homeTeam;
            const away = match.awayTeam;
            const playerRows = (team) => {
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
            const extras = (team) => team.id === home.id ? match.extras.home : match.extras.away;
            const teamPanel = (team) => `
              <section class="match-points-team">
                <h4>${escapeHtml(team.name)} — Player Points</h4>
                ${playerRows(team)}
                <p class="match-extras-line">Extras: All-outs <strong>${extras(team).allOut}</strong>
                  · Technical <strong>${extras(team).technical}</strong>
                  · Total <strong>${extras(team).total}</strong></p>
              </section>
            `;
            const hasScore = status === 'live' || status === 'completed';
            return `
              <article class="match-card match-team-card">
                <div class="match-card-header">
                  <div>
                    <span class="match-status match-status-${escapeHtml(match.status)}">${escapeHtml(status[0].toUpperCase() + status.slice(1))}</span>
                    <span class="match-round-label">${escapeHtml(getMatchRoundLabel(match))}</span>
                    <h3>${escapeHtml(new Date(match.scheduledAt).toLocaleString())}</h3>
                    <p class="match-venue">${escapeHtml(match.venue || 'Venue to be announced')}</p>
                  </div>
                </div>
                ${match.toss ? `
                  <p class="match-toss-summary">Toss: <strong>${escapeHtml(match.toss.winnerTeamName)}</strong> won and
                    ${match.toss.decision === 'raid' ? 'elected to raid' : 'elected to choose court side'}.</p>
                ` : ''}
                ${match.tieBreak?.phase ? `
                  <p class="match-tiebreak-summary">
                    Super 5: <strong>${escapeHtml(home.name)} ${match.tieBreak.homeScore} – ${match.tieBreak.awayScore} ${escapeHtml(away.name)}</strong>
                    ${match.tieBreak.toss ? ` · Golden toss: <strong>${escapeHtml(match.tieBreak.toss.winnerTeamName)}</strong> chose to ${escapeHtml(match.tieBreak.toss.decision)}.` : ''}
                  </p>
                ` : ''}
                ${status === 'completed' ? `
                  <p class="match-outcome">${escapeHtml(getMatchOutcome(match))}</p>
                ` : ''}
                ${status === 'completed' ? `
                  <button class="match-scoreboard match-score-toggle" type="button"
                    aria-expanded="false" aria-controls="team-match-details-${escapeHtml(match.id)}"
                    aria-label="Show player points for ${escapeHtml(home.name)} versus ${escapeHtml(away.name)}"
                    onclick="toggleTeamMatchDetails(event,'team-match-details-${escapeHtml(match.id)}')">
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
                  <div id="team-match-details-${escapeHtml(match.id)}" class="match-player-points match-readonly-points" hidden>
                    ${teamPanel(home)}${teamPanel(away)}
                  </div>
                ` : `
                  <div class="match-scoreboard">
                    <div class="match-side" style="--match-team-color:${escapeHtml(home.color)}">
                      <div class="match-team-name">${escapeHtml(home.name)}</div>
                      <div class="match-score-value">${hasScore ? match.homeScore : '—'}</div>
                    </div>
                    <span class="match-score-separator">–</span>
                    <div class="match-side" style="--match-team-color:${escapeHtml(away.color)}">
                      <div class="match-team-name">${escapeHtml(away.name)}</div>
                      <div class="match-score-value">${hasScore ? match.awayScore : '—'}</div>
                    </div>
                  </div>
                  ${status === 'live' ? `
                    <div class="match-player-points match-readonly-points">${teamPanel(home)}${teamPanel(away)}</div>
                  ` : ''}
                `}
              </article>
            `;
          }).join('')}
        </div>
      </section>
    `;
  }).join('');

  container.innerHTML = sections || '<div class="empty-state"><div class="empty-icon">🏟️</div><div class="empty-text">No match schedule is available yet.</div></div>';
}

function toggleTeamMatchDetails(event, detailsId) {
  const details = document.getElementById(detailsId);
  if (!details) return;
  details.hidden = !details.hidden;
  event.currentTarget.setAttribute('aria-expanded', String(!details.hidden));
}

// ---- UTILS ----
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `${r},${g},${b}`;
}

(async function initializeTeamPortal() {
  try {
    const user = await initData();
    if (!user || user.type !== 'team') {
      window.location.href = '/';
      return;
    }
    await refreshData();
    const initialOutcome = getLastAuctionOutcome();
    lastSeenAuctionOutcomeAt = initialOutcome?.occurredAt || null;
    if (initialOutcome && Date.now() - new Date(initialOutcome.occurredAt).getTime() < 12000) {
      showAuctionOutcome(initialOutcome);
    }
    currentTeam = getTeams().find((team) => team.id === user.teamId);
    if (!currentTeam) {
      await logout();
      return;
    }
    applyTeamBranding();
    showTeamSection('overview');
    let refreshingAuction = false;
    setInterval(async () => {
      const liveSection = document.getElementById('section-auction-live');
      if (document.visibilityState !== 'visible' || refreshingAuction) return;
      refreshingAuction = true;
      try {
        await refreshData();
        currentTeam = getTeamById(user.teamId) || currentTeam;
        const outcome = getLastAuctionOutcome();
        if (outcome && outcome.occurredAt !== lastSeenAuctionOutcomeAt) {
          lastSeenAuctionOutcomeAt = outcome.occurredAt;
          showAuctionOutcome(outcome);
        }
        if (liveSection.classList.contains('active')) renderAuctionStatus();
        if (document.getElementById('section-matches').classList.contains('active')) renderTeamMatches();
        if (document.getElementById('section-stats').classList.contains('active')) renderSeasonStats('team-season-stats');
      } catch (error) {
        showRequestError(error);
      } finally {
        refreshingAuction = false;
      }
    }, 3000);
  } catch (error) {
    showRequestError(error);
  }
})();
