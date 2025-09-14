const { pool } = require('./pool');

// Asegúrate en tu DB: CREATE EXTENSION IF NOT EXISTS "pgcrypto";

const SELECT = `
  id,
  owner_id   AS "ownerId",
  name,
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

async function create({ name, ownerId = null }) {
  const { rows } = await pool.query(
    `
    INSERT INTO public.projects (id, owner_id, name)
    VALUES (gen_random_uuid(), $1, $2)
    RETURNING ${SELECT}
    `,
    [ownerId, name]
  );
  return rows[0];
}

// Lista por dueño si viene, si no lista todo
async function list({ ownerId } = {}) {
  if (ownerId) {
    const { rows } = await pool.query(
      `SELECT ${SELECT} FROM public.projects WHERE owner_id = $1 ORDER BY updated_at DESC`,
      [ownerId]
    );
    return rows;
  }
  const { rows } = await pool.query(
    `SELECT ${SELECT} FROM public.projects ORDER BY updated_at DESC`
  );
  return rows;
}

async function byId(id) {
  const { rows } = await pool.query(
    `SELECT ${SELECT} FROM public.projects WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function update(id, { name }) {
  const sets = [];
  const vals = [];
  let i = 1;

  if (typeof name !== 'undefined') { sets.push(`name = $${i++}`); vals.push(name); }
  sets.push(`updated_at = now()`);
  vals.push(id);

  const { rows } = await pool.query(
    `
    UPDATE public.projects
       SET ${sets.join(', ')}
     WHERE id = $${i}
     RETURNING ${SELECT}
    `,
    vals
  );
  return rows[0] || null;
}

async function remove(id) {
  await pool.query(`DELETE FROM public.projects WHERE id = $1`, [id]);
}

module.exports = { create, list, byId, update, remove };
