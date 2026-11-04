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

## Render deploy

Create a Render Web Service from this repository, set the build command to `npm install` and start command to `npm start`. Add `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `NODE_ENV=production` under the service's environment settings. Run the schema in Supabase and run `npm run seed` once against the production database (for example, from the Render shell). Render terminates HTTPS; production cookies are marked Secure.

## Environment variables

`DATABASE_URL` is required for Supabase/production and optional for local `npm start` (without it, the local persistent database starts automatically). `SESSION_SECRET` is required for deployment, `ADMIN_USERNAME` and `ADMIN_PASSWORD` are required for seeding, `PORT` is supplied by Render, and `NODE_ENV` controls production settings.

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
