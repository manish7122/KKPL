// In-Memory Database Mock for AI Studio preview environment
// Provides a full in-memory fallback for PostgreSQL queries used by KKPL
const bcrypt = require('bcryptjs');

function createMockPool(demoTeams = [], demoPlayers = []) {
  const teams = new Map();
  const players = new Map();
  const auction_state = {
    id: 1,
    player_id: null,
    last_result_player_id: null,
    last_result_status: null,
    last_result_at: null
  };
  const app_settings = new Map([['registration_open', 'true']]);
  const auction_bid_history = [];
  let bidHistoryId = 1;
  const matches = new Map();
  const match_score_events = [];

  // Seed initial demo data
  for (const team of demoTeams) {
    teams.set(team.id, {
      id: team.id,
      name: team.name,
      city: team.city,
      coach: team.coach || '',
      color: team.color || '#ff6600',
      email: (team.email || '').toLowerCase().trim(),
      password_hash: bcrypt.hashSync(team.password, 10),
      budget_lakhs: team.budgetLakhs || 400,
      sponsor: team.sponsor || ''
    });
  }

  for (const p of demoPlayers) {
    players.set(p.id, {
      id: p.id,
      name: p.name,
      age: p.age,
      nationality: p.nationality || 'India',
      category: p.category,
      playing_position: p.playingPosition || null,
      auction_tier: p.auctionTier || 'B',
      base_price: p.basePrice,
      current_bid: null,
      current_team_id: null,
      photo_mime: null,
      photo_data: null,
      prev_team: p.prevTeam || '',
      skills: p.skills || '',
      status: 'Available',
      team_id: null,
      sold_price: null
    });
  }

  // Seed initial sample matches (Live, Upcoming, Completed)
  matches.set('M_LIVE_1', {
    id: 'M_LIVE_1',
    home_team_id: 'T_JAIPUR',
    away_team_id: 'T_PATNA',
    scheduled_at: new Date(Date.now() - 3600000).toISOString(),
    venue: 'SMS Indoor Stadium, Jaipur',
    status: 'live',
    round_type: 'league',
    home_score: 36,
    away_score: 32,
    tie_break_phase: null,
    tie_break_golden_raid_team_id: null,
    tie_break_toss_team_id: null,
    tie_break_toss_decision: null,
    toss_winner_team_id: 'T_JAIPUR',
    toss_decision: 'court',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  matches.set('M_UPCOMING_1', {
    id: 'M_UPCOMING_1',
    home_team_id: 'T_BENGALURU',
    away_team_id: 'T_JAIPUR',
    scheduled_at: new Date(Date.now() + 86400000).toISOString(),
    venue: 'Kanteerava Indoor Stadium, Bengaluru',
    status: 'scheduled',
    round_type: 'league',
    home_score: 0,
    away_score: 0,
    tie_break_phase: null,
    tie_break_golden_raid_team_id: null,
    tie_break_toss_team_id: null,
    tie_break_toss_decision: null,
    toss_winner_team_id: null,
    toss_decision: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  matches.set('M_COMPLETED_1', {
    id: 'M_COMPLETED_1',
    home_team_id: 'T_PATNA',
    away_team_id: 'T_BENGALURU',
    scheduled_at: new Date(Date.now() - 86400000).toISOString(),
    venue: 'Patliputra Sports Complex, Patna',
    status: 'completed',
    round_type: 'league',
    home_score: 41,
    away_score: 35,
    tie_break_phase: null,
    tie_break_golden_raid_team_id: null,
    tie_break_toss_team_id: null,
    tie_break_toss_decision: null,
    toss_winner_team_id: 'T_PATNA',
    toss_decision: 'raid',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  async function executeQuery(sql, params = []) {
    const s = sql.trim().replace(/\s+/g, ' ');

    // Transaction & locks
    if (/^BEGIN/i.test(s) || /^COMMIT/i.test(s) || /^ROLLBACK/i.test(s)) {
      return { rows: [], rowCount: 0 };
    }
    if (/pg_advisory_xact_lock/i.test(s)) {
      return { rows: [{ pg_advisory_xact_lock: true }], rowCount: 1 };
    }
    if (/^CREATE TABLE/i.test(s) || /^ALTER TABLE/i.test(s) || /^CREATE INDEX/i.test(s) || /^DROP CONSTRAINT/i.test(s)) {
      return { rows: [], rowCount: 0 };
    }

    // App settings
    if (/INSERT INTO app_settings/i.test(s)) {
      return { rows: [], rowCount: 1 };
    }
    if (/SELECT value FROM app_settings WHERE key = 'registration_open'/i.test(s)) {
      return { rows: [{ value: app_settings.get('registration_open') || 'true' }], rowCount: 1 };
    }
    if (/UPDATE app_settings SET value=\$1 WHERE key='registration_open'/i.test(s)) {
      app_settings.set('registration_open', String(params[0]));
      return { rows: [], rowCount: 1 };
    }

    // Auction State init
    if (/INSERT INTO auction_state/i.test(s)) {
      return { rows: [], rowCount: 1 };
    }

    // Match migrations
    if (/INSERT INTO match_score_migrations/i.test(s)) {
      return { rows: [], rowCount: 0 };
    }
    if (/SELECT id, home_team_id, away_team_id, home_score, away_score FROM matches/i.test(s)) {
      return { rows: [], rowCount: 0 };
    }
    if (/SELECT match_id, player_id, team_id, points FROM match_player_points/i.test(s)) {
      return { rows: [], rowCount: 0 };
    }

    // Teams count
    if (/SELECT COUNT\(\*\)::int AS total FROM teams/i.test(s)) {
      return { rows: [{ total: teams.size }], rowCount: 1 };
    }

    // List Teams with aggregate
    if (/FROM teams t/i.test(s) && /spent_lakhs/i.test(s)) {
      const rows = [...teams.values()].map((t) => {
        const soldPlayers = [...players.values()].filter((p) => p.team_id === t.id && p.status === 'Sold');
        const spent = soldPlayers.reduce((sum, p) => sum + Number(p.sold_price || 0), 0);
        const playerIds = soldPlayers.map((p) => p.id);
        return {
          id: t.id,
          name: t.name,
          city: t.city,
          coach: t.coach || '',
          color: t.color || '#ff6600',
          email: t.email,
          budget_lakhs: t.budget_lakhs,
          sponsor: t.sponsor || '',
          spent_lakhs: spent,
          players: playerIds
        };
      }).sort((a, b) => a.name.localeCompare(b.name));
      return { rows, rowCount: rows.length };
    }

    // Auth: Login query for teams
    if (/SELECT id, email, password_hash FROM teams WHERE email = \$1/i.test(s)) {
      const email = String(params[0] || '').trim().toLowerCase();
      const team = [...teams.values()].find((t) => t.email.toLowerCase() === email);
      return { rows: team ? [{ id: team.id, email: team.email, password_hash: team.password_hash }] : [], rowCount: team ? 1 : 0 };
    }

    // Teams CRUD
    if (/INSERT INTO teams/i.test(s)) {
      const team = {
        id: params[0],
        name: params[1],
        city: params[2],
        coach: params[3] || '',
        color: params[4] || '#ff6600',
        email: (params[5] || '').toLowerCase().trim(),
        password_hash: params[6],
        budget_lakhs: Number(params[7]),
        sponsor: params[8] || ''
      };
      teams.set(team.id, team);
      return { rows: [team], rowCount: 1 };
    }

    if (/SELECT id FROM teams WHERE id=\$1 FOR UPDATE/i.test(s) || /SELECT \* FROM teams WHERE id=\$1/i.test(s)) {
      const team = teams.get(params[0]);
      return { rows: team ? [team] : [], rowCount: team ? 1 : 0 };
    }

    if (/UPDATE teams SET name=\$1, city=\$2, coach=\$3, color=\$4, email=\$5, budget_lakhs=\$6, sponsor=\$7, password_hash=\$8 WHERE id=\$9/i.test(s)) {
      const team = teams.get(params[8]);
      if (!team) return { rows: [], rowCount: 0 };
      team.name = params[0];
      team.city = params[1];
      team.coach = params[2];
      team.color = params[3];
      team.email = (params[4] || '').toLowerCase().trim();
      team.budget_lakhs = Number(params[5]);
      team.sponsor = params[6];
      team.password_hash = params[7];
      return { rows: [team], rowCount: 1 };
    }

    if (/UPDATE teams SET name=\$1, city=\$2, coach=\$3, color=\$4, email=\$5, budget_lakhs=\$6, sponsor=\$7 WHERE id=\$8/i.test(s)) {
      const team = teams.get(params[7]);
      if (!team) return { rows: [], rowCount: 0 };
      team.name = params[0];
      team.city = params[1];
      team.coach = params[2];
      team.color = params[3];
      team.email = (params[4] || '').toLowerCase().trim();
      team.budget_lakhs = Number(params[5]);
      team.sponsor = params[6];
      return { rows: [team], rowCount: 1 };
    }

    if (/DELETE FROM teams WHERE id=\$1/i.test(s)) {
      const deleted = teams.delete(params[0]);
      return { rows: [], rowCount: deleted ? 1 : 0 };
    }

    // List Players
    if (/SELECT id, name, age, nationality, category, playing_position, auction_tier, base_price, photo_mime, current_bid, current_team_id, prev_team, skills, status, team_id, sold_price FROM players ORDER BY name/i.test(s)) {
      const rows = [...players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        age: p.age,
        nationality: p.nationality || '',
        category: p.category,
        playing_position: p.playing_position || null,
        auction_tier: p.auction_tier || 'B',
        base_price: p.base_price,
        photo_mime: p.photo_mime || null,
        current_bid: p.current_bid ?? null,
        current_team_id: p.current_team_id || null,
        prev_team: p.prev_team || '',
        skills: p.skills || '',
        status: p.status || 'Available',
        team_id: p.team_id || null,
        sold_price: p.sold_price ?? null
      })).sort((a, b) => a.name.localeCompare(b.name));
      return { rows, rowCount: rows.length };
    }

    // Players photo
    if (/SELECT photo_mime, photo_data FROM players WHERE id=\$1/i.test(s)) {
      const p = players.get(params[0]);
      return { rows: p ? [{ photo_mime: p.photo_mime, photo_data: p.photo_data }] : [], rowCount: p ? 1 : 0 };
    }

    // Player CRUD
    if (/INSERT INTO players/i.test(s)) {
      let p;
      if (s.includes('playing_position')) {
        p = {
          id: params[0],
          name: params[1],
          age: Number(params[2]),
          nationality: params[3] || '',
          category: params[4],
          playing_position: params[5] || null,
          auction_tier: params[6] || 'B',
          base_price: Number(params[7]),
          photo_mime: params[8] || null,
          photo_data: params[9] || null,
          prev_team: params[10] || '',
          skills: params[11] || '',
          status: 'Available',
          current_bid: null,
          current_team_id: null,
          team_id: null,
          sold_price: null
        };
      } else if (s.includes("'B', 0.01")) {
        // Player registration
        p = {
          id: params[0],
          name: params[1],
          age: Number(params[2]),
          nationality: params[3] || '',
          category: params[4],
          playing_position: null,
          auction_tier: 'B',
          base_price: 0.01,
          photo_mime: params[5] || null,
          photo_data: params[6] || null,
          prev_team: params[7] || '',
          skills: params[8] || '',
          status: 'Available',
          current_bid: null,
          current_team_id: null,
          team_id: null,
          sold_price: null
        };
      } else {
        // Seed player
        p = {
          id: params[0],
          name: params[1],
          age: Number(params[2]),
          nationality: params[3] || '',
          category: params[4],
          playing_position: null,
          auction_tier: 'B',
          base_price: Number(params[5]),
          photo_mime: null,
          photo_data: null,
          prev_team: params[6] || '',
          skills: params[7] || '',
          status: 'Available',
          current_bid: null,
          current_team_id: null,
          team_id: null,
          sold_price: null
        };
      }
      players.set(p.id, p);
      return { rows: [p], rowCount: 1 };
    }

    if (/UPDATE players SET name=\$1, age=\$2, nationality=\$3, category=\$4, playing_position=\$5, auction_tier=\$6, base_price=\$7/i.test(s)) {
      const p = players.get(params[12]);
      if (!p) return { rows: [], rowCount: 0 };
      p.name = params[0];
      p.age = Number(params[1]);
      p.nationality = params[2] || '';
      p.category = params[3];
      p.playing_position = params[4] || null;
      p.auction_tier = params[5] || 'B';
      p.base_price = Number(params[6]);
      if (params[7]) { // Boolean(photo)
        p.photo_mime = params[8];
        p.photo_data = params[9];
      }
      p.prev_team = params[10] || '';
      p.skills = params[11] || '';
      return { rows: [p], rowCount: 1 };
    }

    if (/DELETE FROM players WHERE id = \$1/i.test(s)) {
      const deleted = players.delete(params[0]);
      return { rows: [], rowCount: deleted ? 1 : 0 };
    }

    if (/SELECT \* FROM players WHERE id=\$1/i.test(s) || /SELECT status FROM players WHERE id=\$1/i.test(s) || /SELECT team_id, category FROM players WHERE id=\$1/i.test(s)) {
      const p = players.get(params[0]);
      return { rows: p ? [p] : [], rowCount: p ? 1 : 0 };
    }

    // Available players count excluding one
    if (/SELECT COUNT\(\*\)::int AS total FROM players WHERE status='Available' AND id<>\$1/i.test(s)) {
      const count = [...players.values()].filter((p) => p.status === 'Available' && p.id !== params[0]).length;
      return { rows: [{ total: count }], rowCount: 1 };
    }

    // Team spent
    if (/SELECT COALESCE\(SUM\(sold_price\), 0\) AS spent FROM players WHERE team_id=\$1 AND status='Sold'/i.test(s)) {
      const spent = [...players.values()]
        .filter((p) => p.team_id === params[0] && p.status === 'Sold')
        .reduce((sum, p) => sum + Number(p.sold_price || 0), 0);
      return { rows: [{ spent }], rowCount: 1 };
    }

    // Reset players on team delete
    if (/UPDATE players SET status='Available', team_id=NULL, sold_price=NULL WHERE team_id=\$1/i.test(s)) {
      for (const p of players.values()) {
        if (p.team_id === params[0]) {
          p.status = 'Available';
          p.team_id = null;
          p.sold_price = null;
        }
      }
      return { rows: [], rowCount: 1 };
    }
    if (/UPDATE players SET current_bid=NULL, current_team_id=NULL WHERE current_team_id=\$1/i.test(s)) {
      for (const p of players.values()) {
        if (p.current_team_id === params[0]) {
          p.current_bid = null;
          p.current_team_id = null;
        }
      }
      return { rows: [], rowCount: 1 };
    }

    // Auction State Query
    if (/FROM auction_state a/i.test(s)) {
      const activePlayer = auction_state.player_id ? players.get(auction_state.player_id) : null;
      const outcomePlayer = auction_state.last_result_player_id ? players.get(auction_state.last_result_player_id) : null;
      const outcomeTeam = outcomePlayer?.team_id ? teams.get(outcomePlayer.team_id) : null;

      const row = {
        player_id: auction_state.player_id,
        last_result_player_id: auction_state.last_result_player_id,
        last_result_status: auction_state.last_result_status,
        last_result_at: auction_state.last_result_at,

        id: activePlayer?.id || null,
        name: activePlayer?.name || null,
        age: activePlayer?.age || null,
        nationality: activePlayer?.nationality || null,
        category: activePlayer?.category || null,
        playing_position: activePlayer?.playing_position || null,
        auction_tier: activePlayer?.auction_tier || null,
        base_price: activePlayer?.base_price ?? null,
        photo_mime: activePlayer?.photo_mime || null,
        photo_data: activePlayer?.photo_data || null,
        current_bid: activePlayer?.current_bid ?? null,
        current_team_id: activePlayer?.current_team_id || null,
        prev_team: activePlayer?.prev_team || null,
        skills: activePlayer?.skills || null,
        status: activePlayer?.status || null,
        team_id: activePlayer?.team_id || null,
        sold_price: activePlayer?.sold_price ?? null,

        outcome_player_id: outcomePlayer?.id || null,
        outcome_player_name: outcomePlayer?.name || null,
        outcome_player_age: outcomePlayer?.age || null,
        outcome_player_nationality: outcomePlayer?.nationality || null,
        outcome_player_category: outcomePlayer?.category || null,
        outcome_player_playing_position: outcomePlayer?.playing_position || null,
        outcome_player_auction_tier: outcomePlayer?.auction_tier || null,
        outcome_player_base_price: outcomePlayer?.base_price ?? null,
        outcome_player_photo_mime: outcomePlayer?.photo_mime || null,
        outcome_player_current_bid: outcomePlayer?.current_bid ?? null,
        outcome_player_current_team_id: outcomePlayer?.current_team_id || null,
        outcome_player_prev_team: outcomePlayer?.prev_team || null,
        outcome_player_skills: outcomePlayer?.skills || null,
        outcome_player_status: outcomePlayer?.status || null,
        outcome_player_team_id: outcomePlayer?.team_id || null,
        outcome_player_sold_price: outcomePlayer?.sold_price ?? null,
        outcome_team_name: outcomeTeam?.name || null
      };
      return { rows: [row], rowCount: 1 };
    }

    if (/SELECT player_id FROM auction_state WHERE id=1/i.test(s)) {
      return { rows: [{ player_id: auction_state.player_id }], rowCount: 1 };
    }

    if (/UPDATE auction_state SET player_id=\$1 WHERE id=1/i.test(s)) {
      auction_state.player_id = params[0] || null;
      return { rows: [], rowCount: 1 };
    }

    if (/UPDATE auction_state SET player_id=NULL, last_result_player_id=\$1, last_result_status='Sold'/i.test(s)) {
      auction_state.player_id = null;
      auction_state.last_result_player_id = params[0];
      auction_state.last_result_status = 'Sold';
      auction_state.last_result_at = new Date().toISOString();
      return { rows: [], rowCount: 1 };
    }

    if (/UPDATE auction_state SET player_id=NULL, last_result_player_id=\$1, last_result_status='Unsold'/i.test(s)) {
      auction_state.player_id = null;
      auction_state.last_result_player_id = params[0];
      auction_state.last_result_status = 'Unsold';
      auction_state.last_result_at = new Date().toISOString();
      return { rows: [], rowCount: 1 };
    }

    if (/UPDATE auction_state SET player_id=NULL WHERE id=1 AND player_id=\$1/i.test(s)) {
      if (auction_state.player_id === params[0]) {
        auction_state.player_id = null;
      }
      return { rows: [], rowCount: 1 };
    }

    // Bidding mutations
    if (/UPDATE players SET current_bid=\$1, current_team_id=\$2 WHERE id=\$3/i.test(s)) {
      const p = players.get(params[2]);
      if (p) {
        p.current_bid = Number(params[0]);
        p.current_team_id = params[1];
      }
      return { rows: [], rowCount: p ? 1 : 0 };
    }

    if (/INSERT INTO auction_bid_history \(player_id, team_id, bid_amount\) VALUES \(\$1, \$2, \$3\)/i.test(s)) {
      const bid = {
        id: bidHistoryId++,
        player_id: params[0],
        team_id: params[1],
        bid_amount: Number(params[2]),
        created_at: new Date()
      };
      auction_bid_history.push(bid);
      return { rows: [bid], rowCount: 1 };
    }

    if (/SELECT id FROM auction_bid_history WHERE player_id=\$1 ORDER BY id DESC LIMIT 1/i.test(s)) {
      const bids = auction_bid_history.filter((b) => b.player_id === params[0]);
      const last = bids[bids.length - 1];
      return { rows: last ? [last] : [], rowCount: last ? 1 : 0 };
    }

    if (/DELETE FROM auction_bid_history WHERE id=\$1/i.test(s)) {
      const idx = auction_bid_history.findIndex((b) => b.id === Number(params[0]));
      if (idx !== -1) auction_bid_history.splice(idx, 1);
      return { rows: [], rowCount: idx !== -1 ? 1 : 0 };
    }

    if (/DELETE FROM auction_bid_history WHERE player_id=\$1/i.test(s)) {
      let count = 0;
      for (let i = auction_bid_history.length - 1; i >= 0; i--) {
        if (auction_bid_history[i].player_id === params[0]) {
          auction_bid_history.splice(i, 1);
          count++;
        }
      }
      return { rows: [], rowCount: count };
    }

    if (/DELETE FROM auction_bid_history WHERE team_id=\$1/i.test(s)) {
      let count = 0;
      for (let i = auction_bid_history.length - 1; i >= 0; i--) {
        if (auction_bid_history[i].team_id === params[0]) {
          auction_bid_history.splice(i, 1);
          count++;
        }
      }
      return { rows: [], rowCount: count };
    }

    if (/SELECT bid_amount, team_id FROM auction_bid_history WHERE player_id=\$1 ORDER BY id DESC LIMIT 1/i.test(s)) {
      const bids = auction_bid_history.filter((b) => b.player_id === params[0]);
      const last = bids[bids.length - 1];
      return { rows: last ? [{ bid_amount: last.bid_amount, team_id: last.team_id }] : [], rowCount: last ? 1 : 0 };
    }

    if (/UPDATE players SET current_bid=NULL, current_team_id=NULL WHERE id=\$1/i.test(s)) {
      const p = players.get(params[0]);
      if (p) {
        p.current_bid = null;
        p.current_team_id = null;
      }
      return { rows: [], rowCount: p ? 1 : 0 };
    }

    if (/UPDATE players SET status='Available', current_bid=NULL, current_team_id=NULL WHERE id=\$1/i.test(s)) {
      const p = players.get(params[0]);
      if (p) {
        p.status = 'Available';
        p.current_bid = null;
        p.current_team_id = null;
      }
      return { rows: [], rowCount: p ? 1 : 0 };
    }

    if (/UPDATE players SET status='Available', team_id=NULL, sold_price=NULL, current_bid=NULL, current_team_id=NULL WHERE id=\$1/i.test(s)) {
      const p = players.get(params[0]);
      if (p) {
        p.status = 'Available';
        p.team_id = null;
        p.sold_price = null;
        p.current_bid = null;
        p.current_team_id = null;
      }
      return { rows: [], rowCount: p ? 1 : 0 };
    }

    if (/UPDATE players SET status='Sold', team_id=\$1, sold_price=\$2 WHERE id=\$3/i.test(s)) {
      const p = players.get(params[2]);
      if (p) {
        p.status = 'Sold';
        p.team_id = params[0];
        p.sold_price = Number(params[1]);
      }
      return { rows: [], rowCount: p ? 1 : 0 };
    }

    if (/UPDATE players SET status='Unsold', team_id=NULL, sold_price=NULL, current_bid=NULL, current_team_id=NULL WHERE id=\$1 AND status='Available'/i.test(s)) {
      const p = players.get(params[0]);
      if (p && p.status === 'Available') {
        p.status = 'Unsold';
        p.team_id = null;
        p.sold_price = null;
        p.current_bid = null;
        p.current_team_id = null;
        return { rows: [{ id: p.id }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // Matches List
    if (/FROM matches m/i.test(s) && /home.name AS home_team_name/i.test(s)) {
      const rows = [...matches.values()].map((m) => {
        const home = teams.get(m.home_team_id);
        const away = teams.get(m.away_team_id);
        const tossWinner = m.toss_winner_team_id ? teams.get(m.toss_winner_team_id) : null;
        const goldenTossWinner = m.tie_break_toss_team_id ? teams.get(m.tie_break_toss_team_id) : null;

        return {
          id: m.id,
          home_team_id: m.home_team_id,
          home_team_name: home?.name || 'Home Team',
          home_team_color: home?.color || '#ff6600',
          away_team_id: m.away_team_id,
          away_team_name: away?.name || 'Away Team',
          away_team_color: away?.color || '#ff6600',
          scheduled_at: m.scheduled_at,
          venue: m.venue,
          status: m.status,
          home_score: m.home_score,
          away_score: m.away_score,
          toss_winner_team_id: m.toss_winner_team_id,
          toss_winner_team_name: tossWinner?.name || null,
          toss_decision: m.toss_decision,
          round_type: m.round_type,
          tie_break_phase: m.tie_break_phase,
          tie_break_golden_raid_team_id: m.tie_break_golden_raid_team_id,
          tie_break_toss_team_id: m.tie_break_toss_team_id,
          tie_break_toss_winner_name: goldenTossWinner?.name || null,
          tie_break_toss_decision: m.tie_break_toss_decision,
          created_at: m.created_at,
          updated_at: m.updated_at,
          round_number: 1
        };
      });
      return { rows, rowCount: rows.length };
    }

    // Match Score Events list
    if (/FROM match_score_events e/i.test(s) && /JOIN teams t/i.test(s)) {
      const rows = match_score_events.map((e) => {
        const team = teams.get(e.team_id);
        const player = e.player_id ? players.get(e.player_id) : null;
        return {
          id: e.id,
          match_id: e.match_id,
          team_id: e.team_id,
          team_name: team?.name || '',
          player_id: e.player_id,
          player_name: player?.name || '',
          event_type: e.event_type,
          period: e.period,
          points: e.points,
          created_at: e.created_at
        };
      });
      return { rows, rowCount: rows.length };
    }

    // Matches CRUD
    if (/INSERT INTO matches/i.test(s)) {
      const match = {
        id: params[0],
        home_team_id: params[1],
        away_team_id: params[2],
        scheduled_at: params[3],
        venue: params[4] || '',
        round_type: params[5] || 'league',
        status: 'scheduled',
        home_score: 0,
        away_score: 0,
        tie_break_phase: null,
        tie_break_golden_raid_team_id: null,
        tie_break_toss_team_id: null,
        tie_break_toss_decision: null,
        toss_winner_team_id: null,
        toss_decision: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      matches.set(match.id, match);
      return { rows: [match], rowCount: 1 };
    }

    if (/DELETE FROM matches WHERE id=\$1/i.test(s)) {
      const deleted = matches.delete(params[0]);
      return { rows: deleted ? [{ id: params[0] }] : [], rowCount: deleted ? 1 : 0 };
    }

    if (/SELECT status FROM matches WHERE id=\$1/i.test(s) || /SELECT id, status FROM matches WHERE id=\$1/i.test(s) || /SELECT id, status, round_type, tie_break_phase, home_team_id, away_team_id FROM matches WHERE id=\$1/i.test(s) || /SELECT home_team_id, away_team_id, status, round_type, tie_break_phase, toss_winner_team_id, toss_decision, tie_break_golden_raid_team_id FROM matches WHERE id=\$1/i.test(s) || /SELECT status, round_type, tie_break_phase, home_team_id, away_team_id, tie_break_toss_team_id, tie_break_toss_decision FROM matches WHERE id=\$1/i.test(s)) {
      const m = matches.get(params[0]);
      return { rows: m ? [m] : [], rowCount: m ? 1 : 0 };
    }

    if (/UPDATE matches SET home_score=\$1, away_score=\$2/i.test(s)) {
      const m = matches.get(params[2]);
      if (m) {
        m.home_score = Math.max(0, Number(params[0]) || 0);
        m.away_score = Math.max(0, Number(params[1]) || 0);
        m.updated_at = new Date().toISOString();
      }
      return { rows: m ? [m] : [], rowCount: m ? 1 : 0 };
    }

    if (/UPDATE matches SET home_team_id=\$1, away_team_id=\$2, scheduled_at=\$3, venue=\$4, round_type=\$6/i.test(s)) {
      const m = matches.get(params[4]);
      if (!m) return { rows: [], rowCount: 0 };
      m.home_team_id = params[0];
      m.away_team_id = params[1];
      m.scheduled_at = params[2];
      m.venue = params[3];
      m.round_type = params[5];
      m.home_score = 0;
      m.away_score = 0;
      m.updated_at = new Date().toISOString();
      return { rows: [m], rowCount: 1 };
    }

    if (/DELETE FROM match_score_events WHERE match_id=\$1/i.test(s)) {
      let count = 0;
      for (let i = match_score_events.length - 1; i >= 0; i--) {
        if (match_score_events[i].match_id === params[0]) {
          match_score_events.splice(i, 1);
          count++;
        }
      }
      return { rows: [], rowCount: count };
    }

    if (/UPDATE matches SET home_score=\$1, away_score=\$2/i.test(s)) {
      const m = matches.get(params[2]);
      if (m) {
        m.home_score = Number(params[0]);
        m.away_score = Number(params[1]);
        m.updated_at = new Date().toISOString();
        return { rows: [{ id: m.id }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    if (/UPDATE matches SET status=\$1, tie_break_phase=\$2, updated_at=NOW\(\) WHERE id=\$3/i.test(s)) {
      const m = matches.get(params[2]);
      if (m) {
        m.status = params[0];
        m.tie_break_phase = params[1];
        m.updated_at = new Date().toISOString();
      }
      return { rows: [], rowCount: m ? 1 : 0 };
    }

    if (/UPDATE matches SET toss_winner_team_id=\$1, toss_decision=\$2, updated_at=NOW\(\) WHERE id=\$3/i.test(s)) {
      const m = matches.get(params[2]);
      if (m && m.status === 'scheduled') {
        m.toss_winner_team_id = params[0];
        m.toss_decision = params[1];
        m.updated_at = new Date().toISOString();
        return { rows: [{ id: m.id }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    if (/UPDATE matches SET tie_break_toss_team_id=\$1, tie_break_toss_decision=\$2/i.test(s)) {
      const m = matches.get(params[2]);
      if (m && m.status === 'live' && m.tie_break_phase === 'golden_toss') {
        m.tie_break_toss_team_id = params[0];
        m.tie_break_toss_decision = params[1];
        m.tie_break_golden_raid_team_id = params[1] === 'raid'
          ? params[0]
          : params[0] === m.home_team_id ? m.away_team_id : m.home_team_id;
        m.tie_break_phase = 'golden_raid';
        m.updated_at = new Date().toISOString();
        return { rows: [{ id: m.id }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // Match score event insertion
    if (/INSERT INTO match_score_events/i.test(s)) {
      const event = {
        id: params[0],
        match_id: params[1],
        team_id: params[2],
        player_id: params[3] || null,
        event_type: params[4],
        period: params[5] || 'regular',
        points: Number(params[6]),
        created_at: new Date().toISOString()
      };
      match_score_events.push(event);
      return { rows: [event], rowCount: 1 };
    }

    if (/UPDATE matches SET tie_break_phase='completed', status='completed', updated_at=NOW\(\) WHERE id=\$1/i.test(s)) {
      const m = matches.get(params[0]);
      if (m) {
        m.tie_break_phase = 'completed';
        m.status = 'completed';
        m.updated_at = new Date().toISOString();
      }
      return { rows: [], rowCount: m ? 1 : 0 };
    }

    if (/UPDATE matches SET tie_break_phase=\$1, updated_at=NOW\(\) WHERE id=\$2/i.test(s)) {
      const m = matches.get(params[1]);
      if (m) {
        m.tie_break_phase = params[0];
        m.updated_at = new Date().toISOString();
      }
      return { rows: [], rowCount: m ? 1 : 0 };
    }

    if (/UPDATE matches SET updated_at=NOW\(\) WHERE id=\$1/i.test(s)) {
      const m = matches.get(params[0]);
      if (m) m.updated_at = new Date().toISOString();
      return { rows: [], rowCount: m ? 1 : 0 };
    }

    if (/DELETE FROM match_score_events WHERE id=\$1 AND match_id=\$2/i.test(s)) {
      const idx = match_score_events.findIndex((e) => e.id === params[0] && e.match_id === params[1]);
      if (idx !== -1) {
        const [removed] = match_score_events.splice(idx, 1);
        return { rows: [removed], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    if (/DELETE FROM match_score_events WHERE match_id=\$1 AND period IN \('super5', 'golden'\)/i.test(s)) {
      for (let i = match_score_events.length - 1; i >= 0; i--) {
        if (match_score_events[i].match_id === params[0] && (match_score_events[i].period === 'super5' || match_score_events[i].period === 'golden')) {
          match_score_events.splice(i, 1);
        }
      }
      return { rows: [], rowCount: 1 };
    }

    if (/DELETE FROM match_score_events WHERE match_id=\$1 AND period='golden'/i.test(s)) {
      for (let i = match_score_events.length - 1; i >= 0; i--) {
        if (match_score_events[i].match_id === params[0] && match_score_events[i].period === 'golden') {
          match_score_events.splice(i, 1);
        }
      }
      return { rows: [], rowCount: 1 };
    }

    if (/UPDATE matches SET tie_break_toss_team_id=NULL, tie_break_toss_decision=NULL, tie_break_golden_raid_team_id=NULL WHERE id=\$1/i.test(s)) {
      const m = matches.get(params[0]);
      if (m) {
        m.tie_break_toss_team_id = null;
        m.tie_break_toss_decision = null;
        m.tie_break_golden_raid_team_id = null;
      }
      return { rows: [], rowCount: m ? 1 : 0 };
    }

    // Scoring queries
    if (/SELECT team_id, COALESCE\(SUM\(points\), 0\)::int AS points FROM match_score_events WHERE match_id=\$1 AND period='regular' GROUP BY team_id/i.test(s)) {
      const map = new Map();
      for (const e of match_score_events) {
        if (e.match_id === params[0] && e.period === 'regular') {
          map.set(e.team_id, (map.get(e.team_id) || 0) + Number(e.points));
        }
      }
      const rows = [...map.entries()].map(([team_id, points]) => ({ team_id, points }));
      return { rows, rowCount: rows.length };
    }

    if (/SELECT COUNT\(\*\)::int AS raids, COALESCE\(SUM\(points\) FILTER \(WHERE team_id=\$2\), 0\)::int AS home_points, COALESCE\(SUM\(points\) FILTER \(WHERE team_id=\$3\), 0\)::int AS away_points FROM match_score_events WHERE match_id=\$1 AND period='super5'/i.test(s)) {
      let raids = 0;
      let homePoints = 0;
      let awayPoints = 0;
      for (const e of match_score_events) {
        if (e.match_id === params[0] && e.period === 'super5') {
          raids++;
          if (e.team_id === params[1]) homePoints += Number(e.points);
          if (e.team_id === params[2]) awayPoints += Number(e.points);
        }
      }
      return { rows: [{ raids, home_points: homePoints, away_points: awayPoints }], rowCount: 1 };
    }

    if (/SELECT COUNT\(\*\)::int AS raids FROM match_score_events WHERE match_id=\$1 AND period='super5'/i.test(s)) {
      const raids = match_score_events.filter((e) => e.match_id === params[0] && e.period === 'super5').length;
      return { rows: [{ raids }], rowCount: 1 };
    }

    if (/SELECT 1 FROM match_score_events WHERE match_id=\$1 AND period='golden'/i.test(s)) {
      const found = match_score_events.some((e) => e.match_id === params[0] && e.period === 'golden');
      return { rows: found ? [{ 1: 1 }] : [], rowCount: found ? 1 : 0 };
    }

    if (/SELECT COALESCE\(SUM\(points\) FILTER \(WHERE team_id=\$2\), 0\)::int AS home_points, COALESCE\(SUM\(points\) FILTER \(WHERE team_id=\$3\), 0\)::int AS away_points FROM match_score_events WHERE match_id=\$1 AND period='regular'/i.test(s)) {
      let home_points = 0;
      let away_points = 0;
      for (const e of match_score_events) {
        if (e.match_id === params[0] && e.period === 'regular') {
          if (e.team_id === params[1]) home_points += Number(e.points);
          if (e.team_id === params[2]) away_points += Number(e.points);
        }
      }
      return { rows: [{ home_points, away_points }], rowCount: 1 };
    }

    if (/SELECT COUNT\(\*\) FILTER \(WHERE period='super5'\)::int AS raids/i.test(s)) {
      let raids = 0;
      let home_points = 0;
      let away_points = 0;
      let golden_raids = 0;
      for (const e of match_score_events) {
        if (e.match_id === params[0]) {
          if (e.period === 'super5') {
            raids++;
            if (e.team_id === params[1]) home_points += Number(e.points);
            if (e.team_id === params[2]) away_points += Number(e.points);
          } else if (e.period === 'golden') {
            golden_raids++;
          }
        }
      }
      return { rows: [{ raids, home_points, away_points, golden_raids }], rowCount: 1 };
    }

    console.warn('[Mock DB] Unhandled SQL query:', s, params);
    return { rows: [], rowCount: 0 };
  }

  const pool = {
    isMock: true,
    query: executeQuery,
    connect: async () => ({
      query: executeQuery,
      release: () => {}
    })
  };

  return pool;
}

module.exports = { createMockPool };
