# KKPL Auction System

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

6. Open <http://localhost:3000>. The server creates the tables and demo data on its first run.

`npm run build` checks the server and browser JavaScript files for syntax errors. This project does not bundle or compile frontend assets, so the command does not create a separate output directory.

## Deploying to Vercel with Neon

1. Push the project to a Git provider and import it into Vercel. Vercel serves the HTML, CSS, and browser JavaScript as static files, and routes `/api/*` requests through `api/[...path].js` to the Express app.
2. In Vercel project settings, add `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` for Production (and Preview if needed). Use Neon’s pooled connection string for `DATABASE_URL`; keep its SSL requirement. Set a unique session secret of at least 32 characters and an admin password of at least 12 characters.
3. Deploy. The API initializes the database schema on its first invocation. Keep the same Neon database when redeploying so teams, players, and sessions persist.

The Vercel entry point initializes the database before handling API requests. `npm start` and `npm run dev` continue to run the Express server locally.

The admin email is set by `ADMIN_EMAIL` in `.env`. Demo team accounts are:

| Team | Email | Initial password |
|---|---|---|
| Jaipur Pink Panthers | jaipur@kkpl.com | Jaipur@123 |
| Patna Pirates | patna@kkpl.com | Patna@123 |
| Bengaluru Bulls | bengaluru@kkpl.com | Bengaluru@123 |

Change demo team passwords in the admin panel before using the app with real accounts.

## Player auction tiers

When adding a player, assign an auction tier: **A** for top players, **B** for middle-tier players, or **C** for developing/lower-tier players. This is separate from the player's playing role (Raider, Defender, or All-Rounder). Use the tier selector in the admin auction queue to list players from one tier. Existing players are assigned to Tier B during the database migration and can be reclassified from the player editor.
