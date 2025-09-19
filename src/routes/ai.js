// routes/ai.js
const express = require("express");
const { Pool } = require("pg");
const { z } = require("zod");
const OpenAI = require("openai");

const router = express.Router();

// ✅ Usa tus variables PG* del .env (no DATABASE_URL)
const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: /^(true|1)$/i.test(process.env.PGSSL || "false")
    ? { rejectUnauthorized: false }
    : false,
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---- esquema de salida que el FRONT aplicará al lienzo ----
const OpsSchema = z.object({
  ops: z.array(z.object({
    type: z.enum(["add_classes", "relate"]),
    classes: z.array(z.object({
      name: z.string().min(1),
      stereotype: z.string().optional(),
      abstract: z.boolean().optional(),
      attributes: z.array(z.object({
        name: z.string().min(1),
        type: z.string().default("string"),
        nullable: z.boolean().default(true)
      })).default([]),
      operations: z.array(z.any()).default([]),
      loc: z.string().optional(),
      size: z.string().optional(),
    })).optional(),
    relations: z.array(z.object({
      from: z.string().min(1),
      to: z.string().min(1),
      type: z.enum([
        "association","aggregation","composition",
        "generalization","realization","dependency"
      ]).default("association"),
      fromMultiplicity: z.string().optional(),
      toMultiplicity: z.string().optional(),
    })).optional()
  })).default([])
});

// Tools para function-calling
const tools = [
  {
    type: "function",
    function: {
      name: "add_classes",
      description: "Crear/actualizar clases con atributos.",
      parameters: {
        type: "object",
        properties: {
          classes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                stereotype: { type: "string" },
                abstract: { type: "boolean" },
                attributes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      type: { type: "string" },
                      nullable: { type: "boolean" }
                    },
                    required: ["name"]
                  }
                }
              },
              required: ["name"]
            }
          }
        },
        required: ["classes"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "relate",
      description: "Relacionar clases con multiplicidad.",
      parameters: {
        type: "object",
        properties: {
          relations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                from: { type: "string" },
                to: { type: "string" },
                type: {
                  type: "string",
                  enum: ["association","aggregation","composition","generalization","realization","dependency"]
                },
                fromMultiplicity: { type: "string" },
                toMultiplicity: { type: "string" }
              },
              required: ["from","to"]
            }
          }
        },
        required: ["relations"]
      }
    }
  }
];

// POST /api/ai/diagram/act
router.post("/diagram/act", async (req, res) => {
  const { diagramId, projectId, userId, message } = req.body || {};
  if (!diagramId || !message) {
    return res.status(400).json({ error: "missing params" });
  }

  let client;
  let aiRunId = null;

  try {
    client = await pool.connect();

    // 1) registrar ai_run
    const ins = await client.query(
      `INSERT INTO ai_runs (project_id, diagram_id, user_id, action, prompt, status)
       VALUES ($1,$2,$3,'act',$4,'ok') RETURNING id`,
      [projectId ?? null, diagramId, userId ?? null, message]
    );
    aiRunId = ins.rows[0].id;

    // 2) invocar LLM
    const system = `Eres un asistente de modelado UML en un lienzo GoJS.
- Entiendes español.
- Usa SOLO las funciones (tools) para crear clases o relaciones.
- Si el usuario pide ambas, llama a ambas.
- No devuelvas texto libre: solo llamadas de función con argumentos válidos.`;

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const t0 = Date.now();

    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: message }
      ],
      tools,
      tool_choice: "auto"
    });
    const latency = Date.now() - t0;

    const calls = completion.choices?.[0]?.message?.tool_calls || [];
    const ops = [];
    for (const c of calls) {
      const name = c.function?.name;
      let args = {};
      try { args = JSON.parse(c.function?.arguments || "{}"); } catch {}
      if (name === "add_classes" && Array.isArray(args.classes)) {
        ops.push({ type: "add_classes", classes: args.classes });
      }
      if (name === "relate" && Array.isArray(args.relations)) {
        ops.push({ type: "relate", relations: args.relations });
      }
    }

    const parsed = OpsSchema.safeParse({ ops });
    if (!parsed.success) {
      await client.query(
        `UPDATE ai_runs SET status='error', error_msg='invalid ops', output_json=$1 WHERE id=$2`,
        [JSON.stringify({ ops }), aiRunId]
      );
      return res.status(400).json({ error: "invalid ops" });
    }

    await client.query(
      `UPDATE ai_runs
         SET output_json=$1, provider='openai', model=$2, latency_ms=$3, status='ok'
       WHERE id=$4`,
      [JSON.stringify(parsed.data), model, latency, aiRunId]
    );

    return res.json({ aiRunId, ...parsed.data });
  } catch (e) {
    console.error("[/api/ai/diagram/act] Error:", e); // 👈 verás el detalle en consola
    if (client && aiRunId) {
      try {
        await client.query(
          `UPDATE ai_runs SET status='error', error_msg=$1 WHERE id=$2`,
          [String(e?.message || e), aiRunId]
        );
      } catch {}
    }
    return res.status(500).json({ error: e?.message || "LLM/DB error" }); // 👈 manda el msg al front
  } finally {
    if (client) client.release();
  }
});

module.exports = router;
