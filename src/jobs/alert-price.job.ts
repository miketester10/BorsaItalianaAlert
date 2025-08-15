import { CronJob } from "cron";
import { logger } from "../logger/logger";
import { AlertHandler } from "../handlers/alert/alert-handler";

const alertHandler: AlertHandler = AlertHandler.getInstance();
const minutiProduzione = 2;
const minutiTest = 1;

/* ✅ Cron: ogni 2 minuti dalle 07:00 alle 18:55, dal lunedì al venerdì */
// export const startAlertPriceJob = async (): Promise<void> => {
//   const job = new CronJob(
//     `*/${minutiProduzione} 7-18 * * 1-5`,
//     async () => {
//       try {
//         await alertHandler.checkAndNotifyAlerts();
//         const date = new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" });
//         logger.info(`AlertPriceJob eseguito il: ${date}`);
//       } catch (error) {
//         logger.error(`Errore nell'esecuzione dell'AlertPriceJob: ${(error as Error).message}`);
//       }
//     },
//     null,
//     true,
//     "Europe/Rome"
//   );
//   job.start();
//   logger.info(`✅ AlertPriceJob attivo: ogni ${minutiProduzione} min. dalle 07:00 alle 18:55 (lun-ven).`);
// };

/* ✅ [TEST] Cron: ogni minuto */
export const startTestAlertPriceJob = async (): Promise<void> => {
  const job = new CronJob(
    `*/${minutiTest} * * * *`,
    async () => {
      try {
        await alertHandler.checkAndNotifyAlerts();
        const date = new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" });
        logger.info(`TestAlertPriceJob eseguito il: ${date}`);
      } catch (error) {
        logger.error(`Errore nell'esecuzione del TestAlertPriceJob: ${(error as Error).message}`);
      }
    },
    null,
    true,
    "Europe/Rome"
  );
  job.start();
  logger.info(`✅ TestAlertPriceJob attivo: ogni ${minutiTest} min.`);
};