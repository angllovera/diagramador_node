const { pool } = require("./pool");

const SELECT_COLS = `
  id,
  project_id  AS "projectId",
  name,
  kind,
  model_json  AS "modelJson",
  xmi_cached  AS "xmiCached",
  preview_png AS "previewPng",
  created_at  AS "createdAt",
  updated_at  AS "updatedAt"
`;

// ejemplo de create
async function create({ projectId, name, kind, modelJson }) {
  const { rows } = await pool.query(
    `
    INSERT INTO public.diagrams (id, project_id, name, kind, model_json)
    VALUES (gen_random_uuid(), $1, $2, COALESCE($3, 'class'), $4::jsonb)
    RETURNING id, project_id AS "projectId", name, kind, model_json AS "modelJson",
              created_at AS "createdAt", updated_at AS "updatedAt"
    `,
    [projectId, name, kind || null, JSON.stringify(modelJson ?? {})]
  );
  return rows[0];
}

async function listByProject(projectId) {
  const { rows } = await pool.query(
    `
    SELECT ${SELECT_COLS}
      FROM public.diagrams
     WHERE project_id = $1
     ORDER BY updated_at DESC
    `,
    [projectId]
  );
  return rows;
}

async function byId(id) {
  const { rows } = await pool.query(
    `SELECT ${SELECT_COLS} FROM public.diagrams WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function update(id, { name, kind, modelJson, xmiCached }, authorId) {
  const sets = [];
  const vals = [];
  let i = 1;

  if (typeof name !== "undefined") {
    sets.push(`name = $${i++}`);
    vals.push(name);
  }
  if (typeof kind !== "undefined") {
    sets.push(`kind = $${i++}`);
    vals.push(kind);
  }
  if (typeof modelJson !== "undefined") {
    sets.push(`model_json = $${i++}::jsonb`);
    vals.push(JSON.stringify(modelJson));
  }
  if (typeof xmiCached !== "undefined") {
    sets.push(`xmi_cached = $${i++}`);
    vals.push(xmiCached);
  }
  sets.push(`updated_at = now()`);

  vals.push(id);

  const { rows } = await pool.query(
    `
    UPDATE public.diagrams
       SET ${sets.join(", ")}
     WHERE id = $${i}
     RETURNING ${SELECT_COLS}
    `,
    vals
  );

  const d = rows[0] || null;

  // Guarda versión si se actualiza el modelo
  if (d && typeof modelJson !== "undefined") {
    await pool.query(
      `
      INSERT INTO public.diagram_versions (diagram_id, model_json, xmi_cached, author_id, created_at)
      VALUES ($1, $2::jsonb, $3, $4, now())
      `,
      [id, JSON.stringify(modelJson ?? {}), xmiCached ?? null, authorId ?? null]
    );
  }
  return d;
}

async function remove(id) {
  await pool.query(`DELETE FROM public.diagrams WHERE id = $1`, [id]);
}

module.exports = { create, listByProject, byId, update, remove };
