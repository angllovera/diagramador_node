const { z } = require('zod');
require('dotenv').config();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3000),

  PGHOST: z.string(),
  PGPORT: z.coerce.number().int().default(5432),
  PGUSER: z.string(),
  PGPASSWORD: z.string(),
  PGDATABASE: z.string(),
  PGSSL: z.string().transform(v => v === 'true').default('false'),

  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES: z.string().default('15m'),
  REFRESH_SECRET: z.string().min(16),
  REFRESH_EXPIRES: z.string().default('7d'),

  // 🔑 Nuevas claves para compartir diagramas
  SHARE_JWT_SECRET: z.string().min(16),                                   // obligatorio
  SHARE_DEFAULT_TTL_HOURS: z.coerce.number().int().default(168),          // por defecto 7 días
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:5173')      // origen del front
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Env inválido:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

module.exports = parsed.data;
