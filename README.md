# KKPL Auction System

The frontend uses the **Next.js App Router** (`/`, `/admin`, `/team`). The existing Express API, PostgreSQL data layer, and session authentication remain in place.

## Requirements

- Node.js 20 or newer (includes npm)
- PostgreSQL 14 or newer, running locally

## First-time setup on Windows

1. Install the **LTS** release of Node.js from <https://nodejs.org/>. Close and reopen PowerShell, then check `node -v` and `npm -v`.
2. Install PostgreSQL from <https://www.postgresql.org/download/windows/> and remember the password you set for its `postgres` user.
3. Create a database named `kkpl` using pgAdmin, or run `createdb -U postgres kkpl`.
4. In PowerShell, copy the example settings with `Copy-Item .env.example .env`. Edit `.env`: update `DATABASE_URL` with your PostgreSQL password, replace `SESSION_SECRET` with a unique random value of at least 32 characters, and set `ADMIN_PASSWORD` to a password with at least 12 characters. Do not share or commit `.env`. If your database password contains URL-reserved characters, URL-encode it in `DATABASE_URL`.
5. In PowerShell, run:

   ```powershell
   npm install
   npm run build
   npm run dev
   ```

6. Open <http://localhost:3000>. The server creates the tables and adds demo teams and players to an empty database in development mode only.

`npm run build` builds the Next.js application. `npm run dev` starts the Next.js development server through the Express server so the existing API and Next.js pages share the same port.

## Deploying to Vercel with Neon

1. Push the project to a Git provider and import it into Vercel. Vercel builds and serves the Next.js application and its assets. Requests to `/api/*` use the Next.js Pages API catch-all at `pages/api/[...path].js`, which forwards them to the existing Express API.
2. In Vercel project settings, add `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` for Production (and Preview if needed). Use Neon’s pooled connection string for `DATABASE_URL`; keep its SSL requirement. Set a unique session secret of at least 32 characters and an admin password of at least 12 characters.
3. Deploy. The API initializes the database schema on its first invocation. Production deployments do not add demo teams or players; add real teams and players from the admin portal. Keep the same Neon database when redeploying so teams, players, and sessions persist.

The Vercel API entry point initializes the database before handling API requests. Locally, `npm start` runs the production Next.js app with the Express API.

The admin email is set by `ADMIN_EMAIL` in `.env`. Local development demo team accounts are:

| Team | Email | Initial password |
|---|---|---|
| Jaipur Pink Panthers | jaipur@kkpl.com | Jaipur@123 |
| Patna Pirates | patna@kkpl.com | Patna@123 |
| Bengaluru Bulls | bengaluru@kkpl.com | Bengaluru@123 |

Change demo team passwords in the admin panel before using the app with real accounts.

## Player auction tiers

When adding a player, assign an auction tier: **A** for top players, **B** for middle-tier players, or **C** for developing/lower-tier players. This is separate from the player's playing role (Raider, Defender, or All-Rounder). Use the tier selector in the admin auction queue to list players from one tier. Existing players are assigned to Tier B during the database migration and can be reclassified from the player editor.

## Public player registration

Admins can open or copy the public `/player-registration` link from Auction Results and share it with players. The form asks for a required player photo (JPG, PNG, or WebP up to 5 MB), name, age, nationality, playing role, previous team, and skills. Submissions are added immediately as available Tier B players with a ₹1,000 base price; admins can edit those auction settings and player details in the player list. The public endpoint validates submissions and limits repeated requests.

## Auction bid increments

During live bidding, each team button shows the automatic increase that will be added to the current bid: ₹50 below ₹2,000; ₹100 from ₹2,000; ₹200 from ₹4,000; ₹300 from ₹7,000; ₹400 from ₹10,000; ₹450 from ₹13,000; ₹500 from ₹15,000; ₹550 from ₹18,000; ₹600 from ₹20,000; ₹700 from ₹25,000; ₹800 from ₹30,000; ₹900 from ₹35,000; and ₹1,000 from ₹40,000. The server checks each bid against the same schedule.

Admins can cancel the active auction to remove its bids and return the player to the **Available** queue without marking them unsold.

## Match schedule and scorecards

Admins can schedule matches between two teams, set the match date, time, venue, and round (League, Quarterfinal, Semifinal, or Final). Match numbers are assigned in schedule order within each round. During a live match, record raid, tackle, and bonus points against eligible players, or add all-out and technical points as team extras. Team totals are calculated automatically from player points and extras; admins can remove individual live events to correct mistakes and delete matches in any status. Completed match cards show the team score first; select the score to expand player points and extras. Team accounts can view the schedule, live scorecards, player raid/tackle/bonus/other totals, team extras, and completed results. Live match views refresh automatically while the team portal is open. Existing manual scorecards are migrated as technical team points and legacy player points.

Before starting a scheduled match, admins can record the toss-winning team and whether it chose to raid or choose a court side. Saved toss details appear in both portals. League matches may finish tied. A tied knockout match automatically goes to a Super 5 tie-break: five raids per team, taken alternately, for ten raids total. If still tied, the admin records a golden-raid toss; its winner chooses whether to raid or defend, and only the resulting raiding team takes one deciding raid. A scoreless golden raid awards the win to the defending team. Completed scorecards identify the winner and winning margin, or show that the match was tied.

The **Player Stats & Points** section aggregates player scoring from live and completed matches with recorded events. League standings use completed matches and award 5 points for a win, 2 for a tie, 1 for a loss by 5 or fewer points, and 0 for a loss by more than 5. All registered teams appear in the table, including teams with no completed matches.
