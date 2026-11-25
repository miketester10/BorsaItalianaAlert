import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Bot } from "gramio";
import { currentPriceFromCallbackAlertsAttivi, currentPriceFromComandoPrezzo } from "../../src/handlers/bot/04-callbacks-data";
import type { MyCallbackQueryContext, MyMessageContext } from "../../src/types/custom-context.type";
import {
  createValidResponse,
  createNotFoundResponse,
  createNoPriceResponse,
} from "../fixtures/borsa-italiana-response";
import {
  createPriceProviderMock,
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
const { PriceCommands } = await loadCommandsHandler();
const { setupCallbacks } = await import("../../src/handlers/bot/03-callbacks-helper");

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
  let priceProvider: ReturnType<typeof createPriceProviderMock>;
  let priceCommands: InstanceType<typeof PriceCommands>;

  beforeEach(() => {
    resetSharedMocks();
    priceProvider = createPriceProviderMock();
    priceCommands = new PriceCommands(priceProvider);
    reply.mockClear();
    sendChatAction.mockClear();
  });

  test("rifiuta un ISIN mancante senza chiamare l'API", async () => {
    await priceCommands.handlePrezzoCommand(createContext("/prezzo"));

    expect(reply).toHaveBeenCalledTimes(1);
    expect(getReplyMessage()).toContain("Inserisci un ISIN valido.");
    expect(priceProvider.getPriceByIsin).not.toHaveBeenCalled();
  });

  test("rifiuta un ISIN non valido senza chiamare l'API", async () => {
    await priceCommands.handlePrezzoCommand(createContext("/prezzo ISIN-ERRATO"));

    expect(reply).toHaveBeenCalledTimes(1);
    expect(getReplyMessage()).toContain("Inserisci un ISIN valido.");
    expect(priceProvider.getPriceByIsin).not.toHaveBeenCalled();
  });

  test("gestisce una risposta API con prezzo valido", async () => {
    await priceCommands.handlePrezzoCommand(createContext("/prezzo IT0005518128"));

    expect(reply).toHaveBeenCalledTimes(1);
    expect(getReplyMessage()).toContain("Label: BTP PER I TEST");
    expect(getReplyMessage()).toContain("Prezzo: 100€");
    expect(priceProvider.getPriceByIsin).toHaveBeenCalledTimes(1);
    expect(handleError).not.toHaveBeenCalled();
  });

  test("usa il provider iniettato nei callback di aggiornamento prezzo", async () => {
    const callbackQuery = mock((_data: unknown, _handler: (ctx: MyCallbackQueryContext) => Promise<unknown>) => {});
    setupCallbacks({ callbackQuery } as unknown as Bot, priceCommands);
    const isin = "IT0005518128";
    priceProvider.getPriceByIsin.mockResolvedValue(createValidResponse(123));

    for (const callbackData of [currentPriceFromComandoPrezzo, currentPriceFromCallbackAlertsAttivi]) {
      const registration = callbackQuery.mock.calls.find(([data]) => data === callbackData);
      if (!registration) throw new Error("Callback di aggiornamento prezzo non registrato");
      const editText = mock(async (_message: unknown) => {});
      const answer = mock(async () => {});
      const ctx = { queryData: { isin, alertId: "alert-test" }, editText, answer } as unknown as MyCallbackQueryContext;

      await registration[1](ctx);

      expect(String(editText.mock.calls[0]?.[0])).toContain("Prezzo: 123€");
      expect(answer).toHaveBeenCalledTimes(1);
    }
    expect(priceProvider.getPriceByIsin).toHaveBeenCalledTimes(2);
    expect(priceProvider.getPriceByIsin).toHaveBeenCalledWith(isin);
  });

  test("gestisce un ISIN non trovato dall'API", async () => {
    priceProvider.getPriceByIsin.mockImplementation(async () => createNotFoundResponse());

    await priceCommands.handlePrezzoCommand(createContext("/prezzo IT0005518128"));

    expect(reply).toHaveBeenCalledTimes(1);
    expect(getReplyMessage()).toContain("ISIN non valido o non trovato.");
    expect(handleError).not.toHaveBeenCalled();
  });

  test("gestisce un prezzo assente", async () => {
    priceProvider.getPriceByIsin.mockImplementation(async () => createNoPriceResponse());

    await priceCommands.handlePrezzoCommand(createContext("/prezzo IT0005518128"));

    expect(reply).toHaveBeenCalledTimes(1);
    expect(getReplyMessage()).toContain("Prezzo non disponibile.");
    expect(handleError).not.toHaveBeenCalled();
  });

  test("gestisce un prezzo uguale a zero", async () => {
    priceProvider.getPriceByIsin.mockImplementation(async () => createValidResponse(0));

    await priceCommands.handlePrezzoCommand(createContext("/prezzo IT0005518128"));

    expect(reply).toHaveBeenCalledTimes(1);
    expect(getReplyMessage()).toContain("Prezzo non disponibile.");
    expect(handleError).not.toHaveBeenCalled();
  });

  test("inoltra gli errori API al gestore degli errori", async () => {
    priceProvider.getPriceByIsin.mockImplementation(async () => {
      throw new Error("Errore API simulato");
    });

    await priceCommands.handlePrezzoCommand(createContext("/prezzo IT0005518128"));

    expect(handleError).toHaveBeenCalledTimes(1);
    expect(reply).not.toHaveBeenCalled();
  });
});
