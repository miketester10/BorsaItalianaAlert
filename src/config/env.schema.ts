import { z } from "zod";

/**
 * Schema di validazione delle variabili d'ambiente.
 * Tutte le var lette da `process.env` devono passare da qui:
 * nessun altro file del progetto deve leggere `process.env` direttamente.
 */
export const envSchema = z.object({
  BOT_TOKEN: z.string().min(1, "BOT_TOKEN è richiesto"),
  OWNER_TELEGRAM_ID: z.coerce.number().int().positive("OWNER_TELEGRAM_ID deve essere un intero positivo"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL è richiesto"),
  BORSA_ITALIANA_API: z.string().min(1, "BORSA_ITALIANA_API è richiesto"),
  BORSA_ITALIANA_API_TAIL: z.string().min(1, "BORSA_ITALIANA_API_TAIL è richiesto"),
  BORSA_ITALIANA_JWT: z.string().min(1, "BORSA_ITALIANA_JWT è richiesto"),
  PORT: z.coerce.number().int().min(1).max(65535),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  KOFI_DELAY_MS: z.coerce.number().int().min(100).default(500),
});

export type Env = z.infer<typeof envSchema>;
