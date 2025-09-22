const { pool } = require('./pool');
const { customAlphabet } = require('nanoid');

const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 24);

async function createShareLink({ diagramId, createdBy, permission = 'edit', expiresAt = null, jti = null }) {
  const id = jti || nanoid();
  const q = `
    insert into diagram_share_links (jti, diagram_id, created_by, permission, expires_at, revoked, created_at)
    values ($1,$2,$3,$4,$5,false, now())
    returning *
  `;
  const { rows: [row] } = await pool.query(q, [id, diagramId, createdBy ?? null, permission, expiresAt]);
  return row;
}

async function getShareByJti(jti) {
  const { rows: [row] } = await pool.query(`select * from diagram_share_links where jti=$1`, [jti]);
  return row || null;
}

async function markShareRevoked(jti) {
  const { rows: [row] } = await pool.query(
    `update diagram_share_links set revoked=true where jti=$1 returning *`, [jti]
  );
  return row || null;
}

async function isShareActive(jti) {
  const { rows: [row] } = await pool.query(`
    select (not revoked) as ok, expires_at, diagram_id
      from diagram_share_links
     where jti=$1
  `, [jti]);
  if (!row) return { ok: false };
  const notExpired = !row.expires_at || new Date(row.expires_at) > new Date();
  return { ok: row.ok && notExpired, diagramId: row.diagram_id };
}

module.exports = { createShareLink, getShareByJti, markShareRevoked, isShareActive };
