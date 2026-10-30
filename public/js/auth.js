/* =========================================================
   KKPL – Public Match Center & Auth Management
   ========================================================= */

let currentMainView = 'matches';
let currentMatchFilter = 'all';
let publicMatchesData = [];
let publicPollInterval = null;

function switchMainView(view) {
  currentMainView = view;
  const btnMatches = document.getElementById('btn-view-matches');
  const btnLogin = document.getElementById('btn-view-login');
  const viewMatches = document.getElementById('view-matches');
  const viewLogin = document.getElementById('view-login');

  if (view === 'matches') {
    if (btnMatches) btnMatches.classList.add('active');
    if (btnLogin) btnLogin.classList.remove('active');
    if (viewMatches) viewMatches.style.display = 'block';
    if (viewLogin) viewLogin.style.display = 'none';
    fetchAndRenderPublicMatches();
    window.location.hash = '#matches';
  } else {
    if (btnLogin) btnLogin.classList.add('active');
    if (btnMatches) btnMatches.classList.remove('active');
    if (viewMatches) viewMatches.style.display = 'none';
    if (viewLogin) viewLogin.style.display = 'flex';
    window.location.hash = '#login';
  }
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((button) => button.classList.remove('active'));
  document.querySelectorAll('.login-form').forEach((form) => form.classList.remove('active'));
  const tabEl = document.getElementById('tab-' + tab);
  const formEl = document.getElementById('form-' + tab);
  if (tabEl) tabEl.classList.add('active');
  if (formEl) formEl.classList.add('active');
}

function filterPublicMatches(filter, buttonEl) {
  currentMatchFilter = filter;
  document.querySelectorAll('.match-filter-bar .pill-btn').forEach((b) => b.classList.remove('active'));
  if (buttonEl) buttonEl.classList.add('active');
  renderPublicMatchesList();
}

function getMatchRoundLabel(roundType) {
  const map = {
    league: 'League Match',
    quarterfinal: 'Quarterfinal',
    semifinal: 'Semifinal',
    final: 'Championship Final'
  };
  return map[roundType] || 'Match';
}

