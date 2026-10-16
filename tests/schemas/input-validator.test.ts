import { describe, expect, test } from "bun:test";
import { validatePrezzoInput, validateAlertInput } from "../../src/schemas/input-validator.schema";

// Testiamo la validazione dell'ISIN usata da /prezzo.
describe("validatePrezzoInput", () => {
  test("accetta un ISIN valido", () => {
    const result = validatePrezzoInput("IT0005518128");

    // La validazione deve riuscire.
    expect(result.success).toBe(true);

    // L'ISIN deve essere normalizzato in maiuscolo.
    if (result.success) {
      expect(result.data).toBe("IT0005518128");
    }
  });

  test("normalizza un ISIN scritto in minuscolo", () => {
    const result = validatePrezzoInput("it0005518128");

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data).toBe("IT0005518128");
    }
  });

  test("rifiuta un ISIN con formato non valido", () => {
    const result = validatePrezzoInput("ISIN-ERRATO");

    expect(result.success).toBe(false);
  });

  test("rifiuta un ISIN mancante", () => {
    const result = validatePrezzoInput(undefined);

    expect(result.success).toBe(false);
  });

  test("rifiuta un ISIN vuoto", () => {
    const result = validatePrezzoInput("");

    expect(result.success).toBe(false);
  });
});

// Testiamo la validazione degli input usati da /alert.
describe("validateAlertInput", () => {
  test("accetta ISIN e prezzo soglia validi", () => {
    const result = validateAlertInput("IT0005518128", "12.50");

    expect(result.success).toBe(true);

    if (result.success) {
      // L'ISIN viene normalizzato e il prezzo convertito in number.
      expect(result.data.isin).toBe("IT0005518128");
      expect(result.data.alertPrice).toBe(12.5);
    }
  });

  test("rifiuta un ISIN non valido", () => {
    const result = validateAlertInput("ERRATO", "12.50");

    expect(result.success).toBe(false);
  });

  test("rifiuta un prezzo non numerico", () => {
    const result = validateAlertInput("IT0005518128", "abc");

    expect(result.success).toBe(false);
  });

  test("rifiuta un prezzo Infinity", () => {
    const result = validateAlertInput("IT0005518128", "Infinity");

    expect(result.success).toBe(false);
  });

  test("rifiuta un prezzo uguale a zero", () => {
    const result = validateAlertInput("IT0005518128", "0");

    expect(result.success).toBe(false);
  });

  test("rifiuta un prezzo negativo", () => {
    const result = validateAlertInput("IT0005518128", "-5");

    expect(result.success).toBe(false);
  });

  test("rifiuta un prezzo mancante", () => {
    const result = validateAlertInput("IT0005518128", undefined);

    expect(result.success).toBe(false);
  });

  test("rifiuta un ISIN mancante", () => {
    const result = validateAlertInput(undefined, "12.50");

    expect(result.success).toBe(false);
  });
});
