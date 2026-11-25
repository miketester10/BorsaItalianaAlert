import { beforeEach, describe, expect, mock, test } from "bun:test";
import { AlertCommands } from "../../src/handlers/bot/02-commands-helper";
import type { MyMessageContext } from "../../src/types/custom-context.type";
import {
  createValidResponse,
  createNotFoundResponse,
  createNoPriceResponse,
} from "../fixtures/borsa-italiana-response";
import { createAlertRepositoryMock, createPriceProviderMock } from "../helpers/shared-mocks";

// Simula la funzione che invia una risposta Telegram.
const reply = mock(async (..._args: unknown[]): Promise<void> => {});

// Simula l'azione Telegram "typing".
const sendChatAction = mock(async (_action: string): Promise<void> => {});

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
  let alertRepository: ReturnType<typeof createAlertRepositoryMock>;
  let priceProvider: ReturnType<typeof createPriceProviderMock>;
  let commands: AlertCommands;

  beforeEach(() => {
    alertRepository = createAlertRepositoryMock();
    priceProvider = createPriceProviderMock();
    commands = new AlertCommands(alertRepository, priceProvider);
    reply.mockClear();
    sendChatAction.mockClear();
  });

  test("rifiuta un ISIN mancante senza chiamare l'API", async () => {
    await commands.handlePrezzoCommand(createContext("/prezzo"));

    expect(reply).toHaveBeenCalledTimes(1);
    expect(getReplyMessage()).toContain("Inserisci un ISIN valido.");
    expect(priceProvider.getPriceByIsin).not.toHaveBeenCalled();
  });

  test("rifiuta un ISIN non valido senza chiamare l'API", async () => {
    await commands.handlePrezzoCommand(createContext("/prezzo ISIN-ERRATO"));

    expect(reply).toHaveBeenCalledTimes(1);
    expect(getReplyMessage()).toContain("Inserisci un ISIN valido.");
    expect(priceProvider.getPriceByIsin).not.toHaveBeenCalled();
  });

  test("gestisce una risposta API con prezzo valido", async () => {
    await commands.handlePrezzoCommand(createContext("/prezzo IT0005518128"));

    expect(reply).toHaveBeenCalledTimes(1);
    expect(getReplyMessage()).toContain("Label: BTP PER I TEST");
    expect(getReplyMessage()).toContain("Prezzo: 100€");
    expect(priceProvider.getPriceByIsin).toHaveBeenCalledTimes(1);
  });

  test("gestisce un ISIN non trovato dall'API", async () => {
    priceProvider.getPriceByIsin.mockImplementation(async () => createNotFoundResponse());

    await commands.handlePrezzoCommand(createContext("/prezzo IT0005518128"));

    expect(reply).toHaveBeenCalledTimes(1);
    expect(getReplyMessage()).toContain("ISIN non valido o non trovato.");
  });

  test("gestisce un prezzo assente", async () => {
    priceProvider.getPriceByIsin.mockImplementation(async () => createNoPriceResponse());

    await commands.handlePrezzoCommand(createContext("/prezzo IT0005518128"));

    expect(reply).toHaveBeenCalledTimes(1);
    expect(getReplyMessage()).toContain("Prezzo non disponibile.");
  });

  test("gestisce un prezzo uguale a zero", async () => {
    priceProvider.getPriceByIsin.mockImplementation(async () => createValidResponse(0));

    await commands.handlePrezzoCommand(createContext("/prezzo IT0005518128"));

    expect(reply).toHaveBeenCalledTimes(1);
    expect(getReplyMessage()).toContain("Prezzo non disponibile.");
  });

  test("inoltra gli errori API al gestore degli errori", async () => {
    priceProvider.getPriceByIsin.mockImplementation(async () => {
      throw new Error("Errore API simulato");
    });

    await commands.handlePrezzoCommand(createContext("/prezzo IT0005518128"));

    expect(reply).toHaveBeenCalledTimes(1);
    expect(getReplyMessage()).toContain("Si è verificato un errore. Riprova più tardi.");
  });
});
