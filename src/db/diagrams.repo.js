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

async function create({ projectId, name, kind, modelJson }) {
  const payload = typeof modelJson === "string"
    ? modelJson
    : JSON.stringify(modelJson ?? { class: "go.GraphLinksModel", nodeDataArray: [], linkDataArray: [] });

  const { rows } = await pool.query(
    `
    INSERT INTO public.diagrams (id, project_id, name, kind, model_json)
    VALUES (gen_random_uuid(), $1, $2, COALESCE($3, 'class'), $4::jsonb)
    RETURNING id, project_id AS "projectId", name, kind, model_json AS "modelJson",
              created_at AS "createdAt", updated_at AS "updatedAt"
    `,
    [projectId, name, kind || null, payload]
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

  if (typeof name !== "undefined") { sets.push(`name = $${i++}`); vals.push(name); }
  if (typeof kind !== "undefined") { sets.push(`kind = $${i++}`); vals.push(kind); }

  if (typeof modelJson !== "undefined") {
    // Blindaje: NO sobreescribir con vacío si lo actual tiene datos
    const current = await byId(id);
    let incoming = typeof modelJson === "string" ? JSON.parse(modelJson) : (modelJson ?? {});
    const incEmpty = !(incoming?.nodeDataArray?.length) && !(incoming?.linkDataArray?.length);

    let curHasData = false;
    try {
      const cur = typeof current?.modelJson === "string" ? JSON.parse(current.modelJson) : (current?.modelJson ?? {});
      curHasData = (cur?.nodeDataArray?.length || 0) > 0 || (cur?.linkDataArray?.length || 0) > 0;
    } catch {}

    if (incEmpty && curHasData) {
      // devolvemos el actual sin tocar BD
      return current;
    }

    sets.push(`model_json = $${i++}::jsonb`);
    vals.push(typeof modelJson === "string" ? modelJson : JSON.stringify(modelJson ?? {}));
  }

  if (typeof xmiCached !== "undefined") { sets.push(`xmi_cached = $${i++}`); vals.push(xmiCached); }

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

  if (d && typeof modelJson !== "undefined") {
    await pool.query(
      `
      INSERT INTO public.diagram_versions (diagram_id, model_json, xmi_cached, author_id, created_at)
      VALUES ($1, $2::jsonb, $3, $4, now())
      `,
      [id,
       typeof modelJson === "string" ? modelJson : JSON.stringify(modelJson ?? {}),
       xmiCached ?? null,
       authorId ?? null]
    );
  }
  return d;
}

async function remove(id) {
  await pool.query(`DELETE FROM public.diagrams WHERE id = $1`, [id]);
}

module.exports = { create, listByProject, byId, update, remove };
