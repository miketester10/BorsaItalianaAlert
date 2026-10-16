import { CronJob } from "cron";
import { logger } from "../logger/logger";
import { AlertHandler } from "../handlers/alert/alert-handler";

const alertHandler: AlertHandler = AlertHandler.getInstance();
const minutiProduzione = 2;
const minutiTest = 1;
let activeJob: CronJob | null = null;
let activeJobName: string | null = null;

const startJob = (jobName: string, cronExpression: string, startupMessage: string): void => {
  const job = CronJob.from({
    cronTime: cronExpression,
    onTick: async () => {
      try {
        await alertHandler.checkAndNotifyAlerts();
        const date = new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" });
        logger.info(`${jobName} eseguito il: ${date}`);
      } catch (error) {
        logger.error(`Errore nell'esecuzione di ${jobName}: ${(error as Error).message}`);
      }
    },
    start: true,
    timeZone: "Europe/Rome",
    // Cron salta il nuovo run se il precedente è ancora in corso: internamente
    // fireOnTick() esegue `if (this.waitForCompletion && this._isCallbackRunning) return`.
    // Evita run sovrapposti (e doppie notifiche) se un controllo supera l'intervallo.
    waitForCompletion: true,
  });
  job.start();
  activeJob = job;
  activeJobName = jobName;
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

  const jobName = activeJobName ?? "Job";
  activeJob.stop();
  activeJob = null;
  activeJobName = null;
  logger.info(`✅ ${jobName} fermato`);
};
