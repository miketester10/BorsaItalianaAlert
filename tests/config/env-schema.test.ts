import { describe, expect, test } from "bun:test";
import { envSchema } from "../../src/config/env.schema";

// Base valida: ogni test varia un solo campo.
const createValidEnv = (): Record<string, string> => ({
  BOT_TOKEN: "token-test",
  OWNER_TELEGRAM_ID: "123456",
  DATABASE_URL: "mongodb://localhost:27017/test",
  BORSA_ITALIANA_API: "https://example.test/",
  BORSA_ITALIANA_API_TAIL: "/tail",
  BORSA_ITALIANA_JWT: "jwt-test",
  PORT: "3000",
});

describe("envSchema", () => {
  test("accetta un env completo e valido", () => {
    const result = envSchema.safeParse({ ...createValidEnv(), NODE_ENV: "production", KOFI_DELAY_MS: "500" });

    expect(result.success).toBe(true);
  });

  test("applica i default a NODE_ENV e KOFI_DELAY_MS", () => {
    const result = envSchema.safeParse(createValidEnv());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NODE_ENV).toBe("development");
      expect(result.data.KOFI_DELAY_MS).toBe(500);
    }
  });

  test("converte le stringhe numeriche nei tipi corretti", () => {
    const result = envSchema.safeParse(createValidEnv());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.OWNER_TELEGRAM_ID).toBe(123456);
      expect(result.data.PORT).toBe(3000);
    }
  });

  test("rifiuta un OWNER_TELEGRAM_ID non numerico (prima era NaN silenzioso)", () => {
    const result = envSchema.safeParse({ ...createValidEnv(), OWNER_TELEGRAM_ID: "abc" });

    expect(result.success).toBe(false);
  });

  test("rifiuta un JWT mancante (prima era Bearer undefined)", () => {
    const env = createValidEnv();
    delete env.BORSA_ITALIANA_JWT;

    expect(envSchema.safeParse(env).success).toBe(false);
  });

  test("rifiuta un BOT_TOKEN vuoto", () => {
    expect(envSchema.safeParse({ ...createValidEnv(), BOT_TOKEN: "" }).success).toBe(false);
  });

  test("rifiuta una PORT fuori range", () => {
    expect(envSchema.safeParse({ ...createValidEnv(), PORT: "99999" }).success).toBe(false);
  });

  test("rifiuta un NODE_ENV non previsto", () => {
    expect(envSchema.safeParse({ ...createValidEnv(), NODE_ENV: "staging" }).success).toBe(false);
  });
});
