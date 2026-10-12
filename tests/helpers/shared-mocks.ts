import { mock } from "bun:test";
import { Condition, type Alert } from "@prisma/client";
import type { RawAxiosRequestHeaders } from "axios";
import type { BorsaItalianaResponse } from "../../src/interfaces/borsa-italiana-response.interface";
import type { MyMessageContext } from "../../src/types/custom-context.type";
import { createValidResponse } from "../fixtures/borsa-italiana-response";

/**
 * Mock condivisi tra tutti i file di test.
 *
 * Il modulo sotto test (`02-commands-helper`) è valutato una sola volta nel
 * registry condiviso di `bun test`: se ogni file registrasse i propri mock,
 * il secondo file riuserebbe i mock del primo (contaminazione). Usando gli
 * stessi oggetti ovunque, ogni file vede mock coerenti sia in corsa singola
 * che congiunta (con o senza `--isolate`).
 */

// Simula la chiamata API di Borsa Italiana.
export const getPrice = mock(
  async (_api: string, _headers?: RawAxiosRequestHeaders): Promise<BorsaItalianaResponse> =>
    createValidResponse(100),
);

// Simula le query di lettura e scrittura degli alert.
export const findAlert = mock(async (): Promise<Alert | null> => null);
export const createAlert = mock(async (): Promise<void> => {});

// Simula il gestore degli errori.
export const handleError = mock(async (_error: unknown, _ctx: MyMessageContext): Promise<void> => {});

// Silenzia i log nei test (mai asserito).
const silentLog = mock(() => ({}));

// Registra tutti i mock di modulo. Da chiamare prima del dynamic import.
export const registerCommandMocks = (): void => {
  mock.module("../../src/config/env", () => ({
    env: {
      BORSA_ITALIANA_API: "https://example.test/",
      BORSA_ITALIANA_API_TAIL: "api-tail",
      BORSA_ITALIANA_JWT: "jwt-test-token",
    },
  }));

  mock.module("../../src/handlers/api/api-handler", () => ({
    ApiHandler: {
      getInstance: () => ({ getPrice }),
    },
  }));

  mock.module("../../src/handlers/database/database-handler", () => ({
    DatabaseHandler: {
      getInstance: () => ({ findAlert, createAlert }),
    },
  }));

  mock.module("../../src/handlers/alert/alert-handler", () => ({
    AlertHandler: {
      // Replica la logica reale: sopra soglia, sotto soglia, uguale.
      getInstance: () => ({
        calculateCondition: (currentPrice: number, alertPrice: number): Condition => {
          if (currentPrice > alertPrice) return Condition.above;
          if (currentPrice < alertPrice) return Condition.below;
          return Condition.equal;
        },
      }),
    },
  }));

  mock.module("../../src/logger/logger", () => ({
    logger: {
      info: silentLog,
      warn: silentLog,
      error: silentLog,
    },
  }));

  mock.module("../../src/handlers/error/error-handler", () => ({
    errorHandler: handleError,
  }));
};

// Ripristina i default prima di ogni test. I singoli test sovrascrivono quando serve.
export const resetCommandMocks = (): void => {
  getPrice.mockReset();
  getPrice.mockImplementation(async () => createValidResponse(100));
  findAlert.mockReset();
  findAlert.mockImplementation(async () => null);
  createAlert.mockClear();
  handleError.mockClear();
  silentLog.mockClear();
};

// Carica il modulo sotto test dopo la registrazione dei mock.
export const loadCommandsHandler = (): Promise<typeof import("../../src/handlers/bot/02-commands-helper")> =>
  import("../../src/handlers/bot/02-commands-helper");
