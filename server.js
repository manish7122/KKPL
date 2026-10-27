require('dotenv').config();

const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const session = require('express-session');
const connectPgSimple = require('connect-pg-simple');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const requiredEnv = ['DATABASE_URL', 'SESSION_SECRET', 'ADMIN_EMAIL', 'ADMIN_PASSWORD'];
const missingEnv = requiredEnv.filter((name) => !process.env[name]);
if (missingEnv.length) {
  throw new Error(`Missing required .env values: ${missingEnv.join(', ')}. Copy .env.example to .env and fill them in.`);
}

if (process.env.ADMIN_PASSWORD.length < 12) {
  throw new Error('ADMIN_PASSWORD must be at least 12 characters long.');
}
if (process.env.ADMIN_PASSWORD === 'choose-a-strong-password-here') {
  throw new Error('Replace the example ADMIN_PASSWORD in .env with your own password.');
}
if (process.env.SESSION_SECRET.length < 32 || process.env.SESSION_SECRET === 'replace-this-with-a-long-random-secret') {
  throw new Error('Set SESSION_SECRET in .env to a unique random value of at least 32 characters.');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const app = express();
const PgSession = connectPgSimple(session);
const PORT = Number(process.env.PORT) || 3000;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL.trim().toLowerCase();
const adminPasswordHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 12);
const MAX_PLAYER_PHOTO_BYTES = 5 * 1024 * 1024;
const isProduction = process.env.NODE_ENV === 'production' || process.env.npm_lifecycle_event === 'start';
const playerRegistrationAttempts = new Map();

if (isProduction) {
  app.set('trust proxy', 1);
}

const demoTeams = [
  { id: 'T_JAIPUR', name: 'Jaipur Pink Panthers', city: 'Jaipur', coach: 'Ram Mehar Singh', color: '#e91e8c', email: 'jaipur@kkpl.com', password: 'Jaipur@123', budgetLakhs: 400, sponsor: 'Nihar' },
  { id: 'T_PATNA', name: 'Patna Pirates', city: 'Patna', coach: 'Ranbir Singh Sehrawat', color: '#ff6600', email: 'patna@kkpl.com', password: 'Patna@123', budgetLakhs: 400, sponsor: 'Puma' },
  { id: 'T_BENGALURU', name: 'Bengaluru Bulls', city: 'Bengaluru', coach: 'SC Rajan', color: '#ffd600', email: 'bengaluru@kkpl.com', password: 'Bengaluru@123', budgetLakhs: 400, sponsor: 'Bengaluru FC' }
];

const demoPlayers = [
  { id: 'P_ARJUN', name: 'Arjun Kumar', age: 24, nationality: 'India', category: 'Raider', basePrice: 80, prevTeam: 'Patna Pirates', skills: 'Super Raid, Ankle Hold' },
  { id: 'P_SURESH', name: 'Suresh Meena', age: 27, nationality: 'India', category: 'Defender', basePrice: 60, prevTeam: 'Jaipur Pink Panthers', skills: 'Super Tackle' },
  { id: 'P_MOHIT', name: 'Mohit Goyat', age: 22, nationality: 'India', category: 'All-Rounder', basePrice: 100, prevTeam: 'Haryana Steelers', skills: 'Multi-skilled, Strong physique' },
  { id: 'P_FAZAL', name: 'Fazal Atrachali', age: 32, nationality: 'Iran', category: 'Defender', basePrice: 120, prevTeam: 'UP Yoddha', skills: 'Tackle master, Captain' },
  { id: 'P_RAHUL', name: 'Rahul Chaudhari', age: 30, nationality: 'India', category: 'Raider', basePrice: 90, prevTeam: 'Tamil Thalaivas', skills: 'Touch Raider, Experience' },
  { id: 'P_SANDEEP', name: 'Sandeep Narwal', age: 31, nationality: 'India', category: 'All-Rounder', basePrice: 75, prevTeam: 'Puneri Paltan', skills: 'Veteran all-rounder' }
];

app.use(express.json({ limit: '7mb' }));
app.use(session({
  store: new PgSession({ pool, createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 8 * 60 * 60 * 1000
  }
}));

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function auctionBidIncrement(currentBidLakhs) {
  const bidRupees = Math.round(currentBidLakhs * 100000);
  if (bidRupees < 2000) return 50;
  if (bidRupees < 4000) return 100;
  if (bidRupees < 7000) return 200;
  if (bidRupees < 10000) return 300;
  if (bidRupees < 13000) return 400;
  if (bidRupees < 15000) return 450;
  if (bidRupees < 18000) return 500;
  if (bidRupees < 20000) return 550;
  if (bidRupees < 25000) return 600;
  if (bidRupees < 30000) return 700;
  if (bidRupees < 35000) return 800;
  if (bidRupees < 40000) return 900;
  return 1000;
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user || (role && req.session.user.type !== role)) {
      return res.status(401).json({ error: 'Please sign in to continue.' });
    }
    next();
  };
}

function cleanTeam(row) {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    coach: row.coach,
    color: row.color,
    email: row.email,
    budgetLakhs: Number(row.budget_lakhs),
    spentLakhs: Number(row.spent_lakhs),
    sponsor: row.sponsor,
    players: row.players
  };
}

function cleanPlayer(row) {
  return {
    id: row.id,
    name: row.name,
    age: row.age,
    nationality: row.nationality,
    category: row.category,
    playingPosition: row.playing_position,
    auctionTier: row.auction_tier,
    basePrice: Number(row.base_price),
    photoUrl: row.photo_mime ? `/api/players/${encodeURIComponent(row.id)}/photo` : null,
    currentBid: row.current_bid === null ? null : Number(row.current_bid),
    currentTeamId: row.current_team_id || null,
    prevTeam: row.prev_team,
    skills: row.skills,
    status: row.status,
    teamId: row.team_id,
    soldPrice: row.sold_price === null ? null : Number(row.sold_price)
  };
}

async function getAuctionSnapshot() {
  const stateResult = await pool.query(`
    SELECT a.player_id, a.last_result_player_id, a.last_result_status, a.last_result_at,
      p.*, result_player.id AS outcome_player_id, result_player.name AS outcome_player_name,
      result_player.age AS outcome_player_age, result_player.nationality AS outcome_player_nationality,
      result_player.category AS outcome_player_category, result_player.playing_position AS outcome_player_playing_position,
      result_player.auction_tier AS outcome_player_auction_tier,
      result_player.base_price AS outcome_player_base_price, result_player.photo_mime AS outcome_player_photo_mime,
      result_player.current_bid AS outcome_player_current_bid, result_player.current_team_id AS outcome_player_current_team_id,
      result_player.prev_team AS outcome_player_prev_team, result_player.skills AS outcome_player_skills,
      result_player.status AS outcome_player_status, result_player.team_id AS outcome_player_team_id,
      result_player.sold_price AS outcome_player_sold_price, result_team.name AS outcome_team_name
    FROM auction_state a
    LEFT JOIN players p ON p.id = a.player_id
    LEFT JOIN players result_player ON result_player.id = a.last_result_player_id
    LEFT JOIN teams result_team ON result_team.id = result_player.team_id
    WHERE a.id = 1
  `);
  if (!stateResult.rowCount) return { currentAuction: null, lastOutcome: null };

  const row = stateResult.rows[0];
  const outcomePlayer = row.outcome_player_id
    ? cleanPlayer({
        id: row.outcome_player_id,
        name: row.outcome_player_name,
        age: row.outcome_player_age,
        nationality: row.outcome_player_nationality,
        category: row.outcome_player_category,
        playing_position: row.outcome_player_playing_position,
        auction_tier: row.outcome_player_auction_tier,
        base_price: row.outcome_player_base_price,
        photo_mime: row.outcome_player_photo_mime,
        current_bid: row.outcome_player_current_bid,
        current_team_id: row.outcome_player_current_team_id,
        prev_team: row.outcome_player_prev_team,
        skills: row.outcome_player_skills,
        status: row.outcome_player_status,
        team_id: row.outcome_player_team_id,
        sold_price: row.outcome_player_sold_price
      })
    : null;

  return {
    currentAuction: row.id ? cleanPlayer(row) : null,
    lastOutcome: outcomePlayer && row.last_result_status && row.last_result_at
      ? {
          occurredAt: row.last_result_at,
          status: row.last_result_status,
          player: outcomePlayer,
          teamName: row.outcome_team_name
        }
      : null
  };
}

