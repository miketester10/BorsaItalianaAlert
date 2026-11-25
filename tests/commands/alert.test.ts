import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Condition } from "@prisma/client";
import { createAlertFixture } from "../fixtures/alert";
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

  test("rifiuta un input non valido senza chiamare API o database", async () => {
    await commands.handleAlertCommand(createContext("/alert ISIN-ERRATO 10"));

    expect(reply).toHaveBeenCalledTimes(1);
    expect(getReplyMessage()).toContain("Inserisci un ISIN ed un prezzo valido.");
    expect(priceProvider.getPriceByIsin).not.toHaveBeenCalled();
    expect(alertRepository.findAlert).not.toHaveBeenCalled();
    expect(alertRepository.createAlert).not.toHaveBeenCalled();
  });

  test("rifiuta un prezzo mancante senza chiamare API o database", async () => {
    await commands.handleAlertCommand(createContext("/alert IT0005518128"));

    expect(reply).toHaveBeenCalledTimes(1);
    expect(getReplyMessage()).toContain("Inserisci un ISIN ed un prezzo valido.");
    expect(priceProvider.getPriceByIsin).not.toHaveBeenCalled();
    expect(alertRepository.findAlert).not.toHaveBeenCalled();
  });

  test("non ricrea un alert già registrato", async () => {
    alertRepository.findAlert.mockImplementation(async () => createAlertFixture({ id: "alert-esistente" }));

    await commands.handleAlertCommand(createContext("/alert IT0005518128 90"));

    expect(getReplyMessage()).toContain("Alert già registrato.");
    expect(alertRepository.createAlert).not.toHaveBeenCalled();
    expect(priceProvider.getPriceByIsin).not.toHaveBeenCalled();
  });

  test("registra un alert sopra soglia con condizione above", async () => {
    await commands.handleAlertCommand(createContext("/alert IT0005518128 90"));

    expect(getReplyMessage()).toContain("Alert registrato con successo.");
    expect(alertRepository.createAlert).toHaveBeenCalledTimes(1);
    expect(alertRepository.createAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        userTelegramId: 123,
        isin: "IT0005518128",
        alertPrice: 90,
        lastCondition: Condition.above,
        lastCheckPrice: 100,
      }),
    );
  });

  test("registra un alert sotto soglia con condizione below", async () => {
    await commands.handleAlertCommand(createContext("/alert IT0005518128 110"));

    expect(getReplyMessage()).toContain("Alert registrato con successo.");
    expect(alertRepository.createAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        lastCondition: Condition.below,
        lastCheckPrice: 100,
      }),
    );
  });

  test("registra con condizione equal se il prezzo è uguale alla soglia", async () => {
    await commands.handleAlertCommand(createContext("/alert IT0005518128 100"));

    expect(getReplyMessage()).toContain("Alert registrato con successo.");
    expect(alertRepository.createAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        lastCondition: Condition.equal,
        lastCheckPrice: 100,
      }),
    );
  });

  test("non registra nulla se l'ISIN non esiste", async () => {
    priceProvider.getPriceByIsin.mockImplementation(async () => createNotFoundResponse());

    await commands.handleAlertCommand(createContext("/alert IT0005518128 90"));

    expect(reply).toHaveBeenCalledTimes(1);
    expect(getReplyMessage()).toContain("ISIN non trovato. Nessun alert registrato.");
    expect(alertRepository.createAlert).not.toHaveBeenCalled();
  });

  test("non registra nulla se il prezzo non è disponibile", async () => {
    priceProvider.getPriceByIsin.mockImplementation(async () => createNoPriceResponse());

    await commands.handleAlertCommand(createContext("/alert IT0005518128 90"));

    expect(reply).toHaveBeenCalledTimes(1);
    expect(getReplyMessage()).toContain("Prezzo non disponibile. Nessun alert registrato.");
    expect(alertRepository.createAlert).not.toHaveBeenCalled();
  });

  test("non registra nulla se il prezzo è zero", async () => {
    priceProvider.getPriceByIsin.mockImplementation(async () => createValidResponse(0));

    await commands.handleAlertCommand(createContext("/alert IT0005518128 90"));

    expect(getReplyMessage()).toContain("Prezzo non disponibile. Nessun alert registrato.");
    expect(alertRepository.createAlert).not.toHaveBeenCalled();
  });

  test("inoltra gli errori API al gestore degli errori", async () => {
    priceProvider.getPriceByIsin.mockImplementation(async () => {
      throw new Error("Errore API simulato");
    });

    await commands.handleAlertCommand(createContext("/alert IT0005518128 90"));

    expect(reply).toHaveBeenCalledTimes(1);
    expect(getReplyMessage()).toContain("Si è verificato un errore. Riprova più tardi.");
    expect(alertRepository.createAlert).not.toHaveBeenCalled();
  });
});
