import { CronJob } from "cron";
import { logger } from "../logger/logger";
import { Bot } from "gramio";
import { AlertHandler } from "../handlers/alert/alert-handler";
import { BotHandler } from "../handlers/bot/bot-handler";

const alertHandler: AlertHandler = AlertHandler.getInstance();
const bot: Bot = BotHandler.getInstance().bot;

/* ✅ Cron: ogni 10 minuti dalle 07:00 alle 18:59, dal lunedì al venerdì */
// export const startAlertPriceJob = async (): Promise<void> => {
//   const job = new CronJob(
//     "*/10 7-18 * * 1-5",
//     async () => {
//       await alertHandler.checkAndNotifyAlerts(bot);
//       const date = new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" });
//       logger.info(`CronJob eseguito il: ${date}`);
//     },
//     null,
//     true,
//     "Europe/Rome"
//   );
//   job.start();
//   logger.info("✅ CronJob attivo: ogni 10 minuti dalle 07:00 alle 18:59 (lun-ven).");
// };

/* ✅ [TEST] Cron: ogni minuto dalle 00:00 alle 23:59, dal lunedì al venerdì */
export const startTestAlertPriceJob = async (): Promise<void> => {
  const job = new CronJob(
    "*/1 0-23 * * 1-5",
    async () => {
      await alertHandler.checkAndNotifyAlerts(bot);
      const date = new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" });
      logger.info(`CronJob eseguito il: ${date}`);
    },
    null,
    true,
    "Europe/Rome"
  );
  job.start();
  logger.info("✅ CronJob attivo: ogni minuto dalle 00:00 alle 23:00 (lun-ven).");
};
