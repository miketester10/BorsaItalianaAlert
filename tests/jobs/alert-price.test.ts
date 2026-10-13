import { beforeEach, describe, expect, test } from "bun:test";
import { Condition, UserStatus } from "@prisma/client";
import { TelegramError } from "gramio";
import {
  createValidResponse,
  createNotFoundResponse,
  createNoPriceResponse,
} from "../fixtures/borsa-italiana-response";
import { createAlertFixture } from "../fixtures/alert";
import {
  botSendMessage,
  findAllAlerts,
  getPrice,
  resetSharedMocks,
  registerCommandMocks,
  updateAlert,
  updateUserStatus,
} from "../helpers/shared-mocks";

// Mock condivisi tra file: vedi shared-mocks (evita contaminazioni nel registry).
registerCommandMocks();

// Import dinamico: i mock devono essere registrati prima del modulo testato.
const { AlertHandler } = await import("../../src/handlers/alert/alert-handler");

// Simula un utente che ha bloccato il bot durante l'invio.
const createBlockedError = (): TelegramError<"sendMessage"> =>
  new TelegramError(
    { ok: false, error_code: 403, description: "Forbidden: bot was blocked by the user" },
    "sendMessage",
    { chat_id: 123, text: "test" },
  );

describe("checkAndNotifyAlerts", () => {
  beforeEach(() => {
    // Reset condiviso: default risposta valida e lista vuota (vedi shared-mocks).
    resetSharedMocks();
  });

  test("non chiama l'API senza alert attivi", async () => {
    findAllAlerts.mockImplementation(async () => []);

    await AlertHandler.getInstance().checkAndNotifyAlerts();

    expect(findAllAlerts).toHaveBeenCalledWith({ onlyActiveUsers: true });
    expect(getPrice).not.toHaveBeenCalled();
    expect(botSendMessage).not.toHaveBeenCalled();
  });

  test("notifica il superamento della soglia e aggiorna l'alert", async () => {
    findAllAlerts.mockImplementation(async () => [createAlertFixture()]);

    await AlertHandler.getInstance().checkAndNotifyAlerts();

    expect(findAllAlerts).toHaveBeenCalledWith({ onlyActiveUsers: true });
    expect(getPrice).toHaveBeenCalled();
    expect(botSendMessage).toHaveBeenCalledTimes(1);
    expect(botSendMessage).toHaveBeenCalledWith(expect.objectContaining({ chat_id: 123 }));
    expect(updateAlert).toHaveBeenCalledTimes(1);
    expect(updateAlert).toHaveBeenCalledWith({
      id: "alert-test-1",
      lastCondition: Condition.above,
      lastCheckPrice: 100,
    });
  });

  test("notifica la discesa sotto la soglia", async () => {
    findAllAlerts.mockImplementation(async () => [
      createAlertFixture({ alertPrice: 110, lastCondition: Condition.above, lastCheckPrice: 120 }),
    ]);

    await AlertHandler.getInstance().checkAndNotifyAlerts();

    expect(findAllAlerts).toHaveBeenCalledWith({ onlyActiveUsers: true });
    expect(getPrice).toHaveBeenCalled();
    expect(botSendMessage).toHaveBeenCalledTimes(1);
    expect(botSendMessage).toHaveBeenCalledWith(expect.objectContaining({ chat_id: 123 }));
    expect(updateAlert).toHaveBeenCalledTimes(1);
    expect(updateAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "alert-test-1",
        lastCondition: Condition.below,
        lastCheckPrice: 100,
      }),
    );
  });

  test("non notifica a condizione invariata", async () => {
    findAllAlerts.mockImplementation(async () => [
      createAlertFixture({ alertPrice: 95, lastCondition: Condition.above, lastCheckPrice: 120 }),
    ]);

    await AlertHandler.getInstance().checkAndNotifyAlerts();

    expect(botSendMessage).not.toHaveBeenCalled();
    expect(updateAlert).not.toHaveBeenCalled();
  });

  test("non notifica su prezzo uguale alla soglia", async () => {
    findAllAlerts.mockImplementation(async () => [createAlertFixture({ alertPrice: 100 })]);

    await AlertHandler.getInstance().checkAndNotifyAlerts();

    expect(botSendMessage).not.toHaveBeenCalled();
    expect(updateAlert).not.toHaveBeenCalled();
  });

  test("chiama l'API una sola volta per ISIN condiviso", async () => {
    findAllAlerts.mockImplementation(async () => [
      createAlertFixture({ id: "alert-test-1"}),
      createAlertFixture({
        id: "alert-test-2",
        alertPrice: 110,
        lastCondition: Condition.above,
        lastCheckPrice: 120,
      }),
    ]);

    await AlertHandler.getInstance().checkAndNotifyAlerts();

    expect(getPrice).toHaveBeenCalledTimes(1);
    expect(botSendMessage).toHaveBeenCalledTimes(2);
  });

  test("salta l'ISIN non valido ed elabora gli altri", async () => {
    getPrice.mockImplementation(async (api: string) =>
      api.includes("IT0005518128") ? createValidResponse(100) : createNotFoundResponse(),
    );
    findAllAlerts.mockImplementation(async () => [
      createAlertFixture({ id: "alert-test-1", isin: "IT0005518128", alertPrice: 95 }),
      createAlertFixture({ id: "alert-test-2", isin: "XX0000000000", alertPrice: 95 }),
    ]);

    await AlertHandler.getInstance().checkAndNotifyAlerts();

    expect(botSendMessage).toHaveBeenCalledTimes(1);
    expect(updateAlert).toHaveBeenCalledTimes(1);
  });

  test("salta l'ISIN in errore ed elabora gli altri", async () => {
    getPrice.mockImplementation(async (api: string) => {
      if (api.includes("XX0000000000")) throw new Error("Errore API simulato");
      return createValidResponse(100);
    });
    findAllAlerts.mockImplementation(async () => [
      createAlertFixture({ id: "alert-test-1", isin: "IT0005518128", alertPrice: 95 }),
      createAlertFixture({ id: "alert-test-2", isin: "XX0000000000", alertPrice: 95 }),
    ]);

    await AlertHandler.getInstance().checkAndNotifyAlerts();

    expect(botSendMessage).toHaveBeenCalledTimes(1);
    expect(updateAlert).toHaveBeenCalledTimes(1);
  });

  test("salta l'ISIN senza prezzo ed elabora gli altri", async () => {
    getPrice.mockImplementation(async () => createNoPriceResponse());
    findAllAlerts.mockImplementation(async () => [createAlertFixture()]);

    await AlertHandler.getInstance().checkAndNotifyAlerts();

    expect(botSendMessage).not.toHaveBeenCalled();
    expect(updateAlert).not.toHaveBeenCalled();
  });

  test("marca blocked senza aggiornare l'alert e continua", async () => {
    botSendMessage.mockImplementation(async () => {
      throw createBlockedError();
    });
    findAllAlerts.mockImplementation(async () => [
      createAlertFixture({ id: "alert-test-1", alertPrice: 95 }),
      createAlertFixture({
        id: "alert-test-2",
        alertPrice: 110,
        lastCondition: Condition.above,
        lastCheckPrice: 120,
      }),
    ]);

    await AlertHandler.getInstance().checkAndNotifyAlerts();

    expect(botSendMessage).toHaveBeenCalledTimes(2);
    expect(updateUserStatus).toHaveBeenCalledTimes(2);
    expect(updateUserStatus).toHaveBeenCalledWith(123, UserStatus.blocked);
    expect(updateAlert).not.toHaveBeenCalled();
  });

  test("continua con gli altri se l'aggiornamento fallisce", async () => {
    updateAlert.mockImplementation(async () => {
      throw new Error("Errore DB simulato");
    });
    findAllAlerts.mockImplementation(async () => [
      createAlertFixture({ id: "alert-test-1", alertPrice: 95 }),
      createAlertFixture({ id: "alert-test-2", alertPrice: 95 }),
    ]);

    await AlertHandler.getInstance().checkAndNotifyAlerts();

    expect(botSendMessage).toHaveBeenCalledTimes(2);
  });
});
