import { BotHandler } from "./handlers/bot/bot-handler";
import { DatabaseHandler } from "./handlers/database/database-handler";
import { logger } from "./logger/logger";

/**
 * Gestore per la logica di business degli alert
 *
 * Esempio di utilizzo con DatabaseHandler:
 *
 * // 1. Recupera l'utente con i suoi alert
 * const user = await DatabaseHandler.getUserWithAlerts(telegramId);
 *
 * // 2. Per ogni alert, controlla se inviare notifica
 * for (const alert of user.alerts) {
 *   if (AlertHandler.shouldSendNotification(alert, currentPrice)) {
 *     // Invia notifica
 *     const message = AlertHandler.generateNotificationMessage(alert, currentPrice);
 *     // ... invia messaggio
 *   }
 *
 *   // 3. Aggiorna lo stato dell'alert (restituisce nuovo oggetto)
 *   const updatedAlert = AlertHandler.updateAlertState(alert, currentPrice);
 *
 *   // 4. Salva nel database usando DatabaseHandler
 *   await DatabaseHandler.updateAlertState(telegramId, alert.isin, {
 *     lastCheckPrice: updatedAlert.lastCheckPrice,
 *     lastNotificationSent: updatedAlert.lastNotificationSent
 *   });
 * }
 */
const databaseHandler = DatabaseHandler.getInstance();
const botHanlder = BotHandler.getInstance();

const main = async () => {
  try {
    await databaseHandler.connect();
    await botHanlder.start();
    // startJob(bot);
  } catch (error) {
    logger.error(`Unknown Error during the startup: ${(error as Error).message}`);
  }
};

main();
