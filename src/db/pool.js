const { Pool } = require('pg');
const env = require('../config/env');

const pool = new Pool({
  host: env.PGHOST,
  port: env.PGPORT,
  user: env.PGUSER,
  password: env.PGPASSWORD,
  database: env.PGDATABASE,
  ssl: env.PGSSL ? { rejectUnauthorized: false } : false
});

async function check() {
  const { rows } = await pool.query('SELECT NOW() now');
  console.log('✅ PostgreSQL OK:', rows[0].now);
}
check().catch(err => { console.error('❌ DB error:', err.message); process.exit(1); });

async function query(text, params) {
  return pool.query(text, params);
}

process.on('SIGINT', async () => { await pool.end(); process.exit(0); });

module.exports = { pool, query };
