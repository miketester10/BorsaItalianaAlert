import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { MyMessageContext } from "../../src/types/custom-context.type";
import {
  createValidResponse,
  createNotFoundResponse,
  createNoPriceResponse,
} from "../fixtures/borsa-italiana-response";
import {
  getPrice,
  handleError,
  loadCommandsHandler,
  registerCommandMocks,
  resetCommandMocks,
} from "../helpers/shared-mocks";

// Mock condivisi tra file: vedi shared-mocks (evita contaminazioni nel registry).
registerCommandMocks();

// Simula la funzione che invia una risposta Telegram.
const reply = mock(async (..._args: unknown[]): Promise<void> => {});

// Simula l'azione Telegram "typing".
const sendChatAction = mock(async (_action: string): Promise<void> => {});

// Import dinamico: i mock devono essere registrati prima del modulo testato.
const { handlePrezzoCommand } = await loadCommandsHandler();

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
    // Reset condiviso: default valido + pulizia chiamate (vedi shared-mocks).
    resetCommandMocks();
    reply.mockClear();
    sendChatAction.mockClear();
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