function formatMatchTime(isoString) {
  try {
    const d = new Date(isoString);
    if (!Number.isFinite(d.getTime())) return 'Time TBA';
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today, ${timeStr}`;
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
  } catch (e) {
    return 'Time TBA';
  }
}

function renderPublicMatchesList() {
  const container = document.getElementById('public-matches-list');
  if (!container) return;

  const filtered = publicMatchesData.filter((m) => {
    if (currentMatchFilter === 'all') return true;
    return m.status === currentMatchFilter;
  });

  if (filtered.length === 0) {
    let emptyTitle = 'No Matches Found';
    let emptySub = 'There are no matches under this category yet.';
    if (currentMatchFilter === 'live') {
      emptyTitle = 'No Live Matches Right Now';
      emptySub = 'Check upcoming scheduled matches below or come back during match time.';
    } else if (currentMatchFilter === 'scheduled') {
      emptyTitle = 'No Upcoming Matches Scheduled';
      emptySub = 'Stay tuned for official match scheduling announcements.';
    } else if (currentMatchFilter === 'completed') {
      emptyTitle = 'No Completed Matches Yet';
      emptySub = 'Completed match scorecards will appear here once matches conclude.';
    }

    container.innerHTML = `
      <div class="public-empty-box">
        <div class="public-empty-icon">🏟️</div>
        <div class="public-empty-title">${escapeHtml(emptyTitle)}</div>
        <div class="public-empty-sub">${escapeHtml(emptySub)}</div>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map((match) => {
    const home = match.homeTeam || { name: 'Home Team', color: '#ff6600' };
    const away = match.awayTeam || { name: 'Away Team', color: '#38bdf8' };
    const homeScore = Number(match.homeScore) || 0;
    const awayScore = Number(match.awayScore) || 0;
    const isLive = match.status === 'live';
    const isCompleted = match.status === 'completed';
    const isScheduled = match.status === 'scheduled';

    let leadText = '';
    let leadClass = '';
    if (isLive) {
      if (homeScore > awayScore) {
        leadText = `⚡ ${home.name} leads by ${homeScore - awayScore} pts`;
        leadClass = 'lead-status-live';
      } else if (awayScore > homeScore) {
        leadText = `⚡ ${away.name} leads by ${awayScore - homeScore} pts`;
        leadClass = 'lead-status-live';
      } else {
        leadText = '⚡ Scores Level (Tied)';
        leadClass = 'lead-status-tied';
      }
    }

    let winnerText = '';
    if (isCompleted) {
      if (homeScore > awayScore) {
        winnerText = `👑 ${home.name} Won (${homeScore} - ${awayScore})`;
      } else if (awayScore > homeScore) {
        winnerText = `👑 ${away.name} Won (${awayScore} - ${homeScore})`;
      } else {
        winnerText = `🤝 Match Tied (${homeScore} - ${awayScore})`;
      }
    }

    return `
      <article class="public-match-card ${isLive ? 'is-live' : ''}">
        <div class="public-match-card-header">
          <div class="public-match-badge-wrap">
            ${isLive ? `
              <span class="public-match-badge public-badge-live">
                <span class="pulse-dot"></span> LIVE NOW
              </span>
            ` : isScheduled ? `
              <span class="public-match-badge public-badge-scheduled">⏳ UPCOMING</span>
            ` : `
              <span class="public-match-badge public-badge-completed">🏆 COMPLETED</span>
            `}
            <span class="public-round-badge">${escapeHtml(getMatchRoundLabel(match.roundType))}</span>
          </div>
          <div class="public-match-time">${escapeHtml(formatMatchTime(match.scheduledAt))}</div>
        </div>

        <div class="public-scoreboard-body">
          <!-- Home Team -->
          <div class="public-team-column">
            <div class="public-team-avatar" style="background:${escapeHtml(home.color || '#ff6600')}">
              ${escapeHtml(home.name ? home.name.charAt(0) : 'H')}
            </div>
            <div class="public-team-title">${escapeHtml(home.name)}</div>
          </div>

          <!-- Score Display / VS -->
          <div class="public-score-center">
            ${isScheduled ? `
              <div class="public-vs-text">VS</div>
            ` : `
              <div class="public-score-display">
                <span class="public-score-num ${isCompleted && homeScore > awayScore ? 'score-winner' : ''}">${homeScore}</span>
                <span class="public-score-dash">–</span>
                <span class="public-score-num ${isCompleted && awayScore > homeScore ? 'score-winner' : ''}">${awayScore}</span>
              </div>
            `}
            ${leadText ? `<div class="public-lead-status ${leadClass}">${escapeHtml(leadText)}</div>` : ''}
          </div>

          <!-- Away Team -->
          <div class="public-team-column">
            <div class="public-team-avatar" style="background:${escapeHtml(away.color || '#38bdf8')}">
              ${escapeHtml(away.name ? away.name.charAt(0) : 'A')}
            </div>
            <div class="public-team-title">${escapeHtml(away.name)}</div>
          </div>
        </div>

        <div class="public-card-footer">
          <div class="public-venue-text" title="${escapeHtml(match.venue || 'Venue TBA')}">
            <span>🏟️</span> ${escapeHtml(match.venue || 'Venue TBA')}
          </div>
          ${winnerText ? `
            <div class="public-winner-badge">${escapeHtml(winnerText)}</div>
          ` : match.toss ? `
            <div style="font-size: 0.72rem; color: #94a3b8;">
              🪙 ${escapeHtml(match.toss.winnerTeamName)} won toss (${escapeHtml(match.toss.decision === 'raid' ? 'Raid' : 'Court')})
            </div>
          ` : ''}
        </div>
      </article>
    `;
  }).join('');
}

async function fetchAndRenderPublicMatches(isManual = false) {
  try {
    const matches = await apiRequest('/api/matches');
    publicMatchesData = Array.isArray(matches) ? matches : [];

    // Update counts
    const countAll = document.getElementById('count-all');
    const countLive = document.getElementById('count-live');
    const countScheduled = document.getElementById('count-scheduled');
    const countCompleted = document.getElementById('count-completed');

    const liveCount = publicMatchesData.filter((m) => m.status === 'live').length;
    const scheduledCount = publicMatchesData.filter((m) => m.status === 'scheduled').length;
    const completedCount = publicMatchesData.filter((m) => m.status === 'completed').length;

    if (countAll) countAll.textContent = publicMatchesData.length;
    if (countLive) countLive.textContent = liveCount;
    if (countScheduled) countScheduled.textContent = scheduledCount;
    if (countCompleted) countCompleted.textContent = completedCount;

    renderPublicMatchesList();
    if (isManual && typeof showToast === 'function') {
      showToast('Scores updated from server!');
    }
  } catch (error) {
    console.error('Failed to load public matches:', error);
  }
}

async function login(e, type) {
  e.preventDefault();
  const prefix = type === 'admin' ? 'admin' : 'team';
  const email = document.getElementById(`${prefix}-email`).value.trim();
  const password = document.getElementById(`${prefix}-password`).value;
  const errorEl = document.getElementById(`${prefix}-error`);

  try {
    const result = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, type })
    });
    if (result.token && typeof localStorage !== 'undefined') {
      localStorage.setItem('kkpl_token', result.token);
    }
    setSession(result.user);
    window.location.href = type === 'admin' ? '/admin' : '/team';
  } catch (error) {
    errorEl.textContent = error.message;
    setTimeout(() => { errorEl.textContent = ''; }, 4000);
  }
}

function adminLogin(e) { return login(e, 'admin'); }
function teamLogin(e) { return login(e, 'team'); }

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

// Background poller for live scorecards
publicPollInterval = setInterval(() => {
  if (document.visibilityState === 'visible' && currentMainView === 'matches') {
    fetchAndRenderPublicMatches();
  }
}, 3000);

// Initialize view
(async function initializeIndex() {
  try {
    const hash = window.location.hash;
    if (hash === '#login') {
      switchMainView('login');
    } else {
      switchMainView('matches');
    }

    await initData();
  } catch (error) {
    console.warn('Init error on index:', error);
  }
})();
