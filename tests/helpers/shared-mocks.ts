import { mock } from "bun:test";
import type { Alert } from "@prisma/client";
import type { BorsaItalianaResponse } from "../../src/interfaces/borsa-italiana-response.interface";
import type { MyMessageContext } from "../../src/types/custom-context.type";
import { createValidResponse } from "../fixtures/borsa-italiana-response";

/**
 * Mock condivisi tra tutti i file di test.
 *
 * Il modulo sotto test è valutato una sola volta nel registry condiviso di
 * `bun test`: se ogni file registrasse i propri mock, il secondo file
 * riuserebbe i mock del primo (contaminazione). Usando gli stessi oggetti
 * ovunque, ogni file vede mock coerenti sia in corsa singola che congiunta
 * (con o senza `--isolate`).
 *
 * `AlertHandler` non è mockato di proposito: i metodi usati nei test
 * (`calculateCondition`) sono puri e restano quelli reali.
 */

// Simula la chiamata API di Borsa Italiana per ISIN.
export const getPriceByIsin = mock(
  async (_isin: string): Promise<BorsaItalianaResponse> => createValidResponse(100),
);

// Simula le query del database (superset: copre comandi e job).
export const findAllAlerts = mock(async (): Promise<Alert[]> => []);
export const findAlert = mock(async (): Promise<Alert | null> => null);
export const createAlert = mock(async (): Promise<void> => {});
export const updateAlert = mock(async (): Promise<void> => {});
export const updateUserStatus = mock(async (): Promise<void> => {});

// Simula l'invio Telegram del job (BotHandler reale mai istanziato nei test).
export const botSendMessage = mock(async (): Promise<unknown> => ({}));

// Simula il gestore degli errori.
export const handleError = mock(async (_error: unknown, _ctx: MyMessageContext): Promise<void> => {});

// Silenzia i log nei test (mai asserito).
const silentLog = mock((): unknown => ({}));

// Registra tutti i mock di modulo. Da chiamare prima del dynamic import.
export const registerCommandMocks = (): void => {
  mock.module("../../src/config/env", () => ({
    env: {
      BORSA_ITALIANA_API: "https://example.test/",
      BORSA_ITALIANA_API_TAIL: "api-tail",
      BORSA_ITALIANA_JWT: "jwt-test-token",
      PORT: 3999, // Porta fissa fuori dalle comuni: mai la 3000 di default, per non confliggere col bot acceso in dev o altri servizi in CI.
    },
  }));

  mock.module("../../src/handlers/api/api-handler", () => ({
    ApiHandler: {
      getInstance: () => ({ getPriceByIsin }),
    },
  }));

  mock.module("../../src/handlers/database/database-handler", () => ({
    DatabaseHandler: {
      getInstance: () => ({ findAllAlerts, findAlert, createAlert, updateAlert, updateUserStatus }),
    },
  }));

  mock.module("../../src/handlers/bot/00-bot-handler", () => ({
    BotHandler: {
      getInstance: () => ({ bot: { api: { sendMessage: botSendMessage } } }),
    },
  }));

  mock.module("../../src/logger/logger", () => ({
    logger: {
      info: silentLog,
      warn: silentLog,
      error: silentLog,
      debug: silentLog,
    },
  }));

  mock.module("../../src/handlers/error/error-handler", () => ({
    errorHandler: handleError,
  }));
};

// Ripristina i default prima di ogni test. I singoli test sovrascrivono quando serve.
export const resetSharedMocks = (): void => {
  getPriceByIsin.mockReset();
  getPriceByIsin.mockImplementation(async () => createValidResponse(100));
  findAllAlerts.mockReset();
  findAllAlerts.mockImplementation(async () => []);
  findAlert.mockReset();
  findAlert.mockImplementation(async () => null);
  createAlert.mockClear();
  updateAlert.mockClear();
  updateUserStatus.mockClear();
  botSendMessage.mockClear();
  handleError.mockClear();
  silentLog.mockClear();
};

// Carica il modulo sotto test dopo la registrazione dei mock.
export const loadCommandsHandler = (): Promise<typeof import("../../src/handlers/bot/02-commands-helper")> =>
  import("../../src/handlers/bot/02-commands-helper");
