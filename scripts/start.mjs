import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import net from 'node:net';
import dotenv from 'dotenv';

dotenv.config({ path: resolve('.env') });
const require = createRequire(import.meta.url);

async function findFreePort(from) {
  for (let port = from; port < from + 20; port += 1) {
    const available = await new Promise((resolveAvailable) => {
      const server = net.createServer();
      server.once('error', () => resolveAvailable(false));
      server.listen(port, '127.0.0.1', () => server.close(() => resolveAvailable(true)));
    });
    if (available) return port;
  }
  throw new Error(`No available local port found from ${from} to ${from + 19}.`);
}

async function startExpress(port) {
  const app = require('../server.js');
  const db = require('../src/db');
  const server = app.listen(port, '127.0.0.1', () => {
    console.log(`V Spark is ready at http://localhost:${port}`);
  });
  server.on('error', (error) => {
    console.error(`Could not start the web server: ${error.message}`);
    process.exitCode = 1;
  });

  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    server.close(async () => {
      await db.end();
      process.exit(0);
    });
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

const databaseUrl = String(process.env.DATABASE_URL || '').trim();
const hasConfiguredDatabase = databaseUrl.length > 0 &&
  !databaseUrl.includes('user:password@host') &&
  !databaseUrl.includes('host:5432/database');

if (hasConfiguredDatabase) {
  await startExpress(Number(process.env.PORT || 3000));
} else {
  process.env.NODE_ENV ||= 'development';
  process.env.PGLITE_LOCAL = '1';
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/postgres';
  if (!process.env.PORT) process.env.PORT = String(await findFreePort(3000));

  const { Client, Pool } = require('pg');
  const probe = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 1200,
    query_timeout: 1200
  });
  let reuseDatabase = false;
  try {
    await probe.connect();
    await probe.query('SELECT 1');
    reuseDatabase = true;
  } catch {
    // No local database is running yet; start the embedded persistent one below.
  } finally {
    await probe.end().catch(() => {});
  }

  if (!reuseDatabase) {
    console.log('DATABASE_URL is not configured; starting the persistent local PostgreSQL database.');
    await import('./run-local.mjs');
  } else {
    if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
      throw new Error('Set ADMIN_USERNAME and ADMIN_PASSWORD in .env before starting the app.');
    }
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    try {
      await pool.query(await readFile(resolve('schema.sql'), 'utf8'));
      await pool.query(`INSERT INTO games(slug,name,description,capacity,players_per_match,image_path) VALUES
        ('tekken-3','Tekken 3','Classic arcade combat. Choose your fighter and enter the arena.',32,2,'/assets/images/games/tekken.webp'),
        ('fifa','FIFA','The beautiful game. Edition can be changed by an administrator.',32,2,'/assets/images/games/fifa.jpg'),
        ('pubg-mobile','PUBG Mobile','Squad up and outlast the competition.',40,16,'/assets/images/games/pubg.jpg')
        ON CONFLICT(slug) DO NOTHING`);
      const bcrypt = require('bcryptjs');
      await pool.query(
        'INSERT INTO admins(username,password_hash) VALUES($1,$2) ON CONFLICT(username) DO UPDATE SET password_hash=EXCLUDED.password_hash',
        [process.env.ADMIN_USERNAME, await bcrypt.hash(process.env.ADMIN_PASSWORD, 12)]
      );
    } finally {
      await pool.end();
    }
    console.log('Reusing the running local database.');
    await startExpress(Number(process.env.PORT));
  }
}
