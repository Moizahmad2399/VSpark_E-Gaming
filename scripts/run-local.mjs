import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
require('dotenv').config({ path: resolve('.env') });
process.env.PGLITE_LOCAL = '1';
process.env.NODE_ENV ||= 'development';
process.env.PORT ||= '3000';

await mkdir(resolve('data'), { recursive: true });
const db = await PGlite.create({ dataDir: resolve('data/vspark-postgres') });
const pgServer = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 5432, maxConnections: 10 });
await pgServer.start();
process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/postgres';

const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
try {
  await pool.query(await readFile(resolve('schema.sql'), 'utf8'));
  await pool.query(`INSERT INTO games(slug,name,description,capacity,players_per_match,image_path) VALUES
    ('tekken-3','Tekken 3','Classic arcade combat. Choose your fighter and enter the arena.',32,2,'/assets/images/games/tekken.webp'),
    ('fifa','FIFA','The beautiful game. Edition can be changed by an administrator.',32,2,'/assets/images/games/fifa.jpg'),
    ('pubg-mobile','PUBG Mobile','Squad up and outlast the competition.',40,16,'/assets/images/games/pubg.jpg')
    ON CONFLICT(slug) DO NOTHING`);
  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
    throw new Error('Set ADMIN_USERNAME and ADMIN_PASSWORD in .env before starting the app.');
  }
  const bcrypt = require('bcryptjs');
  await pool.query(
    'INSERT INTO admins(username,password_hash) VALUES($1,$2) ON CONFLICT(username) DO UPDATE SET password_hash=EXCLUDED.password_hash',
    [process.env.ADMIN_USERNAME, await bcrypt.hash(process.env.ADMIN_PASSWORD, 12)]
  );
} catch (error) {
  await pool.end();
  await pgServer.stop();
  await db.close();
  throw error;
}
await pool.end();

const app = require('../server.js');
const server = app.listen(Number(process.env.PORT), '127.0.0.1', () => {
  console.log(`V Spark is ready at http://localhost:${process.env.PORT}`);
  console.log('Local PostgreSQL database is ready; schema and seed are applied.');
});

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  await new Promise((resolveClose) => server.close(resolveClose));
  await pgServer.stop();
  await db.close();
}
process.on('SIGINT', () => shutdown().finally(() => process.exit(0)));
process.on('SIGTERM', () => shutdown().finally(() => process.exit(0)));
