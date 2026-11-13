const { Pool } = require('pg');
const isSupabase = /supabase\.(co|com)/i.test(process.env.DATABASE_URL || '') || /pooler\.supabase\.com/i.test(process.env.DATABASE_URL || '');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: process.env.VERCEL ? 1 : process.env.PGLITE_LOCAL === '1' ? 1 : 10, ssl: process.env.NODE_ENV === 'production' || isSupabase ? { rejectUnauthorized: false } : undefined });
module.exports = pool;
