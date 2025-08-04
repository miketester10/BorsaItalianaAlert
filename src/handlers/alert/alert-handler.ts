import { Alert, Condition } from "@prisma/client";
import { DatabaseHandler } from "../database/database-handler";
import { ApiHandler } from "../api/api-handler";
import { BorsaItalianaApiResponse, isBorsaItalianaValidResponse } from "../../interfaces/borsa-italiana-response.interface";
import { logger } from "../../logger/logger";
import { API } from "../../consts/api";
import { JWT } from "../../consts/jwt";
import { UpdateAlertDto } from "../../dto/update-alert.dto";
import { Bot } from "gramio";

const dataBaseHandler: DatabaseHandler = DatabaseHandler.getInstance();
const apiHandler: ApiHandler = ApiHandler.getInstance();

export class AlertHandler {
  private static _instance: AlertHandler;
  private bot!: Bot;

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
  async checkAndNotifyAlerts(bot: Bot): Promise<void> {
    this.bot = bot;

    const alerts = await dataBaseHandler.findAllAlerts();
    if (alerts.length === 0) return;

    // Ottimizzazione: prendo tutti gli ISIN unici per ridurre chiamate API
    const isins = [...new Set(alerts.map((alert) => alert.isin))];
    const priceMap: Record<string, number | undefined> = {};

    for (const isin of isins) {
      let response: BorsaItalianaApiResponse;

      try {
        response = await apiHandler.getPrice<BorsaItalianaApiResponse>(`${API.BORSA_ITALIANA}${isin}${API.BORSA_ITALIANA_TAIL}`, {
          Authorization: `Bearer ${JWT.BORSA_ITALIANA}`,
        });

        if (isBorsaItalianaValidResponse(response)) {
          priceMap[isin] = response.intradayPoint.at(-1)?.endPx;
        }
      } catch (error) {
        logger.error(`Errore nel recupero del prezzo per ISIN ${isin}: ${(error as Error).message}`);
        continue;
      }
    }

    for (const alert of alerts) {
      const currentPrice = priceMap[alert.isin];

      if (!currentPrice) {
        logger.warn(`ISIN ${alert.isin} non trovato nella Mappa. Impossibile controllare alert. Procedo con l'alert successivo.`);
        continue;
      }

      const newCondition = this.calculateCondition(currentPrice, alert.alertPrice);

      if (this.shouldNotify(alert, newCondition)) {
        try {
          await this.sendNotification(bot, alert, currentPrice, newCondition);
        } catch (error) {
          logger.error(`Errore nell'invio della notifica allo user ${alert.userTelegramId}: ${(error as Error).message}`);
          continue;
        }
      }

      try {
        await this.updateAlertStatus(alert.id, newCondition, currentPrice);
      } catch (error) {
        logger.error(`Errore nell'aggiornamento dello stato dell'alert: ${(error as Error).message}`);
        continue;
      }
    }
  }

  /**
   * Determina la condizione attuale (above, below, equal)
   */
  private calculateCondition(currentPrice: number, alertPrice: number): Condition {
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
  private async sendNotification(bot: Bot, alert: Alert, price: number, condition: Condition): Promise<void> {
    const message =
      condition === Condition.above
        ? `🚨 ALERT\n\nISIN: ${alert.isin}\nLabel: ${alert.label}\n🟢 Il prezzo ha SUPERATO ${alert.alertPrice}€\n💰 Prezzo attuale: ${price}€`
        : `🚨 ALERT\n\nISIN: ${alert.isin}\nLabel: ${alert.label}\n🔴 Il prezzo è SCESO sotto ${alert.alertPrice}€\n💰 Prezzo attuale: ${price}€`;

    await bot.api.sendMessage({
      chat_id: alert.userTelegramId,
      text: message,
    });
  }
}