function parsePlayerPhoto(photoData) {
  if (photoData === undefined) return null;
  if (typeof photoData !== 'string') return { error: 'Choose a valid JPG, PNG, or WebP player photo.' };

  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(photoData);
  if (!match) return { error: 'Choose a valid JPG, PNG, or WebP player photo.' };

  const image = Buffer.from(match[2], 'base64');
  if (image.length === 0 || image.length > MAX_PLAYER_PHOTO_BYTES || image.toString('base64') !== match[2]) {
    return { error: 'Player photos must be 5 MB or smaller.' };
  }

  const isJpeg = match[1] === 'image/jpeg' && image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff;
  const isPng = match[1] === 'image/png' && image.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = match[1] === 'image/webp' && image.toString('ascii', 0, 4) === 'RIFF' && image.toString('ascii', 8, 12) === 'WEBP';
  if (!isJpeg && !isPng && !isWebp) return { error: 'The selected file does not match a supported image format.' };

  return { mime: match[1], data: match[2] };
}

async function listTeams(client = pool) {
  const result = await client.query(`
    SELECT t.id, t.name, t.city, t.coach, t.color, t.email, t.budget_lakhs, t.sponsor,
      COALESCE(SUM(p.sold_price) FILTER (WHERE p.status = 'Sold'), 0) AS spent_lakhs,
      COALESCE(array_agg(p.id) FILTER (WHERE p.status = 'Sold'), '{}') AS players
    FROM teams t
    LEFT JOIN players p ON p.team_id = t.id
    GROUP BY t.id
    ORDER BY t.name
  `);
  return result.rows.map(cleanTeam);
}

async function listPlayers(client = pool) {
  const result = await client.query(`
    SELECT id, name, age, nationality, category, playing_position, auction_tier, base_price, photo_mime,
      current_bid, current_team_id, prev_team, skills, status, team_id, sold_price
    FROM players ORDER BY name
  `);
  return result.rows.map(cleanPlayer);
}

