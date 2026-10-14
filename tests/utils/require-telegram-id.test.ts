import { describe, expect, test } from "bun:test";
import type { MyMessageContext } from "../../src/types/custom-context.type";
import { requireTelegramId } from "../../src/utils/telegram-id.util";

// Costruisce un contesto minimo con mittente configurabile.
const createContext = (from?: unknown): MyMessageContext =>
  ({
    from,
  }) as unknown as MyMessageContext;

describe("requireTelegramId", () => {
  test("restituisce l'id quando il mittente esiste e l'id è un numero", () => {
    expect(requireTelegramId(createContext({ id: 123 }))).toBe(123);
  });

  test("lancia errore quando il mittente manca", () => {
    expect(() => requireTelegramId(createContext(undefined))).toThrow(
      "Telegram ID mittente mancante",
    );
  });

  test("lancia errore quando l'id non è un numero", () => {
    expect(() => requireTelegramId(createContext({ id: "123" }))).toThrow(
      "Telegram ID mittente mancante",
    );
  });
});
