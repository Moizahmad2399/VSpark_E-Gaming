const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: process.env.PGLITE_LOCAL === '1' ? 1 : 10, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined });
module.exports = pool;
