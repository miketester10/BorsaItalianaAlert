import { CronJob } from "cron";
import { logger } from "../logger/logger";
import { AlertHandler } from "../handlers/alert/alert-handler";

const alertHandler: AlertHandler = AlertHandler.getInstance();

/* ✅ Cron: ogni 5 minuti dalle 07:00 alle 18:55, dal lunedì al venerdì */
export const startAlertPriceJob = async (): Promise<void> => {
  const job = new CronJob(
    "*/5 7-18 * * 1-5",
    async () => {
      try {
        await alertHandler.checkAndNotifyAlerts();
        const date = new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" });
        logger.info(`CronJob eseguito il: ${date}`);
      } catch (error) {
        logger.error(`Errore nell'esecuzione del CronJob: ${(error as Error).message}`);
      }
    },
    null,
    true,
    "Europe/Rome"
  );
  job.start();
  logger.info("✅ CronJob attivo: ogni 5 minuti dalle 07:00 alle 18:55 (lun-ven).");
};

/* ✅ [TEST] Cron: ogni minuto dalle 00:00 alle 23:55, dal lunedì al venerdì */
// export const startTestAlertPriceJob = async (): Promise<void> => {
//   const job = new CronJob(
//     "*/1 0-23 * * 1-5",
//     async () => {
//       try {
//         await alertHandler.checkAndNotifyAlerts();
//         const date = new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" });
//         logger.info(`CronJob eseguito il: ${date}`);
//       } catch (error) {
//         logger.error(`Errore nell'esecuzione del CronJob: ${(error as Error).message}`);
//       }
//     },
//     null,
//     true,
//     "Europe/Rome"
//   );
//   job.start();
//   logger.info("✅ CronJob attivo: ogni minuto dalle 00:00 alle 23:55 (lun-ven).");
// };
