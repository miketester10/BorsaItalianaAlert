import { describe, expect, test } from "bun:test";
import type { BorsaItalianaResponse } from "../../src/interfaces/borsa-italiana-response.interface";
import { getLastPriceStatus } from "../../src/interfaces/borsa-italiana-response.interface";
import { createValidResponse, createNotFoundResponse, createNoPriceResponse } from "../fixtures/borsa-italiana-response";

// Costruisce una risposta con endPx arbitrario (anche non valido).
const createRawPriceResponse = (endPx: unknown): BorsaItalianaResponse =>
  ({
    ...createValidResponse(100),
    intradayPoint: [{ endPx }],
  }) as unknown as BorsaItalianaResponse;

describe("getLastPriceStatus", () => {
  test("restituisce ok con prezzo e label su risposta valida", () => {
    expect(getLastPriceStatus(createValidResponse(99.5))).toEqual({
      kind: "ok",
      price: 99.5,
      label: "BTP PER I TEST",
    });
  });

  test("restituisce invalid su risposta senza intradayPoint", () => {
    expect(getLastPriceStatus(createNotFoundResponse()).kind).toBe("invalid");
  });

  test("restituisce nodata su intradayPoint vuoto", () => {
    const status = getLastPriceStatus(createNoPriceResponse());

    expect(status.kind).toBe("nodata");
    if (status.kind === "nodata") {
      expect(status.raw).toBeUndefined();
    }
  });

  test("restituisce nodata su endPx mancante", () => {
    expect(getLastPriceStatus(createRawPriceResponse(undefined)).kind).toBe("nodata");
  });

  test("restituisce nodata su endPx NaN", () => {
    const status = getLastPriceStatus(createRawPriceResponse(NaN));

    expect(status.kind).toBe("nodata");
    if (status.kind === "nodata") {
      expect(String(status.raw)).toBe("NaN");
    }
  });

  test("restituisce nodata su prezzo zero", () => {
    const status = getLastPriceStatus(createRawPriceResponse(0));

    expect(status.kind).toBe("nodata");
    if (status.kind === "nodata") {
      expect(status.raw).toBe(0);
    }
  });

  test("restituisce nodata su prezzo negativo", () => {
    expect(getLastPriceStatus(createRawPriceResponse(-5)).kind).toBe("nodata");
  });

  test("restituisce nodata su endPx non numerico", () => {
    const status = getLastPriceStatus(createRawPriceResponse("99"));

    expect(status.kind).toBe("nodata");
    if (status.kind === "nodata") {
      expect(status.raw).toBe("99");
    }
  });
});
