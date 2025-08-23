const { z } = require('zod');
require('dotenv').config();

const schema = z.object({
  NODE_ENV: z.enum(['development','test','production']).default('development'),
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
  REFRESH_EXPIRES: z.string().default('7d')
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Env inválido:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}
module.exports = parsed.data;
