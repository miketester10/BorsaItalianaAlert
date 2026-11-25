import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { Condition, UserStatus } from "@prisma/client";
import { CronJob } from "cron";
import { type FormattableString, TelegramError } from "gramio";
import { AlertHandler } from "../../src/handlers/alert/alert-handler";
import { TelegramNotificationService } from "../../src/handlers/notification/telegram-notification.service";
import { AlertPriceJob } from "../../src/jobs/alert-price.job";
import {
  createValidResponse,
  createNotFoundResponse,
  createNoPriceResponse,
} from "../fixtures/borsa-italiana-response";
import { createAlertFixture } from "../fixtures/alert";
import {
  createAlertRepositoryMock,
  createPriceProviderMock,
  createUserStatusRepositoryMock,
} from "../helpers/shared-mocks";

// Simula un utente che ha bloccato il bot durante l'invio.
const createBlockedError = (): TelegramError<"sendMessage"> =>
  new TelegramError(
    { ok: false, error_code: 403, description: "Forbidden: bot was blocked by the user" },
    "sendMessage",
    { chat_id: 123, text: "test" },
  );

describe("checkAndNotifyAlerts", () => {
  let alertRepository: ReturnType<typeof createAlertRepositoryMock>;
  let userRepository: ReturnType<typeof createUserStatusRepositoryMock>;
  let priceProvider: ReturnType<typeof createPriceProviderMock>;
  const botSendMessage = mock(async (_params: { chat_id: number; text: FormattableString }): Promise<void> => {});
  let alertHandler: AlertHandler;

  beforeEach(() => {
    alertRepository = createAlertRepositoryMock();
    userRepository = createUserStatusRepositoryMock();
    priceProvider = createPriceProviderMock();
    botSendMessage.mockReset();
    botSendMessage.mockImplementation(async () => {});
    const notificationService = new TelegramNotificationService({ sendMessage: botSendMessage });
    alertHandler = new AlertHandler(alertRepository, userRepository, priceProvider, notificationService);
  });

  test("non chiama l'API senza alert attivi", async () => {
    alertRepository.findAllAlerts.mockImplementation(async () => []);

    await alertHandler.checkAndNotifyAlerts();

    expect(alertRepository.findAllAlerts).toHaveBeenCalledWith({ onlyActiveUsers: true });
    expect(priceProvider.getPriceByIsin).not.toHaveBeenCalled();
    expect(botSendMessage).not.toHaveBeenCalled();
  });

  test("notifica il superamento della soglia e aggiorna l'alert", async () => {
    alertRepository.findAllAlerts.mockImplementation(async () => [createAlertFixture()]);

    await alertHandler.checkAndNotifyAlerts();

    expect(alertRepository.findAllAlerts).toHaveBeenCalledWith({ onlyActiveUsers: true });
    expect(priceProvider.getPriceByIsin).toHaveBeenCalled();
    expect(botSendMessage).toHaveBeenCalledTimes(1);
    expect(botSendMessage).toHaveBeenCalledWith(expect.objectContaining({ chat_id: 123 }));
    expect(String(botSendMessage.mock.calls[0][0].text)).toContain("SUPERATO");
    expect(alertRepository.updateAlert).toHaveBeenCalledTimes(1);
    expect(alertRepository.updateAlert).toHaveBeenCalledWith({
      id: "alert-test-1",
      lastCondition: Condition.above,
      lastCheckPrice: 100,
    });
  });

  test("notifica la discesa sotto la soglia", async () => {
    alertRepository.findAllAlerts.mockImplementation(async () => [
      createAlertFixture({ alertPrice: 110, lastCondition: Condition.above, lastCheckPrice: 120 }),
    ]);

    await alertHandler.checkAndNotifyAlerts();

    expect(alertRepository.findAllAlerts).toHaveBeenCalledWith({ onlyActiveUsers: true });
    expect(priceProvider.getPriceByIsin).toHaveBeenCalled();
    expect(botSendMessage).toHaveBeenCalledTimes(1);
    expect(botSendMessage).toHaveBeenCalledWith(expect.objectContaining({ chat_id: 123 }));
    expect(alertRepository.updateAlert).toHaveBeenCalledTimes(1);
    expect(alertRepository.updateAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "alert-test-1",
        lastCondition: Condition.below,
        lastCheckPrice: 100,
      }),
    );
  });

  test("non notifica a condizione invariata", async () => {
    alertRepository.findAllAlerts.mockImplementation(async () => [
      createAlertFixture({ alertPrice: 95, lastCondition: Condition.above, lastCheckPrice: 120 }),
    ]);

    await alertHandler.checkAndNotifyAlerts();

    expect(botSendMessage).not.toHaveBeenCalled();
    expect(alertRepository.updateAlert).not.toHaveBeenCalled();
  });

  test("non notifica su prezzo uguale alla soglia", async () => {
    alertRepository.findAllAlerts.mockImplementation(async () => [createAlertFixture({ alertPrice: 100 })]);

    await alertHandler.checkAndNotifyAlerts();

    expect(botSendMessage).not.toHaveBeenCalled();
    expect(alertRepository.updateAlert).not.toHaveBeenCalled();
  });

  test("chiama l'API una sola volta per ISIN condiviso", async () => {
    alertRepository.findAllAlerts.mockImplementation(async () => [
      createAlertFixture({ id: "alert-test-1" }),
      createAlertFixture({
        id: "alert-test-2",
        alertPrice: 110,
        lastCondition: Condition.above,
        lastCheckPrice: 120,
      }),
    ]);

    await alertHandler.checkAndNotifyAlerts();

    expect(priceProvider.getPriceByIsin).toHaveBeenCalledTimes(1);
    expect(botSendMessage).toHaveBeenCalledTimes(2);
  });

  test("salta l'ISIN non valido ed elabora gli altri", async () => {
    priceProvider.getPriceByIsin.mockImplementation(async (isin: string) =>
      isin === "IT0005518128" ? createValidResponse(100) : createNotFoundResponse(),
    );
    alertRepository.findAllAlerts.mockImplementation(async () => [
      createAlertFixture({ id: "alert-test-1", isin: "IT0005518128", alertPrice: 95 }),
      createAlertFixture({ id: "alert-test-2", isin: "XX0000000000", alertPrice: 95 }),
    ]);

    await alertHandler.checkAndNotifyAlerts();

    expect(botSendMessage).toHaveBeenCalledTimes(1);
    expect(alertRepository.updateAlert).toHaveBeenCalledTimes(1);
  });

  test("salta l'ISIN in errore ed elabora gli altri", async () => {
    priceProvider.getPriceByIsin.mockImplementation(async (isin: string) => {
      if (isin === "XX0000000000") throw new Error("Errore API simulato");
      return createValidResponse(100);
    });
    alertRepository.findAllAlerts.mockImplementation(async () => [
      createAlertFixture({ id: "alert-test-1", isin: "IT0005518128", alertPrice: 95 }),
      createAlertFixture({ id: "alert-test-2", isin: "XX0000000000", alertPrice: 95 }),
    ]);

    await alertHandler.checkAndNotifyAlerts();

    expect(botSendMessage).toHaveBeenCalledTimes(1);
    expect(alertRepository.updateAlert).toHaveBeenCalledTimes(1);
  });

  test("salta l'ISIN senza prezzo ed elabora gli altri", async () => {
    priceProvider.getPriceByIsin.mockImplementation(async () => createNoPriceResponse());
    alertRepository.findAllAlerts.mockImplementation(async () => [createAlertFixture()]);

    await alertHandler.checkAndNotifyAlerts();

    expect(botSendMessage).not.toHaveBeenCalled();
    expect(alertRepository.updateAlert).not.toHaveBeenCalled();
  });

  test("marca blocked senza aggiornare l'alert e continua", async () => {
    botSendMessage.mockImplementation(async () => {
      throw createBlockedError();
    });
    alertRepository.findAllAlerts.mockImplementation(async () => [
      createAlertFixture({ id: "alert-test-1", alertPrice: 95 }),
      createAlertFixture({
        id: "alert-test-2",
        alertPrice: 110,
        lastCondition: Condition.above,
        lastCheckPrice: 120,
      }),
    ]);

    await alertHandler.checkAndNotifyAlerts();

    expect(botSendMessage).toHaveBeenCalledTimes(2);
    expect(userRepository.updateUserStatus).toHaveBeenCalledTimes(2);
    expect(userRepository.updateUserStatus).toHaveBeenCalledWith(123, UserStatus.blocked);
    expect(alertRepository.updateAlert).not.toHaveBeenCalled();
  });

  test("salta l'aggiornamento dopo un errore di consegna generico e notifica il prossimo alert", async () => {
    botSendMessage.mockImplementationOnce(async () => {
      throw new Error("Errore di consegna simulato");
    });
    alertRepository.findAllAlerts.mockImplementation(async () => [
      createAlertFixture({ id: "alert-test-1" }),
      createAlertFixture({ id: "alert-test-2" }),
    ]);

    await alertHandler.checkAndNotifyAlerts();

    expect(botSendMessage).toHaveBeenCalledTimes(2);
    expect(userRepository.updateUserStatus).not.toHaveBeenCalled();
    expect(alertRepository.updateAlert).toHaveBeenCalledTimes(1);
    expect(alertRepository.updateAlert).toHaveBeenCalledWith(expect.objectContaining({ id: "alert-test-2" }));
  });

  test("continua con gli altri se l'aggiornamento fallisce", async () => {
    alertRepository.updateAlert.mockImplementation(async () => {
      throw new Error("Errore DB simulato");
    });
    alertRepository.findAllAlerts.mockImplementation(async () => [
      createAlertFixture({ id: "alert-test-1", alertPrice: 95 }),
      createAlertFixture({ id: "alert-test-2", alertPrice: 95 }),
    ]);

    await alertHandler.checkAndNotifyAlerts();

    expect(botSendMessage).toHaveBeenCalledTimes(2);
  });
});

describe("AlertPriceJob", () => {
  for (const [isProduction, cronTime] of [[true, "*/2 7-18 * * 1-5"], [false, "*/1 * * * *"]] as const) {
    test(`esegue il controllo iniettato con il cron ${cronTime}`, async () => {
      const checkAlerts = mock(async () => {});
      const fromSpy = spyOn(CronJob, "from");
      const job = new AlertPriceJob(checkAlerts, isProduction);

      try {
        job.start();
        expect(fromSpy).toHaveBeenCalledWith(
          expect.objectContaining({ cronTime, timeZone: "Europe/Rome", waitForCompletion: true }),
        );
        const cron = fromSpy.mock.results[0].value as ReturnType<typeof CronJob.from>;
        await cron.fireOnTick();
        expect(checkAlerts).toHaveBeenCalledTimes(1);

        job.stop();
        expect(cron.isActive).toBe(false);
      } finally {
        job.stop();
        fromSpy.mockRestore();
      }
    });
  }
});
