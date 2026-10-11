import { envSchema, type Env } from "./env.schema";

/**
 * Variabili d'ambiente validate, fail-fast all'avvio.
 * Importare per primo in `src/main.ts`: se una var manca o non è valida,
 * lancia subito con la lista degli errori invece di fallire a runtime
 * (`NaN`, `Bearer undefined`, porte invalide).
 */
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  throw new Error(`❌ Variabili d'ambiente non valide: ${details}`);
}

export const env: Env = parsed.data;
