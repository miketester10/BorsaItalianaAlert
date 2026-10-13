import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Condition, type Alert } from "@prisma/client";
import type { MyMessageContext } from "../../src/types/custom-context.type";
import {
  createValidResponse,
  createNotFoundResponse,
  createNoPriceResponse,
} from "../fixtures/borsa-italiana-response";
import {
  createAlert,
  findAlert,
  getPriceByIsin,
  handleError,
  loadCommandsHandler,
  registerCommandMocks,
  resetSharedMocks,
} from "../helpers/shared-mocks";

// Mock condivisi tra file: vedi shared-mocks (evita contaminazioni nel registry).
registerCommandMocks();

// Simula la funzione che invia una risposta Telegram.
const reply = mock(async (..._args: unknown[]): Promise<void> => {});

// Simula l'azione Telegram "typing".
const sendChatAction = mock(async (_action: string): Promise<void> => {});

// Import dinamico: i mock devono essere registrati prima del modulo testato.
const { handleAlertCommand } = await loadCommandsHandler();

// Crea un contesto Telegram minimale per simulare un messaggio.
const createContext = (text: string): MyMessageContext => {
  const context = {
    update: {
      message: {
        text,
      },
    },
    from: { id: 123, firstName: "Tester" },
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

describe("handleAlertCommand", () => {
  beforeEach(() => {
    // Reset condiviso: default valido + pulizia chiamate (vedi shared-mocks).
    resetSharedMocks();
    reply.mockClear();
    sendChatAction.mockClear();
  });

  test("rifiuta un input non valido senza chiamare API o database", async () => {
    await handleAlertCommand(createContext("/alert ISIN-ERRATO 10"));

    expect(reply).toHaveBeenCalledTimes(1);
    expect(getReplyMessage()).toContain("Inserisci un ISIN ed un prezzo valido.");
    expect(getPriceByIsin).not.toHaveBeenCalled();
    expect(findAlert).not.toHaveBeenCalled();
    expect(createAlert).not.toHaveBeenCalled();
  });

  test("rifiuta un prezzo mancante senza chiamare API o database", async () => {
    await handleAlertCommand(createContext("/alert IT0005518128"));

    expect(reply).toHaveBeenCalledTimes(1);
    expect(getReplyMessage()).toContain("Inserisci un ISIN ed un prezzo valido.");
    expect(getPriceByIsin).not.toHaveBeenCalled();
    expect(findAlert).not.toHaveBeenCalled();
  });

  test("non ricrea un alert già registrato", async () => {
    findAlert.mockImplementation(async () => ({ id: "alert-esistente" }) as unknown as Alert);

    await handleAlertCommand(createContext("/alert IT0005518128 90"));

    expect(getReplyMessage()).toContain("Alert già registrato.");
    expect(createAlert).not.toHaveBeenCalled();
    expect(getPriceByIsin).not.toHaveBeenCalled();
    expect(handleError).not.toHaveBeenCalled();
  });

  test("registra un alert sopra soglia con condizione above", async () => {
    await handleAlertCommand(createContext("/alert IT0005518128 90"));

    expect(getReplyMessage()).toContain("Alert registrato con successo.");
    expect(createAlert).toHaveBeenCalledTimes(1);
    expect(createAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        userTelegramId: 123,
        isin: "IT0005518128",
        alertPrice: 90,
        lastCondition: Condition.above,
        lastCheckPrice: 100,
      }),
    );
    expect(handleError).not.toHaveBeenCalled();
  });

  test("registra un alert sotto soglia con condizione below", async () => {
    await handleAlertCommand(createContext("/alert IT0005518128 110"));

    expect(getReplyMessage()).toContain("Alert registrato con successo.");
    expect(createAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        lastCondition: Condition.below,
        lastCheckPrice: 100,
      }),
    );
  });

  test("registra con condizione equal se il prezzo è uguale alla soglia", async () => {
    await handleAlertCommand(createContext("/alert IT0005518128 100"));

    expect(getReplyMessage()).toContain("Alert registrato con successo.");
    expect(createAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        lastCondition: Condition.equal,
        lastCheckPrice: 100,
      }),
    );
    expect(handleError).not.toHaveBeenCalled();
  });

  test("non registra nulla se l'ISIN non esiste", async () => {
    getPriceByIsin.mockImplementation(async () => createNotFoundResponse());

    await handleAlertCommand(createContext("/alert IT0005518128 90"));

    expect(reply).toHaveBeenCalledTimes(1);
    expect(getReplyMessage()).toContain("ISIN non trovato. Nessun alert registrato.");
    expect(createAlert).not.toHaveBeenCalled();
    expect(handleError).not.toHaveBeenCalled();
  });

  test("non registra nulla se il prezzo non è disponibile", async () => {
    getPriceByIsin.mockImplementation(async () => createNoPriceResponse());

    await handleAlertCommand(createContext("/alert IT0005518128 90"));

    expect(reply).toHaveBeenCalledTimes(1);
    expect(getReplyMessage()).toContain("Prezzo non disponibile. Nessun alert registrato.");
    expect(createAlert).not.toHaveBeenCalled();
    expect(handleError).not.toHaveBeenCalled();
  });

  test("non registra nulla se il prezzo è zero", async () => {
    getPriceByIsin.mockImplementation(async () => createValidResponse(0));

    await handleAlertCommand(createContext("/alert IT0005518128 90"));

    expect(getReplyMessage()).toContain("Prezzo non disponibile. Nessun alert registrato.");
    expect(createAlert).not.toHaveBeenCalled();
  });

  test("inoltra gli errori API al gestore degli errori", async () => {
    getPriceByIsin.mockImplementation(async () => {
      throw new Error("Errore API simulato");
    });

    await handleAlertCommand(createContext("/alert IT0005518128 90"));

    expect(handleError).toHaveBeenCalledTimes(1);
    expect(createAlert).not.toHaveBeenCalled();
  });
});
