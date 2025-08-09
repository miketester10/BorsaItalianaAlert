import { Alert, Condition } from "@prisma/client";
import { DatabaseHandler } from "../database/database-handler";
import { ApiHandler } from "../api/api-handler";
import { BorsaItalianaApiResponse, isBorsaItalianaValidResponse } from "../../interfaces/borsa-italiana-response.interface";
import { logger } from "../../logger/logger";
import { API } from "../../consts/api";
import { JWT } from "../../consts/jwt";
import { UpdateAlertDto } from "../../dto/update-alert.dto";
import { BotHandler } from "../bot/bot-handler";
import { Bot } from "gramio";
import pLimit from "p-limit";
import { formatPrice } from "../../utils/price-formatter";

const dataBaseHandler: DatabaseHandler = DatabaseHandler.getInstance();
const apiHandler: ApiHandler = ApiHandler.getInstance();

export class AlertHandler {
  private static _instance: AlertHandler;

  private constructor() {}

  static getInstance(): AlertHandler {
    if (!AlertHandler._instance) {
      AlertHandler._instance = new AlertHandler();
    }
    return AlertHandler._instance;
  }

  /**
   * Controlla tutti gli alert, confronta il prezzo corrente con alertPrice,
   * invia notifiche se la condizione è cambiata e aggiorna il DB.
   */
  async checkAndNotifyAlerts(): Promise<void> {
    const alerts = await dataBaseHandler.findAllAlerts();
    if (alerts.length === 0) return;

    // Ottimizzazione: prendo tutti gli ISIN unici per ridurre chiamate API
    const isins = [...new Set(alerts.map((alert) => alert.isin))];
    const priceMap: Record<string, number | undefined> = {};

    // Parallelizza le chiamate API per gli ISIN unici e raccoglie i risultati con limite di concorrenza
    const limit = pLimit(20); // Max 20 richieste parallele
    const requests = isins.map((isin) =>
      limit(async () => {
        try {
          const response = await apiHandler.getPrice<BorsaItalianaApiResponse>(`${API.BORSA_ITALIANA}${isin}${API.BORSA_ITALIANA_TAIL}`, { Authorization: `Bearer ${JWT.BORSA_ITALIANA}` });
          return { isin, response };
        } catch (error) {
          throw new Error(`ISIN ${isin} - ${(error as Error).message}`);
        }
      })
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
        if (isBorsaItalianaValidResponse(response)) {
          priceMap[isin] = response.intradayPoint.at(-1)?.endPx;
          successCount++;
        } else {
          logger.warn(`Risposta non valida per ISIN ${isin}`);
          errorCount++;
        }
      } else {
        logger.error(`Errore nel recupero del prezzo:`, result.reason instanceof Error ? result.reason.message : { reason: result.reason });
        errorCount++;
      }
    }

    const total = successCount + errorCount;
    const successRate = ((successCount / total) * 100).toFixed(2);

    logger.debug(`✅ Successi: ${successCount}, ❌ Errori: ${errorCount}, 📊 Success rate: ${successRate}%`);

    for (const alert of alerts) {
      const currentPrice = priceMap[alert.isin];

      if (!currentPrice) {
        logger.warn(`ISIN ${alert.isin} non trovato nella Mappa. Impossibile controllare alert. Procedo con l'alert successivo.`);
        continue;
      }

      const newCondition = this.calculateCondition(currentPrice, alert.alertPrice);

      if (this.shouldNotify(alert, newCondition)) {
        try {
          await this.sendNotification(alert, currentPrice, newCondition);
        } catch (error) {
          logger.error(`Errore nell'invio della notifica allo user ${alert.userTelegramId}: ${(error as Error).message}`);
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
   * Determina la condizione attuale (above, below, equal)
   */
  calculateCondition(currentPrice: number, alertPrice: number): Condition {
    if (currentPrice > alertPrice) return Condition.above;
    if (currentPrice < alertPrice) return Condition.below;
    return Condition.equal;
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
    await dataBaseHandler.updateAlert(updateAlertDto);
  }

  /**
   * Invia la notifica a Telegram
   */
  private async sendNotification(alert: Alert, price: number, condition: Condition): Promise<void> {
    /**
     * Recupero l'istanza del bot qui per evitare problemi di dipendenza circolare tra AlertHandler e BotHandler.
     * Se la recupero a livello globale (fuori dalla classe AlertHandler) o come proprietà della classe, sarà undefined
     * a causa dell'ordine di inizializzazione dei moduli in Node.js/TypeScript.
     * Nel dettaglio: commands-helpers.ts (importato da BotHandler) importa AlertHandler, ed AlertHandler importa BotHandler.
     * Recuperando l'istanza solo all'interno del metodo, evito side effect e garantisco che il bot sia sempre inizializzato correttamente.
     * PS: In NestJS ad esempio la dipendenza circolare viene risolta in questo modo: https://docs.nestjs.com/fundamentals/circular-dependency
     */
    const bot: Bot = BotHandler.getInstance().bot;

    const message =
      condition === Condition.above
        ? `🚨 ALERT\n\nISIN: ${alert.isin}\nLabel: ${alert.label}\n🟢 Il prezzo ha SUPERATO ${formatPrice(alert.alertPrice)}€\n💰 Prezzo attuale: ${price}€`
        : `🚨 ALERT\n\nISIN: ${alert.isin}\nLabel: ${alert.label}\n🔴 Il prezzo è SCESO sotto ${formatPrice(alert.alertPrice)}€\n💰 Prezzo attuale: ${price}€`;

    await bot.api.sendMessage({
      chat_id: alert.userTelegramId,
      text: message,
    });
  }
}