async function listMatches(client = pool) {
  const matchesResult = await client.query(`
    SELECT m.id, m.home_team_id, home.name AS home_team_name, home.color AS home_team_color,
      m.away_team_id, away.name AS away_team_name, away.color AS away_team_color,
      m.scheduled_at, m.venue, m.status, m.home_score, m.away_score,
      m.toss_winner_team_id, toss_winner.name AS toss_winner_team_name, m.toss_decision,
      m.round_type, m.tie_break_phase, m.tie_break_golden_raid_team_id,
      m.tie_break_toss_team_id, golden_toss_winner.name AS tie_break_toss_winner_name,
      m.tie_break_toss_decision,
      m.created_at, m.updated_at,
      ROW_NUMBER() OVER (PARTITION BY m.round_type ORDER BY m.scheduled_at, m.id)::int AS round_number
    FROM matches m
    JOIN teams home ON home.id = m.home_team_id
    JOIN teams away ON away.id = m.away_team_id
    LEFT JOIN teams toss_winner ON toss_winner.id = m.toss_winner_team_id
    LEFT JOIN teams golden_toss_winner ON golden_toss_winner.id = m.tie_break_toss_team_id
    ORDER BY CASE WHEN m.status='live' THEN 0 WHEN m.status='scheduled' THEN 1 ELSE 2 END,
      m.scheduled_at ASC
  `);
  const eventsResult = await client.query(`
    SELECT e.id, e.match_id, e.team_id, t.name AS team_name, e.player_id,
      p.name AS player_name, e.event_type, e.period, e.points, e.created_at
    FROM match_score_events e
    JOIN teams t ON t.id = e.team_id
    LEFT JOIN players p ON p.id = e.player_id
    ORDER BY e.created_at, e.id
  `);
  const eventsByMatch = new Map();
  for (const row of eventsResult.rows) {
    const events = eventsByMatch.get(row.match_id) || [];
    events.push({
      id: row.id,
      teamId: row.team_id,
      teamName: row.team_name,
      playerId: row.player_id,
      playerName: row.player_name,
      type: row.event_type,
      period: row.period,
      points: Number(row.points),
      createdAt: row.created_at
    });
    eventsByMatch.set(row.match_id, events);
  }
  return matchesResult.rows.map((row) => {
    const events = eventsByMatch.get(row.id) || [];
    const playerPoints = new Map();
    const extras = {
      home: { allOut: 0, technical: 0, total: 0 },
      away: { allOut: 0, technical: 0, total: 0 }
    };
    const tieBreakScore = {
      home: 0,
      away: 0,
      super5Home: 0,
      super5Away: 0,
      goldenRaid: null
    };
    for (const event of events) {
      const side = event.teamId === row.home_team_id ? 'home' : 'away';
      if (event.period === 'super5') {
        tieBreakScore[side] += event.points;
        tieBreakScore[side === 'home' ? 'super5Home' : 'super5Away'] += event.points;
      } else if (event.period === 'golden' && event.type === 'raid') {
        tieBreakScore.goldenRaid = event;
      }
      if (['all_out', 'technical'].includes(event.type)) {
        extras[side][event.type === 'all_out' ? 'allOut' : 'technical'] += event.points;
        extras[side].total += event.points;
      } else if (event.playerId) {
        const player = playerPoints.get(event.playerId) || {
          playerId: event.playerId,
          playerName: event.playerName,
          teamId: event.teamId,
          teamName: event.teamName,
          raidPoints: 0,
          tacklePoints: 0,
          bonusPoints: 0,
          otherPoints: 0,
          total: 0
        };
        const pointKey = {
          raid: 'raidPoints',
          tackle: 'tacklePoints',
          bonus: 'bonusPoints',
          legacy: 'otherPoints'
        }[event.type];
        if (pointKey) player[pointKey] += event.points;
        player.total += event.points;
        playerPoints.set(event.playerId, player);
      }
    }
    const teamPoints = (teamId) => [...playerPoints.values()]
      .filter((player) => player.teamId === teamId)
      .reduce((total, player) => total + player.total, 0);
    const raidCount = events.filter((event) => event.period === 'super5').length;
    const firstTieBreakTeam = row.toss_winner_team_id
      ? row.toss_decision === 'raid'
        ? row.toss_winner_team_id
        : row.toss_winner_team_id === row.home_team_id ? row.away_team_id : row.home_team_id
      : row.home_team_id;
    return {
      id: row.id,
      homeTeam: { id: row.home_team_id, name: row.home_team_name, color: row.home_team_color },
      awayTeam: { id: row.away_team_id, name: row.away_team_name, color: row.away_team_color },
      scheduledAt: row.scheduled_at,
      venue: row.venue,
      status: row.status,
      homeScore: teamPoints(row.home_team_id) + extras.home.total,
      awayScore: teamPoints(row.away_team_id) + extras.away.total,
      toss: row.toss_winner_team_id ? {
        winnerTeamId: row.toss_winner_team_id,
        winnerTeamName: row.toss_winner_team_name,
        decision: row.toss_decision
      } : null,
      roundType: row.round_type,
      roundNumber: row.round_number,
      tieBreak: {
        phase: row.tie_break_phase,
        homeScore: tieBreakScore.home,
        awayScore: tieBreakScore.away,
        raids: events.filter((event) => event.period === 'super5').length,
        expectedTeamId: row.tie_break_phase === 'super5' && raidCount < 10
          ? raidCount % 2 === 0
            ? firstTieBreakTeam
            : firstTieBreakTeam === row.home_team_id ? row.away_team_id : row.home_team_id
          : null,
        goldenRaidTeamId: row.tie_break_golden_raid_team_id,
        goldenRaid: tieBreakScore.goldenRaid,
        toss: row.tie_break_toss_team_id ? {
          winnerTeamId: row.tie_break_toss_team_id,
          winnerTeamName: row.tie_break_toss_winner_name,
          decision: row.tie_break_toss_decision
        } : null,
        winnerTeamId: tieBreakScore.goldenRaid
          ? tieBreakScore.goldenRaid.points > 0
            ? row.tie_break_golden_raid_team_id
            : row.tie_break_golden_raid_team_id === row.home_team_id ? row.away_team_id : row.home_team_id
          : null
      },
      extras,
      playerPoints: [...playerPoints.values()].sort((a, b) => a.playerName.localeCompare(b.playerName)),
      events,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  });
}

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      coach TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT '#ff6600',
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      budget_lakhs NUMERIC(12, 2) NOT NULL CHECK (budget_lakhs > 0),
      sponsor TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      age INTEGER NOT NULL CHECK (age BETWEEN 16 AND 45),
      nationality TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL CHECK (category IN ('Raider', 'Defender', 'All-Rounder')),
      playing_position TEXT CHECK (playing_position IS NULL OR playing_position IN ('Right Side', 'Left Side', 'Right Corner', 'Left Corner', 'Right Cover', 'Left Cover')),
      auction_tier TEXT NOT NULL DEFAULT 'B' CHECK (auction_tier IN ('A', 'B', 'C')),
      base_price NUMERIC(15, 5) NOT NULL CHECK (base_price > 0),
      current_bid NUMERIC(15, 5),
      current_team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
      photo_mime TEXT,
      photo_data TEXT,
      prev_team TEXT NOT NULL DEFAULT '',
      skills TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Available' CHECK (status IN ('Available', 'Sold', 'Unsold')),
      team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
      sold_price NUMERIC(15, 5),
      CHECK ((status = 'Sold' AND team_id IS NOT NULL AND sold_price IS NOT NULL) OR status <> 'Sold')
    )
  `);
  await pool.query('ALTER TABLE players ALTER COLUMN base_price TYPE NUMERIC(15, 5)');
  await pool.query('ALTER TABLE players ALTER COLUMN sold_price TYPE NUMERIC(15, 5)');
  await pool.query('ALTER TABLE players ADD COLUMN IF NOT EXISTS photo_mime TEXT');
  await pool.query('ALTER TABLE players ADD COLUMN IF NOT EXISTS photo_data TEXT');
  await pool.query("ALTER TABLE players ADD COLUMN IF NOT EXISTS playing_position TEXT CHECK (playing_position IS NULL OR playing_position IN ('Right Side', 'Left Side', 'Right Corner', 'Left Corner', 'Right Cover', 'Left Cover'))");
  await pool.query('ALTER TABLE players ADD COLUMN IF NOT EXISTS current_bid NUMERIC(15, 5)');
  await pool.query('ALTER TABLE players ADD COLUMN IF NOT EXISTS current_team_id TEXT REFERENCES teams(id) ON DELETE SET NULL');
  await pool.query("ALTER TABLE players ADD COLUMN IF NOT EXISTS auction_tier TEXT NOT NULL DEFAULT 'B' CHECK (auction_tier IN ('A', 'B', 'C'))");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auction_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      player_id TEXT REFERENCES players(id) ON DELETE SET NULL,
      last_result_player_id TEXT REFERENCES players(id) ON DELETE SET NULL,
      last_result_status TEXT CHECK (last_result_status IN ('Sold', 'Unsold')),
      last_result_at TIMESTAMPTZ
    )
  `);
  await pool.query('ALTER TABLE auction_state ADD COLUMN IF NOT EXISTS last_result_player_id TEXT REFERENCES players(id) ON DELETE SET NULL');
  await pool.query("ALTER TABLE auction_state ADD COLUMN IF NOT EXISTS last_result_status TEXT CHECK (last_result_status IN ('Sold', 'Unsold'))");
  await pool.query('ALTER TABLE auction_state ADD COLUMN IF NOT EXISTS last_result_at TIMESTAMPTZ');
  await pool.query('INSERT INTO auction_state (id, player_id) VALUES (1, NULL) ON CONFLICT (id) DO NOTHING');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auction_bid_history (
      id BIGSERIAL PRIMARY KEY,
      player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      bid_amount NUMERIC(15, 5) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      home_team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      away_team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      scheduled_at TIMESTAMPTZ NOT NULL,
      venue TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'completed', 'cancelled')),
      round_type TEXT NOT NULL DEFAULT 'league' CHECK (round_type IN ('league', 'quarterfinal', 'semifinal', 'final')),
      home_score INTEGER NOT NULL DEFAULT 0 CHECK (home_score >= 0),
      away_score INTEGER NOT NULL DEFAULT 0 CHECK (away_score >= 0),
      tie_break_phase TEXT CHECK (tie_break_phase IN ('super5', 'golden_toss', 'golden_raid', 'completed')),
      tie_break_golden_raid_team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
      tie_break_toss_team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
      tie_break_toss_decision TEXT CHECK (tie_break_toss_decision IN ('raid', 'defend')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (home_team_id <> away_team_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS match_player_points (
      match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
      PRIMARY KEY (match_id, player_id)
    )
  `);
  await pool.query('ALTER TABLE matches ADD COLUMN IF NOT EXISTS toss_winner_team_id TEXT REFERENCES teams(id) ON DELETE SET NULL');
  await pool.query("ALTER TABLE matches ADD COLUMN IF NOT EXISTS toss_decision TEXT CHECK (toss_decision IN ('raid', 'court_side'))");
  await pool.query("ALTER TABLE matches ADD COLUMN IF NOT EXISTS round_type TEXT NOT NULL DEFAULT 'league' CHECK (round_type IN ('league', 'quarterfinal', 'semifinal', 'final'))");
  await pool.query("ALTER TABLE matches ADD COLUMN IF NOT EXISTS tie_break_phase TEXT CHECK (tie_break_phase IN ('super5', 'golden_toss', 'golden_raid', 'completed'))");
  await pool.query('ALTER TABLE matches ADD COLUMN IF NOT EXISTS tie_break_golden_raid_team_id TEXT REFERENCES teams(id) ON DELETE SET NULL');
  await pool.query('ALTER TABLE matches ADD COLUMN IF NOT EXISTS tie_break_toss_team_id TEXT REFERENCES teams(id) ON DELETE SET NULL');
  await pool.query("ALTER TABLE matches ADD COLUMN IF NOT EXISTS tie_break_toss_decision TEXT CHECK (tie_break_toss_decision IN ('raid', 'defend'))");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS match_score_events (
      id TEXT PRIMARY KEY,
      match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      player_id TEXT REFERENCES players(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL CHECK (event_type IN ('raid', 'tackle', 'bonus', 'all_out', 'technical', 'legacy')),
      period TEXT NOT NULL DEFAULT 'regular' CHECK (period IN ('regular', 'super5', 'golden')),
      points INTEGER NOT NULL CHECK (points >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (
        (event_type IN ('raid', 'tackle', 'bonus', 'legacy') AND player_id IS NOT NULL)
        OR (event_type IN ('all_out', 'technical') AND player_id IS NULL)
      )
    )
  `);
  await pool.query("ALTER TABLE match_score_events ADD COLUMN IF NOT EXISTS period TEXT NOT NULL DEFAULT 'regular'");
  const constraintClient = await pool.connect();
  try {
    await constraintClient.query('BEGIN');
    await constraintClient.query('SELECT pg_advisory_xact_lock($1)', [746210091]);
    await constraintClient.query('ALTER TABLE match_score_events DROP CONSTRAINT IF EXISTS match_score_events_points_check');
    await constraintClient.query('ALTER TABLE match_score_events ADD CONSTRAINT match_score_events_points_check CHECK (points >= 0)');
    await constraintClient.query('COMMIT');
  } catch (error) {
    await constraintClient.query('ROLLBACK');
    throw error;
  } finally {
    constraintClient.release();
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS match_score_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS match_score_events_match_created_idx ON match_score_events (match_id, created_at)');
  const migrationClient = await pool.connect();
  try {
    await migrationClient.query('BEGIN');
    const migration = await migrationClient.query(
      'INSERT INTO match_score_migrations (version) VALUES (1) ON CONFLICT DO NOTHING RETURNING version'
    );
    if (migration.rowCount) {
      const oldScores = await migrationClient.query(
        'SELECT id, home_team_id, away_team_id, home_score, away_score FROM matches WHERE home_score > 0 OR away_score > 0'
      );
      for (const match of oldScores.rows) {
        if (Number(match.home_score) > 0) {
          await migrationClient.query(
            `INSERT INTO match_score_events (id, match_id, team_id, event_type, points)
             VALUES ($1, $2, $3, 'technical', $4)`,
            [`MIG_${crypto.randomUUID()}`, match.id, match.home_team_id, Number(match.home_score)]
          );
        }
        if (Number(match.away_score) > 0) {
          await migrationClient.query(
            `INSERT INTO match_score_events (id, match_id, team_id, event_type, points)
             VALUES ($1, $2, $3, 'technical', $4)`,
            [`MIG_${crypto.randomUUID()}`, match.id, match.away_team_id, Number(match.away_score)]
          );
        }
      }
      const oldPlayerPoints = await migrationClient.query(
        'SELECT match_id, player_id, team_id, points FROM match_player_points WHERE points > 0'
      );
      for (const player of oldPlayerPoints.rows) {
        await migrationClient.query(
          `INSERT INTO match_score_events (id, match_id, team_id, player_id, event_type, points)
           VALUES ($1, $2, $3, $4, 'legacy', $5)`,
          [`MIG_${crypto.randomUUID()}`, player.match_id, player.team_id, player.player_id, Number(player.points)]
        );
      }
    }
    await migrationClient.query('COMMIT');
  } catch (error) {
    await migrationClient.query('ROLLBACK');
    throw error;
  } finally {
    migrationClient.release();
  }
  await pool.query(`
    INSERT INTO auction_bid_history (player_id, team_id, bid_amount)
    SELECT p.id, p.current_team_id, p.current_bid
    FROM players p
    WHERE p.current_bid IS NOT NULL AND p.current_team_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM auction_bid_history h
        WHERE h.player_id = p.id
      )
  `);

  const seedClient = await pool.connect();
  try {
    await seedClient.query('BEGIN');
    await seedClient.query('SELECT pg_advisory_xact_lock($1)', [746210092]);
    const count = await seedClient.query('SELECT COUNT(*)::int AS total FROM teams');
    if (!isProduction && count.rows[0].total === 0) {
      for (const team of demoTeams) {
        const passwordHash = await bcrypt.hash(team.password, 12);
        await seedClient.query(
          `INSERT INTO teams (id, name, city, coach, color, email, password_hash, budget_lakhs, sponsor)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [team.id, team.name, team.city, team.coach, team.color, team.email, passwordHash, team.budgetLakhs, team.sponsor]
        );
      }
      for (const player of demoPlayers) {
        await seedClient.query(
          `INSERT INTO players (id, name, age, nationality, category, base_price, prev_team, skills)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [player.id, player.name, player.age, player.nationality, player.category, player.basePrice, player.prevTeam, player.skills]
        );
      }
    }
    await seedClient.query('COMMIT');
  } catch (error) {
    await seedClient.query('ROLLBACK');
    throw error;
  } finally {
    seedClient.release();
  }
}

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const { email, password, type } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || !['admin', 'team'].includes(type)) {
    return res.status(400).json({ error: 'Enter a valid email and password.' });
  }

  let user;
  if (type === 'admin') {
    if (email.trim().toLowerCase() === ADMIN_EMAIL && await bcrypt.compare(password, adminPasswordHash)) {
      user = { type: 'admin', email: ADMIN_EMAIL };
    }
  } else {
    const result = await pool.query('SELECT id, email, password_hash FROM teams WHERE email = $1', [email.trim().toLowerCase()]);
    if (result.rowCount && await bcrypt.compare(password, result.rows[0].password_hash)) {
      user = { type: 'team', teamId: result.rows[0].id };
    }
  }

  if (!user) return res.status(401).json({ error: 'Invalid email or password.' });
  req.session.regenerate((error) => {
    if (error) return res.status(500).json({ error: 'Could not start a secure session.' });
    req.session.user = user;
    req.session.save((saveError) => {
      if (saveError) return res.status(500).json({ error: 'Could not save the sign-in session.' });
      res.json({ user });
    });
  });
}));

