import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { BorsaItalianaResponse } from "../../src/interfaces/borsa-italiana-response.interface";
import type { MyMessageContext } from "../../src/types/custom-context.type";
import {
  createValidResponse,
  createNotFoundResponse,
  createNoPriceResponse,
} from "../fixtures/borsa-italiana-response";
import { RawAxiosRequestHeaders } from "axios";

// Simula la chiamata API di Borsa Italiana.
const getPrice = mock(
  async (_api: string, _headers?: RawAxiosRequestHeaders): Promise<BorsaItalianaResponse> =>
    createValidResponse(100),
);

// Simula la funzione che invia una risposta Telegram.
const reply = mock(async (..._args: unknown[]): Promise<void> => {});

// Simula l'azione Telegram "typing".
const sendChatAction = mock(async (_action: string): Promise<void> => {});

// Simula il gestore degli errori.
const handleError = mock(async (_error: unknown, _ctx: MyMessageContext): Promise<void> => {});

// Sostituisce le dipendenze reali con mock.
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

mock.module("../../src/logger/logger", () => ({
  logger: {
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
  },
}));

mock.module("../../src/handlers/error/error-handler", () => ({
  errorHandler: handleError,
}));

// Import dinamico: i mock devono essere registrati prima del modulo testato.
const { handlePrezzoCommand } = await import("../../src/handlers/bot/02-commands-helper");

// Crea un contesto Telegram minimale per simulare un messaggio.
const createContext = (text: string): MyMessageContext => {
  const context = {
    update: {
      message: {
        text,
      },
    },
    from: { id: 123 },
    reply,
    sendChatAction,
  };

  // Il contesto è parziale: simuliamo soltanto le proprietà usate dal test.
  return context as unknown as MyMessageContext;
};

// Recupera il testo passato alla funzione reply.
const getReplyMessage = (): string => {
  // mock.calls è l'array che Bun usa per registrare tutte le chiamate.
  // [0] seleziona la prima chiamata effettuata a reply.
  // Il secondo [0] seleziona il primo argomento passato a quella chiamata,
  // cioè il messaggio che il bot vuole inviare.
  return String(reply.mock.calls[0]?.[0]);
};

describe("handlePrezzoCommand", () => {
  beforeEach(() => {
    // Reset completo: pulisce chiamate e implementazioni, poi ripristina il default valido.
    getPrice.mockReset();
    getPrice.mockImplementation(async () => createValidResponse(100));
    reply.mockClear();
    sendChatAction.mockClear();
    handleError.mockClear();
  });

  test("rifiuta un ISIN mancante senza chiamare l'API", async () => {
    await handlePrezzoCommand(createContext("/prezzo"));

    expect(reply).toHaveBeenCalledTimes(1);
    expect(getReplyMessage()).toContain("Inserisci un ISIN valido.");
    expect(getPrice).not.toHaveBeenCalled();
  });

  test("rifiuta un ISIN non valido senza chiamare l'API", async () => {
    await handlePrezzoCommand(createContext("/prezzo ISIN-ERRATO"));

    expect(reply).toHaveBeenCalledTimes(1);
    expect(getReplyMessage()).toContain("Inserisci un ISIN valido.");
    expect(getPrice).not.toHaveBeenCalled();
  });

  test("gestisce una risposta API con prezzo valido", async () => {
    await handlePrezzoCommand(createContext("/prezzo IT0005518128"));

    expect(reply).toHaveBeenCalledTimes(1);
    expect(getReplyMessage()).toContain("Label: BTP PER I TEST");
    expect(getReplyMessage()).toContain("Prezzo: 100€");
    expect(getPrice).toHaveBeenCalledTimes(1);
    expect(handleError).not.toHaveBeenCalled();
  });

  test("gestisce un ISIN non trovato dall'API", async () => {
    getPrice.mockImplementation(async () => createNotFoundResponse());

    await handlePrezzoCommand(createContext("/prezzo IT0005518128"));

    expect(reply).toHaveBeenCalledTimes(1);
    expect(getReplyMessage()).toContain("ISIN non valido o non trovato.");
    expect(handleError).not.toHaveBeenCalled();
  });

  test("gestisce un prezzo assente", async () => {
    getPrice.mockImplementation(async () => createNoPriceResponse());

    await handlePrezzoCommand(createContext("/prezzo IT0005518128"));

    expect(reply).toHaveBeenCalledTimes(1);
    expect(getReplyMessage()).toContain("Prezzo non disponibile.");
    expect(handleError).not.toHaveBeenCalled();
  });

  test("gestisce un prezzo uguale a zero", async () => {
    getPrice.mockImplementation(async () => createValidResponse(0));

    await handlePrezzoCommand(createContext("/prezzo IT0005518128"));

    expect(reply).toHaveBeenCalledTimes(1);
    expect(getReplyMessage()).toContain("Prezzo non disponibile.");
    expect(handleError).not.toHaveBeenCalled();
  });

  test("inoltra gli errori API al gestore degli errori", async () => {
    getPrice.mockImplementation(async () => {
      throw new Error("Errore API simulato");
    });

    await handlePrezzoCommand(createContext("/prezzo IT0005518128"));

    expect(handleError).toHaveBeenCalledTimes(1);
    expect(reply).not.toHaveBeenCalled();
  });
});
