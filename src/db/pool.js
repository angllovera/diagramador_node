const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: String(process.env.PGSSL || '').toLowerCase() === 'true'
       ? { rejectUnauthorized: false }
       : false
});

module.exports = { pool, query: (t, p) => pool.query(t, p) };