app.get('/api/auth/session', (req, res) => {
  res.json({ user: req.session.user || null });
});

app.post('/api/auth/logout', (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('connect.sid');
    res.status(204).end();
  });
});

app.get('/api/teams', requireRole('admin'), asyncRoute(async (req, res) => {
  res.json(await listTeams());
}));

app.post('/api/teams', requireRole('admin'), asyncRoute(async (req, res) => {
  const { name, city, coach = '', color = '#ff6600', email, password, budgetLakhs, sponsor = '' } = req.body || {};
  if (![name, city, email, password].every((value) => typeof value === 'string' && value.trim()) || password.length < 8 ||
      !Number.isFinite(Number(budgetLakhs)) || Number(budgetLakhs) <= 0) {
    return res.status(400).json({ error: 'Provide a team name, city, email, password, and positive budget.' });
  }
  const id = `T_${crypto.randomUUID()}`;
  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO teams (id, name, city, coach, color, email, password_hash, budget_lakhs, sponsor)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [id, name.trim(), city.trim(), coach.trim(), color, email.trim().toLowerCase(), hash, Number(budgetLakhs), sponsor.trim()]
  );
  res.status(201).json((await listTeams()).find((team) => team.id === id));
}));

app.put('/api/teams/:id', requireRole('admin'), asyncRoute(async (req, res) => {
  const { name, city, coach = '', color = '#ff6600', email, password, budgetLakhs, sponsor = '' } = req.body || {};
  if (![name, city, email].every((value) => typeof value === 'string' && value.trim()) ||
      !Number.isFinite(Number(budgetLakhs)) || Number(budgetLakhs) <= 0) {
    return res.status(400).json({ error: 'Provide a team name, city, email, and positive budget.' });
  }
  if (typeof password === 'string' && password.length > 0 && password.length < 8) {
    return res.status(400).json({ error: 'Team passwords must be at least 8 characters long.' });
  }
  const args = [name.trim(), city.trim(), coach.trim(), color, email.trim().toLowerCase(), Number(budgetLakhs), sponsor.trim(), req.params.id];
  let result;
  if (typeof password === 'string' && password.length) {
    const hash = await bcrypt.hash(password, 12);
    result = await pool.query(
      `UPDATE teams SET name=$1, city=$2, coach=$3, color=$4, email=$5, budget_lakhs=$6, sponsor=$7, password_hash=$8 WHERE id=$9`,
      [...args.slice(0, 7), hash, args[7]]
    );
  } else {
    result = await pool.query(
      `UPDATE teams SET name=$1, city=$2, coach=$3, color=$4, email=$5, budget_lakhs=$6, sponsor=$7 WHERE id=$8`,
      args
    );
  }
  if (!result.rowCount) return res.status(404).json({ error: 'Team not found.' });
  res.json((await listTeams()).find((team) => team.id === req.params.id));
}));

app.delete('/api/teams/:id', requireRole('admin'), asyncRoute(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const exists = await client.query('SELECT id FROM teams WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!exists.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Team not found.' });
    }
    await client.query(
      `UPDATE players SET status='Available', team_id=NULL, sold_price=NULL WHERE team_id=$1`,
      [req.params.id]
    );
    await client.query(
      'UPDATE players SET current_bid=NULL, current_team_id=NULL WHERE current_team_id=$1',
      [req.params.id]
    );
    await client.query('DELETE FROM auction_bid_history WHERE team_id=$1', [req.params.id]);
    await client.query('DELETE FROM teams WHERE id=$1', [req.params.id]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  res.status(204).end();
}));

app.get('/api/players', requireRole(), asyncRoute(async (req, res) => {
  const result = await pool.query(`
    SELECT id, name, age, nationality, category, playing_position, auction_tier, base_price, photo_mime,
      current_bid, current_team_id, prev_team, skills, status, team_id, sold_price
    FROM players ORDER BY name
  `);
  res.json(result.rows.map(cleanPlayer));
}));

app.get('/api/auction/state', requireRole(), asyncRoute(async (req, res) => {
  res.json(await getAuctionSnapshot());
}));

