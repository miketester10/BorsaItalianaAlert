import { type Alert, Condition } from "@prisma/client";
import pLimit from "p-limit";
import type { AlertRepository } from "../../interfaces/alert-repository.interface";
import { getLastPriceStatus } from "../../interfaces/borsa-italiana-response.interface";
import type { NotificationService } from "../../interfaces/notification-service.interface";
import type { PriceProvider } from "../../interfaces/price-provider.interface";
import type { UserRepository } from "../../interfaces/user-repository.interface";
import type { UpdateAlertDto } from "../../dto/update-alert.dto";
import { logger } from "../../logger/logger";
import { calculateCondition } from "../../utils/alert-condition.util";

export class AlertHandler {
  constructor(
    private readonly alertRepository: Pick<AlertRepository, "findAllAlerts" | "updateAlert">,
    private readonly userRepository: Pick<UserRepository, "updateUserStatus">,
    private readonly priceProvider: PriceProvider,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Controlla tutti gli alert, confronta il prezzo corrente con alertPrice,
   * invia notifiche se la condizione è cambiata e aggiorna il DB.
   */
  async checkAndNotifyAlerts(): Promise<void> {
    const alerts = await this.alertRepository.findAllAlerts({ onlyActiveUsers: true });
    if (alerts.length === 0) return;

    // Ottimizzazione: prendo tutti gli ISIN unici per ridurre chiamate API
    const isins = [...new Set(alerts.map((alert) => alert.isin))];
    const priceMap: Record<string, number | undefined> = {};

    // Parallelizza le chiamate API per gli ISIN unici e raccoglie i risultati con limite di concorrenza
    const limit = pLimit(40); // Max 40 richieste parallele
    const requests = isins.map((isin) =>
      limit(async () => {
        try {
          const response = await this.priceProvider.getPriceByIsin(isin);
          return { isin, response };
        } catch (error) {
          throw new Error(`ISIN ${isin} - ${(error as Error).message}`);
        }
      }),
    );

    const t1 = Date.now();
    const results = await Promise.allSettled(requests);
    const t2 = Date.now();

    const elapsedSeconds = ((t2 - t1) / 1000).toFixed(2);
    logger.debug(`Fetch prezzi completato in ${elapsedSeconds}s`);

    let successCount = 0;
    let errorCount = 0;

    for (const result of results) {
      if (result.status === "fulfilled") {
        const { isin, response } = result.value;
        const status = getLastPriceStatus(response);
        if (status.kind === "ok") {
          priceMap[isin] = status.price;
          successCount++;
        } else if (status.kind === "nodata") {
          logger.warn(`Prezzo non valido per ISIN ${isin}. Ricevuto: ${String(status.raw)}`);
          errorCount++;
        } else {
          logger.warn(`Risposta non valida per ISIN ${isin}`);
          errorCount++;
        }
      } else {
        logger.error(`Errore nel recupero del prezzo: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
        errorCount++;
      }
    }

    const total = successCount + errorCount;
    const successRate = ((successCount / total) * 100).toFixed(2);

    logger.debug(`✅ Successi: ${successCount}, ❌ Errori: ${errorCount}, 📊 Success rate: ${successRate}%`);

    for (const alert of alerts) {
      const currentPrice = priceMap[alert.isin];

      if (currentPrice === undefined) {
        logger.warn(`ISIN ${alert.isin} non trovato nella Mappa. Impossibile controllare alert. Procedo con l'alert successivo.`);
        continue;
      }

      const newCondition = calculateCondition(currentPrice, alert.alertPrice);

      if (this.shouldNotify(alert, newCondition)) {
        const notification = await this.notificationService.sendAlert(alert, currentPrice, newCondition);
        if (!notification.sent) {
          const { error, userStatus } = notification;
          logger.error(`Errore nell'invio della notifica allo user ${alert.userTelegramId}: ${(error as Error).message}`);
          if (userStatus) {
            await this.userRepository.updateUserStatus(alert.userTelegramId, userStatus);
            logger.warn(`User ${alert.userTelegramId} marcato come ${userStatus}`);
          }
          continue;
        }

        try {
          await this.updateAlertStatus(alert.id, newCondition, currentPrice);
        } catch (error) {
          logger.error(`Errore nell'aggiornamento dello stato dell'alert: ${(error as Error).message}`);
          continue;
        }
      }
    }
  }

  /**
   * Decide se notificare in base al cambio condizione
   */
  private shouldNotify(alert: Alert, newCondition: Condition): boolean {
    return newCondition !== alert.lastCondition && newCondition !== Condition.equal;
  }

  /**
   * Aggiorna lo stato dell'alert nel DB
   */
  private async updateAlertStatus(alertId: string, condition: Condition, price: number): Promise<void> {
    const updateAlertDto: UpdateAlertDto = {
      id: alertId,
      lastCondition: condition,
      lastCheckPrice: price,
    };
    await this.alertRepository.updateAlert(updateAlertDto);
  }
}
