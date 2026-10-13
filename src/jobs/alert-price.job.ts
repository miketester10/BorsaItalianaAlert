import { CronJob } from "cron";
import { logger } from "../logger/logger";
import { AlertHandler } from "../handlers/alert/alert-handler";

const alertHandler: AlertHandler = AlertHandler.getInstance();
const minutiProduzione = 2;
const minutiTest = 1;
let activeJob: CronJob | null = null;

const startJob = (jobName: string, cronExpression: string, startupMessage: string): void => {
  const job = new CronJob(
    cronExpression,
    async () => {
      try {
        await alertHandler.checkAndNotifyAlerts();
        const date = new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" });
        logger.info(`${jobName} eseguito il: ${date}`);
      } catch (error) {
        logger.error(`Errore nell'esecuzione di ${jobName}: ${(error as Error).message}`);
      }
    },
    null,
    true,
    "Europe/Rome",
  );
  job.start();
  activeJob = job;
  logger.info(startupMessage);
};

/* ✅ Cron: ogni 2 minuti dalle 07:00 alle 18:58, dal lunedì al venerdì */
export const startAlertPriceJob = async (): Promise<void> => {
  startJob(
    "AlertPriceJob",
    `*/${minutiProduzione} 7-18 * * 1-5`,
    `✅ AlertPriceJob attivo: ogni ${minutiProduzione} min. dalle 07:00 alle 18:58 (lun-ven).`,
  );
};

/* ✅ [TEST] Cron: ogni minuto */
export const startTestAlertPriceJob = async (): Promise<void> => {
  startJob(
    "TestAlertPriceJob",
    `*/${minutiTest} * * * *`,
    `✅ TestAlertPriceJob attivo: ogni ${minutiTest} min.`,
  );
};

export const stopAlertPriceJob = (): void => {
  if (!activeJob) return;

  activeJob.stop();
  activeJob = null;
  logger.info("✅ AlertPriceJob fermato");
};