app.put('/api/auction/state', requireRole('admin'), asyncRoute(async (req, res) => {
  const { playerId } = req.body || {};
  if (playerId !== null && typeof playerId !== 'string') {
    return res.status(400).json({ error: 'Select a valid player for the auction.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const stateResult = await client.query('SELECT player_id FROM auction_state WHERE id=1 FOR UPDATE');
    if (!stateResult.rowCount) throw new Error('Auction state is not initialized.');
    if (stateResult.rows[0].player_id && stateResult.rows[0].player_id !== playerId) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Finish the current player auction before selecting another player.' });
    }
    if (playerId) {
      const playerResult = await client.query('SELECT status FROM players WHERE id=$1 FOR UPDATE', [playerId]);
      if (!playerResult.rowCount) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Player not found.' });
      }
      if (playerResult.rows[0].status === 'Unsold') {
        const availableResult = await client.query(
          `SELECT COUNT(*)::int AS total FROM players WHERE status='Available' AND id<>$1`,
          [playerId]
        );
        if (availableResult.rows[0].total > 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Re-auction unsold players after all available players have been sold.' });
        }
        await client.query(
          `UPDATE players SET status='Available', current_bid=NULL, current_team_id=NULL WHERE id=$1`,
          [playerId]
        );
        await client.query('DELETE FROM auction_bid_history WHERE player_id=$1', [playerId]);
      } else if (playerResult.rows[0].status !== 'Available') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Sold players cannot be auctioned again.' });
      }
    }
    await client.query('UPDATE auction_state SET player_id=$1 WHERE id=1', [playerId]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  res.json({ success: true });
}));

app.get('/api/players/:id/photo', requireRole(), asyncRoute(async (req, res) => {
  const result = await pool.query('SELECT photo_mime, photo_data FROM players WHERE id=$1', [req.params.id]);
  if (!result.rowCount || !result.rows[0].photo_mime || !result.rows[0].photo_data) {
    return res.status(404).end();
  }
  res.set({
    'Content-Type': result.rows[0].photo_mime,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.send(Buffer.from(result.rows[0].photo_data, 'base64'));
}));

app.post('/api/players', requireRole('admin'), asyncRoute(async (req, res) => {
  const { name, age, nationality = '', category, playingPosition = null, auctionTier, basePrice, prevTeam = '', skills = '', photoData } = req.body || {};
  const photo = parsePlayerPhoto(photoData);
  if (photo && photo.error) return res.status(400).json({ error: photo.error });
  const validPositions = category === 'Raider'
    ? ['Right Side', 'Left Side']
    : category === 'Defender'
      ? ['Right Corner', 'Left Corner', 'Right Cover', 'Left Cover']
      : [];
  if (typeof name !== 'string' || !name.trim() || !['Raider', 'Defender', 'All-Rounder'].includes(category) ||
      (playingPosition !== null && !validPositions.includes(playingPosition)) ||
      !['A', 'B', 'C'].includes(auctionTier) ||
      !Number.isInteger(Number(age)) || Number(age) < 16 || Number(age) > 45 ||
      !Number.isFinite(Number(basePrice)) || Number(basePrice) <= 0) {
    return res.status(400).json({ error: 'Check the player name, age (16–45), playing role, auction tier (A, B, or C), and positive base price.' });
  }
  const id = `P_${crypto.randomUUID()}`;
  await pool.query(
    `INSERT INTO players (id, name, age, nationality, category, playing_position, auction_tier, base_price, photo_mime, photo_data, prev_team, skills)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [id, name.trim(), Number(age), nationality.trim(), category, playingPosition, auctionTier, Number(basePrice), photo?.mime || null, photo?.data || null, prevTeam.trim(), skills.trim()]
  );
  res.status(201).json((await listPlayers()).find((player) => player.id === id));
}));

app.put('/api/players/:id', requireRole('admin'), asyncRoute(async (req, res) => {
  const { name, age, nationality = '', category, playingPosition = null, auctionTier, basePrice, prevTeam = '', skills = '', photoData } = req.body || {};
  const photo = parsePlayerPhoto(photoData);
  if (photo && photo.error) return res.status(400).json({ error: photo.error });
  const validPositions = category === 'Raider'
    ? ['Right Side', 'Left Side']
    : category === 'Defender'
      ? ['Right Corner', 'Left Corner', 'Right Cover', 'Left Cover']
      : [];
  if (typeof name !== 'string' || !name.trim() || !['Raider', 'Defender', 'All-Rounder'].includes(category) ||
      (playingPosition !== null && !validPositions.includes(playingPosition)) ||
      !['A', 'B', 'C'].includes(auctionTier) ||
      !Number.isInteger(Number(age)) || Number(age) < 16 || Number(age) > 45 ||
      !Number.isFinite(Number(basePrice)) || Number(basePrice) <= 0) {
    return res.status(400).json({ error: 'Check the player name, age (16–45), playing role, auction tier (A, B, or C), and positive base price.' });
  }
  const result = await pool.query(
    `UPDATE players SET name=$1, age=$2, nationality=$3, category=$4, playing_position=$5, auction_tier=$6, base_price=$7,
      photo_mime=CASE WHEN $8::boolean THEN $9 ELSE photo_mime END,
      photo_data=CASE WHEN $8::boolean THEN $10 ELSE photo_data END,
      prev_team=$11, skills=$12 WHERE id=$13`,
    [name.trim(), Number(age), nationality.trim(), category, playingPosition, auctionTier, Number(basePrice), Boolean(photo), photo?.mime || null, photo?.data || null, prevTeam.trim(), skills.trim(), req.params.id]
  );
  if (!result.rowCount) return res.status(404).json({ error: 'Player not found.' });
  res.json((await listPlayers()).find((player) => player.id === req.params.id));
}));

app.delete('/api/players/:id', requireRole('admin'), asyncRoute(async (req, res) => {
  const result = await pool.query('DELETE FROM players WHERE id = $1', [req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: 'Player not found.' });
  res.status(204).end();
}));

app.post('/api/player-registration', asyncRoute(async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const attempt = playerRegistrationAttempts.get(ip);
  if (attempt && now - attempt.startedAt < 10 * 60 * 1000 && attempt.count >= 5) {
    return res.status(429).json({ error: 'Too many registration attempts. Please try again in a few minutes.' });
  }
  if (!attempt || now - attempt.startedAt >= 10 * 60 * 1000) {
    playerRegistrationAttempts.set(ip, { startedAt: now, count: 1 });
  } else {
    attempt.count += 1;
  }

  const { name, age, nationality = '', category, prevTeam = '', skills = '', website = '', photoData } = req.body || {};
  if (typeof website !== 'string' || website.trim()) {
    return res.status(400).json({ error: 'The registration could not be accepted.' });
  }
  const photo = parsePlayerPhoto(photoData);
  if (!photo || photo.error) {
    return res.status(400).json({ error: photo?.error || 'A player photo is required.' });
  }
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100 ||
      !['Raider', 'Defender', 'All-Rounder'].includes(category) ||
      !Number.isInteger(Number(age)) || Number(age) < 16 || Number(age) > 45 ||
      typeof nationality !== 'string' || nationality.trim().length > 80 ||
      typeof prevTeam !== 'string' || prevTeam.trim().length > 120 ||
      typeof skills !== 'string' || skills.trim().length > 500) {
    return res.status(400).json({ error: 'Please check your name, age, playing role, and field lengths.' });
  }

  const id = `P_${crypto.randomUUID()}`;
  await pool.query(
    `INSERT INTO players (id, name, age, nationality, category, auction_tier, base_price, photo_mime, photo_data, prev_team, skills)
     VALUES ($1, $2, $3, $4, $5, 'B', 0.01, $6, $7, $8, $9)`,
    [id, name.trim(), Number(age), nationality.trim(), category, photo.mime, photo.data, prevTeam.trim(), skills.trim()]
  );
  res.status(201).json({ success: true, message: 'Registration submitted successfully.' });
}));

app.post('/api/auction/bid', requireRole('admin'), asyncRoute(async (req, res) => {
  const { playerId, teamId, incrementRupees } = req.body || {};
  const increment = Number(incrementRupees);
  if (typeof playerId !== 'string' || typeof teamId !== 'string' ||
      !Number.isSafeInteger(increment) || increment < 1 || increment > 100000000) {
    return res.status(400).json({ error: 'Select a team and enter a valid positive rupee increment.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const stateResult = await client.query('SELECT player_id FROM auction_state WHERE id=1 FOR UPDATE');
    if (!stateResult.rowCount || stateResult.rows[0].player_id !== playerId) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This player is no longer on the live auction block. Refresh and try again.' });
    }
    const playerResult = await client.query('SELECT * FROM players WHERE id=$1 FOR UPDATE', [playerId]);
    const teamResult = await client.query('SELECT * FROM teams WHERE id=$1 FOR UPDATE', [teamId]);
    if (!playerResult.rowCount || !teamResult.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Player or team not found.' });
    }
    const player = playerResult.rows[0];
    const team = teamResult.rows[0];
    if (player.status !== 'Available') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This player is no longer available for bidding.' });
    }
    const spentResult = await client.query(
      `SELECT COALESCE(SUM(sold_price), 0) AS spent FROM players WHERE team_id=$1 AND status='Sold'`,
      [teamId]
    );
    const spent = Number(spentResult.rows[0].spent);
    const currentBid = player.current_bid === null ? Number(player.base_price) : Number(player.current_bid);
    const expectedIncrement = auctionBidIncrement(currentBid);
    if (increment !== expectedIncrement) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'The bid increment changed. Refresh the auction and try again.' });
    }
    const nextBid = currentBid + increment / 100000;
    if (nextBid > Number(team.budget_lakhs) - spent) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `${team.name} does not have enough budget for this bid.` });
    }
    await client.query(
      'UPDATE players SET current_bid=$1, current_team_id=$2 WHERE id=$3',
      [nextBid, teamId, playerId]
    );
    await client.query(
      'INSERT INTO auction_bid_history (player_id, team_id, bid_amount) VALUES ($1, $2, $3)',
      [playerId, teamId, nextBid]
    );
    await client.query('COMMIT');
    res.json({ success: true, currentBid: nextBid, currentTeamId: teamId });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

app.post('/api/auction/undo-bid', requireRole('admin'), asyncRoute(async (req, res) => {
  const { playerId } = req.body || {};
  if (typeof playerId !== 'string') return res.status(400).json({ error: 'Select a player.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const stateResult = await client.query('SELECT player_id FROM auction_state WHERE id=1 FOR UPDATE');
    if (!stateResult.rowCount || stateResult.rows[0].player_id !== playerId) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This player is no longer on the live auction block.' });
    }
    const playerResult = await client.query('SELECT status FROM players WHERE id=$1 FOR UPDATE', [playerId]);
    if (!playerResult.rowCount || playerResult.rows[0].status !== 'Available') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Only an active auction bid can be undone.' });
    }
    const latestResult = await client.query(
      'SELECT id FROM auction_bid_history WHERE player_id=$1 ORDER BY id DESC LIMIT 1 FOR UPDATE',
      [playerId]
    );
    if (!latestResult.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'There are no bids to undo.' });
    }
    await client.query('DELETE FROM auction_bid_history WHERE id=$1', [latestResult.rows[0].id]);
    const previousResult = await client.query(
      'SELECT bid_amount, team_id FROM auction_bid_history WHERE player_id=$1 ORDER BY id DESC LIMIT 1',
      [playerId]
    );
    const previous = previousResult.rows[0] || null;
    await client.query(
      'UPDATE players SET current_bid=$1, current_team_id=$2 WHERE id=$3',
      [previous ? previous.bid_amount : null, previous ? previous.team_id : null, playerId]
    );
    await client.query('COMMIT');
    res.json({
      success: true,
      currentBid: previous ? Number(previous.bid_amount) : null,
      currentTeamId: previous ? previous.team_id : null
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

app.post('/api/auction/restart-bidding', requireRole('admin'), asyncRoute(async (req, res) => {
  const { playerId } = req.body || {};
  if (typeof playerId !== 'string') return res.status(400).json({ error: 'Select a player.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const stateResult = await client.query('SELECT player_id FROM auction_state WHERE id=1 FOR UPDATE');
    if (!stateResult.rowCount || stateResult.rows[0].player_id !== playerId) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This player is no longer on the live auction block.' });
    }
    const playerResult = await client.query('SELECT status FROM players WHERE id=$1 FOR UPDATE', [playerId]);
    if (!playerResult.rowCount || playerResult.rows[0].status !== 'Available') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Only an active auction can be restarted.' });
    }
    await client.query('DELETE FROM auction_bid_history WHERE player_id=$1', [playerId]);
    await client.query(
      'UPDATE players SET current_bid=NULL, current_team_id=NULL WHERE id=$1',
      [playerId]
    );
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

app.post('/api/auction/cancel', requireRole('admin'), asyncRoute(async (req, res) => {
  const { playerId } = req.body || {};
  if (typeof playerId !== 'string') return res.status(400).json({ error: 'Select a player.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const stateResult = await client.query('SELECT player_id FROM auction_state WHERE id=1 FOR UPDATE');
    if (!stateResult.rowCount || stateResult.rows[0].player_id !== playerId) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This player is no longer on the live auction block.' });
    }
    const playerResult = await client.query('SELECT status FROM players WHERE id=$1 FOR UPDATE', [playerId]);
    if (!playerResult.rowCount || playerResult.rows[0].status !== 'Available') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Only the active auction player can be returned to Available.' });
    }
    await client.query('DELETE FROM auction_bid_history WHERE player_id=$1', [playerId]);
    await client.query(
      'UPDATE players SET status=\'Available\', team_id=NULL, sold_price=NULL, current_bid=NULL, current_team_id=NULL WHERE id=$1',
      [playerId]
    );
    await client.query('UPDATE auction_state SET player_id=NULL WHERE id=1 AND player_id=$1', [playerId]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

app.post('/api/auction/sell', requireRole('admin'), asyncRoute(async (req, res) => {
  const { playerId } = req.body || {};
  if (typeof playerId !== 'string') return res.status(400).json({ error: 'Select a player.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const stateResult = await client.query('SELECT player_id FROM auction_state WHERE id=1 FOR UPDATE');
    if (!stateResult.rowCount || stateResult.rows[0].player_id !== playerId) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This player is no longer on the live auction block.' });
    }
    const playerResult = await client.query('SELECT * FROM players WHERE id=$1 FOR UPDATE', [playerId]);
    if (!playerResult.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Player not found.' });
    }
    const player = playerResult.rows[0];
    if (player.status !== 'Available' || !player.current_team_id || player.current_bid === null) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'A team must place a bid before the player can be sold.' });
    }
    const teamId = player.current_team_id;
    const amount = Number(player.current_bid);
    const teamResult = await client.query('SELECT * FROM teams WHERE id=$1 FOR UPDATE', [teamId]);
    if (!teamResult.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'The leading team no longer exists.' });
    }
    const team = teamResult.rows[0];
    const spentResult = await client.query(
      `SELECT COALESCE(SUM(sold_price), 0) AS spent FROM players WHERE team_id=$1 AND status='Sold'`,
      [teamId]
    );
    if (amount > Number(team.budget_lakhs) - Number(spentResult.rows[0].spent)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `${team.name} does not have enough budget remaining.` });
    }
    await client.query(
      `UPDATE players SET status='Sold', team_id=$1, sold_price=$2 WHERE id=$3`,
      [teamId, amount, playerId]
    );
    await client.query(
      `UPDATE auction_state SET player_id=NULL, last_result_player_id=$1, last_result_status='Sold',
        last_result_at=NOW() WHERE id=1 AND player_id=$1`,
      [playerId]
    );
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

app.post('/api/auction/unsold', requireRole('admin'), asyncRoute(async (req, res) => {
  const { playerId } = req.body || {};
  if (typeof playerId !== 'string') return res.status(400).json({ error: 'Select a player.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const stateResult = await client.query('SELECT player_id FROM auction_state WHERE id=1 FOR UPDATE');
    if (!stateResult.rowCount || stateResult.rows[0].player_id !== playerId) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This player is no longer on the live auction block.' });
    }
    const result = await client.query(
      `UPDATE players SET status='Unsold', team_id=NULL, sold_price=NULL, current_bid=NULL, current_team_id=NULL
       WHERE id=$1 AND status='Available' RETURNING id`,
      [playerId]
    );
    if (!result.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Only an active auction player can be marked unsold.' });
    }
    await client.query(
      `UPDATE auction_state SET player_id=NULL, last_result_player_id=$1, last_result_status='Unsold',
        last_result_at=NOW() WHERE id=1 AND player_id=$1`,
      [playerId]
    );
    await client.query('DELETE FROM auction_bid_history WHERE player_id=$1', [playerId]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  res.json({ success: true });
}));

app.get('/api/matches', requireRole('admin'), asyncRoute(async (req, res) => {
  res.json(await listMatches());
}));

app.post('/api/matches', requireRole('admin'), asyncRoute(async (req, res) => {
  const { homeTeamId, awayTeamId, scheduledAt, venue = '', roundType = 'league' } = req.body || {};
  const scheduledDate = typeof scheduledAt === 'string' ? new Date(scheduledAt) : null;
  if (typeof homeTeamId !== 'string' || typeof awayTeamId !== 'string' || homeTeamId === awayTeamId ||
      !scheduledDate || !Number.isFinite(scheduledDate.getTime()) ||
      typeof venue !== 'string' || venue.trim().length > 120 ||
      !['league', 'quarterfinal', 'semifinal', 'final'].includes(roundType)) {
    return res.status(400).json({ error: 'Choose a valid match round, two different teams, date and time, and a venue under 120 characters.' });
  }
  const id = `M_${crypto.randomUUID()}`;
  await pool.query(
    `INSERT INTO matches (id, home_team_id, away_team_id, scheduled_at, venue, round_type)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, homeTeamId, awayTeamId, scheduledDate.toISOString(), venue.trim(), roundType]
  );
  res.status(201).json((await listMatches()).find((match) => match.id === id));
}));

app.delete('/api/matches/:id', requireRole('admin'), asyncRoute(async (req, res) => {
  const result = await pool.query('DELETE FROM matches WHERE id=$1 RETURNING id', [req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: 'Match not found.' });
  res.json({ success: true });
}));

app.put('/api/matches/:id', requireRole('admin'), asyncRoute(async (req, res) => {
  const { homeTeamId, awayTeamId, scheduledAt, venue = '', roundType = 'league' } = req.body || {};
  const scheduledDate = typeof scheduledAt === 'string' ? new Date(scheduledAt) : null;
  if (typeof homeTeamId !== 'string' || typeof awayTeamId !== 'string' || homeTeamId === awayTeamId ||
      !scheduledDate || !Number.isFinite(scheduledDate.getTime()) ||
      typeof venue !== 'string' || venue.trim().length > 120 ||
      !['league', 'quarterfinal', 'semifinal', 'final'].includes(roundType)) {
    return res.status(400).json({ error: 'Choose a valid match round, two different teams, date and time, and a venue under 120 characters.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const matchResult = await client.query(
      'SELECT status FROM matches WHERE id=$1 FOR UPDATE',
      [req.params.id]
    );
    if (!matchResult.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Match not found.' });
    }
    if (!['scheduled', 'cancelled'].includes(matchResult.rows[0].status)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Only scheduled or cancelled matches can be rescheduled.' });
    }
    await client.query(
      `UPDATE matches SET home_team_id=$1, away_team_id=$2, scheduled_at=$3, venue=$4, round_type=$6,
        home_score=0, away_score=0,
        toss_winner_team_id=CASE WHEN home_team_id<>$1 OR away_team_id<>$2 THEN NULL ELSE toss_winner_team_id END,
        toss_decision=CASE WHEN home_team_id<>$1 OR away_team_id<>$2 THEN NULL ELSE toss_decision END,
        tie_break_phase=NULL, tie_break_golden_raid_team_id=NULL,
        tie_break_toss_team_id=NULL, tie_break_toss_decision=NULL,
        updated_at=NOW() WHERE id=$5`,
      [homeTeamId, awayTeamId, scheduledDate.toISOString(), venue.trim(), req.params.id, roundType]
    );
    await client.query('DELETE FROM match_score_events WHERE match_id=$1', [req.params.id]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  res.json((await listMatches()).find((match) => match.id === req.params.id));
}));

app.put('/api/matches/:id/status', requireRole('admin'), asyncRoute(async (req, res) => {
  const { status } = req.body || {};
  if (!['scheduled', 'live', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Choose a valid match status.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT id, status, round_type, tie_break_phase, home_team_id, away_team_id
       FROM matches WHERE id=$1 FOR UPDATE`,
      [req.params.id]
    );
    if (!result.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Match not found.' });
    }
    const match = result.rows[0];
    let nextStatus = status;
    let nextTieBreakPhase = match.tie_break_phase;
    if (status === 'completed' && match.round_type !== 'league') {
      if (!match.tie_break_phase) {
        const scoreRows = await client.query(
          `SELECT team_id, COALESCE(SUM(points), 0)::int AS points
           FROM match_score_events WHERE match_id=$1 AND period='regular' GROUP BY team_id`,
          [req.params.id]
        );
        const scores = new Map(scoreRows.rows.map((row) => [row.team_id, Number(row.points)]));
        if ((scores.get(match.home_team_id) || 0) === (scores.get(match.away_team_id) || 0)) {
          nextStatus = 'live';
          nextTieBreakPhase = 'super5';
        }
      } else if (match.tie_break_phase === 'super5') {
        const raidRows = await client.query(
          `SELECT COUNT(*)::int AS raids,
              COALESCE(SUM(points) FILTER (WHERE team_id=$2), 0)::int AS home_points,
              COALESCE(SUM(points) FILTER (WHERE team_id=$3), 0)::int AS away_points
           FROM match_score_events WHERE match_id=$1 AND period='super5'`,
          [req.params.id, match.home_team_id, match.away_team_id]
        );
        const raids = raidRows.rows[0];
        if (raids.raids < 10) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: `Complete all 10 Super 5 raids first. ${raids.raids} of 10 are recorded.` });
        }
        if (raids.home_points === raids.away_points) {
          nextStatus = 'live';
          nextTieBreakPhase = 'golden_toss';
        } else {
          nextTieBreakPhase = 'completed';
        }
      } else if (match.tie_break_phase === 'golden_toss') {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Record the golden-raid toss and raid before completing this match.' });
      } else if (match.tie_break_phase === 'golden_raid') {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Record the golden raid before completing this match.' });
      }
    }
    await client.query(
      'UPDATE matches SET status=$1, tie_break_phase=$2, updated_at=NOW() WHERE id=$3',
      [nextStatus, nextTieBreakPhase, req.params.id]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  res.json((await listMatches()).find((match) => match.id === req.params.id));
}));

app.put('/api/matches/:id/toss', requireRole('admin'), asyncRoute(async (req, res) => {
  const { winnerTeamId, decision } = req.body || {};
  if (typeof winnerTeamId !== 'string' || !['raid', 'court_side'].includes(decision)) {
    return res.status(400).json({ error: 'Choose the toss-winning team and whether it elected to raid or choose a court side.' });
  }
  const result = await pool.query(
    `UPDATE matches
     SET toss_winner_team_id=$1, toss_decision=$2, updated_at=NOW()
     WHERE id=$3 AND status='scheduled' AND $1 IN (home_team_id, away_team_id)
     RETURNING id`,
    [winnerTeamId, decision, req.params.id]
  );
  if (!result.rowCount) {
    const match = await pool.query('SELECT id, status FROM matches WHERE id=$1', [req.params.id]);
    if (!match.rowCount) return res.status(404).json({ error: 'Match not found.' });
    if (match.rows[0].status !== 'scheduled') {
      return res.status(409).json({ error: 'Toss details can only be entered before the match starts.' });
    }
    return res.status(400).json({ error: 'The toss winner must be one of the teams in this match.' });
  }
  res.json((await listMatches()).find((match) => match.id === req.params.id));
}));

app.put('/api/matches/:id/golden-toss', requireRole('admin'), asyncRoute(async (req, res) => {
  const { winnerTeamId, decision } = req.body || {};
  if (typeof winnerTeamId !== 'string' || !['raid', 'defend'].includes(decision)) {
    return res.status(400).json({ error: 'Choose the toss winner and whether they choose to raid or defend.' });
  }
  const result = await pool.query(
    `UPDATE matches
     SET tie_break_toss_team_id=$1, tie_break_toss_decision=$2,
       tie_break_golden_raid_team_id=CASE WHEN $2='raid' THEN $1
         WHEN $1=home_team_id THEN away_team_id ELSE home_team_id END,
       tie_break_phase='golden_raid', updated_at=NOW()
     WHERE id=$3 AND status='live' AND tie_break_phase='golden_toss'
       AND $1 IN (home_team_id, away_team_id)
     RETURNING id`,
    [winnerTeamId, decision, req.params.id]
  );
  if (!result.rowCount) {
    const match = await pool.query('SELECT status, tie_break_phase FROM matches WHERE id=$1', [req.params.id]);
    if (!match.rowCount) return res.status(404).json({ error: 'Match not found.' });
    if (match.rows[0].tie_break_phase !== 'golden_toss') {
      return res.status(409).json({ error: 'The match is not waiting for a golden-raid toss.' });
    }
    return res.status(400).json({ error: 'The toss winner must be one of the teams in this match.' });
  }
  res.json((await listMatches()).find((match) => match.id === req.params.id));
}));

app.post('/api/matches/:id/events', requireRole('admin'), asyncRoute(async (req, res) => {
  const { teamId, playerId = null, type, points } = req.body || {};
  const playerEvent = ['raid', 'tackle', 'bonus'].includes(type);
  const teamEvent = ['all_out', 'technical'].includes(type);
  if (typeof teamId !== 'string' || (!playerEvent && !teamEvent) ||
      (playerEvent && typeof playerId !== 'string') || (teamEvent && playerId !== null)) {
    return res.status(400).json({ error: 'Choose a participating team and a valid scoring event.' });
  }
  if (type === 'all_out' && points !== undefined && points !== 2 ||
      type === 'bonus' && points !== undefined && points !== 1 ||
      type === 'raid' && (!Number.isSafeInteger(points) || points < 0 || points > 7) ||
      type === 'tackle' && (!Number.isSafeInteger(points) || points < 1 || points > 2) ||
      type === 'technical' && (!Number.isSafeInteger(points) || points < 1 || points > 99)) {
    return res.status(400).json({ error: 'Enter valid points for this scoring event.' });
  }
  const eventPoints = type === 'all_out' ? 2 : type === 'bonus' ? 1 : points;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const matchResult = await client.query(
      `SELECT home_team_id, away_team_id, status, round_type, tie_break_phase,
          toss_winner_team_id, toss_decision, tie_break_golden_raid_team_id
       FROM matches WHERE id=$1 FOR UPDATE`,
      [req.params.id]
    );
    if (!matchResult.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Match not found.' });
    }
    const match = matchResult.rows[0];
    if (match.status !== 'live') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Scoring events can only be recorded during a live match.' });
    }
    const participatingTeams = [match.home_team_id, match.away_team_id];
    if (!participatingTeams.includes(teamId)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Choose one of the teams in this match.' });
    }
    let period = 'regular';
    let goldenRaid = false;
    if (match.tie_break_phase === 'super5') {
      if (type !== 'raid' || !Number.isSafeInteger(points) || points < 0 || points > 7 || !playerId) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'A Super 5 attempt must be recorded as a player raid with 0 to 7 points.' });
      }
      const raidCountResult = await client.query(
        `SELECT COUNT(*)::int AS raids FROM match_score_events WHERE match_id=$1 AND period='super5'`,
        [req.params.id]
      );
      const raidCount = raidCountResult.rows[0].raids;
      if (raidCount >= 10) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'All 10 Super 5 raids have already been recorded.' });
      }
      const firstTeam = match.toss_winner_team_id
        ? match.toss_decision === 'raid'
          ? match.toss_winner_team_id
          : match.toss_winner_team_id === match.home_team_id ? match.away_team_id : match.home_team_id
        : match.home_team_id;
      const expectedTeam = raidCount % 2 === 0
        ? firstTeam
        : firstTeam === match.home_team_id ? match.away_team_id : match.home_team_id;
      if (teamId !== expectedTeam) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Super 5 raids must alternate between the teams, starting with the indicated team.' });
      }
      period = 'super5';
    } else if (match.tie_break_phase === 'golden_toss') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Record the golden-raid toss before entering the deciding raid.' });
    } else if (match.tie_break_phase === 'golden_raid') {
      if (type !== 'raid' || !Number.isSafeInteger(points) || points < 0 || points > 7 || !playerId ||
          teamId !== match.tie_break_golden_raid_team_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Record the single golden raid for the team chosen by the toss.' });
      }
      const existingGoldenRaid = await client.query(
        "SELECT 1 FROM match_score_events WHERE match_id=$1 AND period='golden' LIMIT 1",
        [req.params.id]
      );
      if (existingGoldenRaid.rowCount) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'The golden raid has already been recorded.' });
      }
      period = 'golden';
      goldenRaid = true;
    } else if (match.tie_break_phase === 'completed') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'The match tie-break is already complete.' });
    } else if (type === 'raid' && (!Number.isSafeInteger(points) || points < 1)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'A regular raid must score at least one point to record.' });
    }
    if (playerEvent) {
      const playerResult = await client.query(
        'SELECT team_id, category FROM players WHERE id=$1',
        [playerId]
      );
      if (!playerResult.rowCount || playerResult.rows[0].team_id !== teamId) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Choose a player assigned to the selected team.' });
      }
    }

    await client.query(
      `INSERT INTO match_score_events (id, match_id, team_id, player_id, event_type, period, points)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [`E_${crypto.randomUUID()}`, req.params.id, teamId, playerEvent ? playerId : null, type, period, eventPoints]
    );
    if (goldenRaid) {
      await client.query(
        "UPDATE matches SET tie_break_phase='completed', status='completed', updated_at=NOW() WHERE id=$1",
        [req.params.id]
      );
    } else if (period === 'super5') {
      const scoreResult = await client.query(
        `SELECT COUNT(*)::int AS raids,
            COALESCE(SUM(points) FILTER (WHERE team_id=$2), 0)::int AS home_points,
            COALESCE(SUM(points) FILTER (WHERE team_id=$3), 0)::int AS away_points
         FROM match_score_events WHERE match_id=$1 AND period='super5'`,
        [req.params.id, match.home_team_id, match.away_team_id]
      );
      const score = scoreResult.rows[0];
      await client.query(
        `UPDATE matches SET tie_break_phase=$1, updated_at=NOW() WHERE id=$2`,
        [score.raids < 10 ? 'super5' : score.home_points === score.away_points ? 'golden_toss' : 'completed', req.params.id]
      );
    } else {
      await client.query('UPDATE matches SET updated_at=NOW() WHERE id=$1', [req.params.id]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  res.json((await listMatches()).find((match) => match.id === req.params.id));
}));

app.delete('/api/matches/:id/events/:eventId', requireRole('admin'), asyncRoute(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const matchResult = await client.query(
      `SELECT status, round_type, tie_break_phase, home_team_id, away_team_id,
          tie_break_toss_team_id, tie_break_toss_decision
       FROM matches WHERE id=$1 FOR UPDATE`,
      [req.params.id]
    );
    if (!matchResult.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Match not found.' });
    }
    if (matchResult.rows[0].status !== 'live') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Scoring events can only be corrected during a live match.' });
    }
    const eventResult = await client.query(
      'DELETE FROM match_score_events WHERE id=$1 AND match_id=$2 RETURNING id, period',
      [req.params.eventId, req.params.id]
    );
    if (!eventResult.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Scoring event not found.' });
    }
    const match = matchResult.rows[0];
    if (eventResult.rows[0].period === 'regular' && match.tie_break_phase) {
      await client.query(
        "DELETE FROM match_score_events WHERE match_id=$1 AND period IN ('super5', 'golden')",
        [req.params.id]
      );
      await client.query(
        `UPDATE matches SET tie_break_toss_team_id=NULL, tie_break_toss_decision=NULL,
          tie_break_golden_raid_team_id=NULL WHERE id=$1`,
        [req.params.id]
      );
      const regularScores = await client.query(
        `SELECT COALESCE(SUM(points) FILTER (WHERE team_id=$2), 0)::int AS home_points,
            COALESCE(SUM(points) FILTER (WHERE team_id=$3), 0)::int AS away_points
         FROM match_score_events WHERE match_id=$1 AND period='regular'`,
        [req.params.id, match.home_team_id, match.away_team_id]
      );
      const regular = regularScores.rows[0];
      const phase = match.round_type !== 'league' && regular.home_points === regular.away_points
        ? 'super5'
        : null;
      await client.query(
        'UPDATE matches SET tie_break_phase=$1, updated_at=NOW() WHERE id=$2',
        [phase, req.params.id]
      );
    } else if (eventResult.rows[0].period === 'super5') {
      await client.query(
        `DELETE FROM match_score_events WHERE match_id=$1 AND period='golden'`,
        [req.params.id]
      );
      await client.query(
        `UPDATE matches SET tie_break_toss_team_id=NULL, tie_break_toss_decision=NULL,
          tie_break_golden_raid_team_id=NULL WHERE id=$1`,
        [req.params.id]
      );
      match.tie_break_toss_team_id = null;
      match.tie_break_toss_decision = null;
    }
    if (eventResult.rows[0].period !== 'regular' && (
        (match.tie_break_phase && match.tie_break_phase !== 'golden_toss') ||
        eventResult.rows[0].period === 'super5' || eventResult.rows[0].period === 'golden')) {
      const tieBreakResult = await client.query(
        `SELECT COUNT(*) FILTER (WHERE period='super5')::int AS raids,
            COALESCE(SUM(points) FILTER (WHERE period='super5' AND team_id=$2), 0)::int AS home_points,
            COALESCE(SUM(points) FILTER (WHERE period='super5' AND team_id=$3), 0)::int AS away_points,
            COUNT(*) FILTER (WHERE period='golden')::int AS golden_raids
         FROM match_score_events WHERE match_id=$1`,
        [req.params.id, matchResult.rows[0].home_team_id, matchResult.rows[0].away_team_id]
      );
      const score = tieBreakResult.rows[0];
      const phase = score.golden_raids
        ? 'completed'
        : score.raids === 10 && score.home_points === score.away_points
          ? match.tie_break_toss_team_id ? 'golden_raid' : 'golden_toss'
          : score.raids < 10
            ? 'super5'
            : score.home_points === score.away_points ? 'golden_toss' : 'completed';
      await client.query(
        'UPDATE matches SET tie_break_phase=$1, updated_at=NOW() WHERE id=$2',
        [phase, req.params.id]
      );
    } else {
      await client.query('UPDATE matches SET updated_at=NOW() WHERE id=$1', [req.params.id]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  res.json((await listMatches()).find((match) => match.id === req.params.id));
}));

app.get('/api/team/portal', requireRole('team'), asyncRoute(async (req, res) => {
  const teams = await listTeams();
  const team = teams.find((item) => item.id === req.session.user.teamId);
  if (!team) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: 'This team account no longer exists. Please sign in again.' });
  }
  const auctionSnapshot = await getAuctionSnapshot();
  res.json({ team, players: await listPlayers(), teams, matches: await listMatches(), ...auctionSnapshot });
}));

app.get(['/index.html', '/admin.html', '/team.html'], (req, res) => {
  const routes = {
    '/index.html': '/',
    '/admin.html': '/admin',
    '/team.html': '/team'
  };
  res.redirect(308, routes[req.path]);
});
app.use(express.static(path.join(__dirname, 'public')));

app.use((error, req, res, next) => {
  console.error(error);
  if (error.code === '23505') return res.status(409).json({ error: 'That email address is already in use.' });
  if (error.code === '23503' || error.code === '23514' || error.code === '22P02') {
    return res.status(400).json({ error: 'The submitted data is invalid.' });
  }
  res.status(500).json({ error: 'A server error occurred. Check the terminal for details.' });
});

module.exports = { app, initDatabase };

if (require.main === module) {
  initDatabase()
    .then(async () => {
      if (isProduction) process.env[['NODE', 'ENV'].join('_')] = 'production';
      const next = require('next');
      const nextApp = next({ dev: !isProduction });
      await nextApp.prepare();
      const handle = nextApp.getRequestHandler();
      app.all('*', (req, res) => handle(req, res));
      app.listen(PORT, () => console.log(`KKPL is running at http://localhost:${PORT}`));
    })
    .catch((error) => {
      console.error('Could not initialize the database:', error);
      process.exitCode = 1;
    });
}
