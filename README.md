# V Spark – E-Gaming Arena

Node.js + Express event-registration site backed by Supabase Postgres through `pg`. The browser receives only public event/game data; database access and authentication stay on the server.

## Supabase setup

1. Create a Supabase project and copy its Postgres connection string (use the direct or session-pooler URL supported by your deployment).
2. In the Supabase SQL editor, run `schema.sql`.
3. Copy `.env.example` to `.env`, then set `DATABASE_URL`, a long random `SESSION_SECRET`, `ADMIN_USERNAME=admin`, and a private `ADMIN_PASSWORD`.
4. Install dependencies and run `npm run seed`. The seed creates only missing games and hashes the admin password using bcrypt. Re-running it updates that admin's hash.

## Local run (PowerShell)

When no real `DATABASE_URL` is set, `npm start` automatically starts a persistent PostgreSQL-compatible local database, applies `schema.sql`, seeds the games and local admin, and runs Express. Its data stays under `data/vspark-postgres` on this computer. This avoids needing a separate database installer for local development. `npm run dev:local` remains available for the same local setup.

```powershell
npm install
npm start
```

Open `http://localhost:3000`; admin tools are at `http://localhost:3000/admin`. Check `http://localhost:3000/health` for service health. Stop the local app with Ctrl+C. Node.js 20+ is recommended.

The local development database is convenient for this computer. Production and shared deployments should use a regular PostgreSQL service such as Supabase, configured through `DATABASE_URL`.

## Student profile photos

Students can upload a JPG, PNG, or WebP profile photo (maximum 2 MB) from **My Profile**. Images are validated by file signature and stored as PostgreSQL `BYTEA` data. The student profile uses a private authenticated image route; the public winners board only serves the photo of a completed-match winner. The columns are included in `schema.sql`; when updating an existing database, run the latest `schema.sql` in the Supabase SQL editor before starting the updated app.

## Deploy to Vercel + Supabase

1. Create a Supabase project. In the project SQL Editor, run the current `schema.sql`.
2. In Supabase, select **Connect → Transaction pooler** and copy its URI. This is the connection type intended for serverless functions. Keep the database password private.
3. Import this GitHub repository into Vercel. Vercel detects the exported Express app in `server.js`; keep the project root at the repository root. The `public/` folder is served as static assets, and `cleanUrls` keeps `/admin` working.
4. In Vercel **Project → Settings → Environment Variables**, add `DATABASE_URL` (the Supabase transaction pooler URI), `SESSION_SECRET` (a long random value), `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `NODE_ENV=production`. Apply them to Production and Preview as needed. Never put the database URL or admin password in frontend code or commit them.
5. Deploy. Check `<your-vercel-domain>/health` and `<your-vercel-domain>/api/public`.
6. Seed the admin and games once using the same `DATABASE_URL`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD` in a private local `.env`, then run `npm run seed`. The seed script applies `schema.sql` idempotently before inserting the games and bcrypt-hashed admin. Remove the temporary local `.env` only if you no longer need it; it is gitignored.

For local seeding against Supabase, use the pooler URI exactly as copied from its dashboard. For Vercel, the app uses one `pg` connection per warm function instance to avoid opening excessive database connections.

## Environment variables

`DATABASE_URL` is required for Supabase/production and optional for local `npm start` (without it, the local persistent database starts automatically). `SESSION_SECRET` is required for deployment, `ADMIN_USERNAME` and `ADMIN_PASSWORD` are required for seeding, `PORT` is supplied by the host, and `NODE_ENV` controls production settings.

## Tests

```powershell
npm test
```

The automated suite checks the signup validators, admin role middleware, and the transaction/overlap SQL contracts. A configured Supabase instance is still needed for end-to-end database concurrency testing. Keep any `.env` file private; it is excluded by `.gitignore`.

## Supplied images

- Hero: `public/assets/images/hero/university.jpg`
- Tekken: `public/assets/images/games/tekken.webp`
- FIFA: `public/assets/images/games/fifa.jpg`
- PUBG: `public/assets/images/games/pubg.jpg`
- Branding: `public/assets/images/brand/`

Replace these files at the same paths to update the artwork. The artwork has been copied as supplied; source JPEGs are not recompressed to WebP by this setup.
