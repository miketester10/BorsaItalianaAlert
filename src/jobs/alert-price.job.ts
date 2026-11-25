import { CronJob } from "cron";
import { logger } from "../logger/logger";

export class AlertPriceJob {
  private activeJob: CronJob | null = null;
  private readonly jobName: string;

  constructor(
    private readonly checkAndNotifyAlerts: () => Promise<void>,
    private readonly isProduction: boolean,
  ) {
    this.jobName = isProduction ? "AlertPriceJob" : "TestAlertPriceJob";
  }

  start(): void {
    if (this.activeJob) return;

    this.activeJob = CronJob.from({
      cronTime: this.isProduction ? "*/2 7-18 * * 1-5" : "*/1 * * * *",
      onTick: async () => {
        try {
          await this.checkAndNotifyAlerts();
          const date = new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" });
          logger.info(`${this.jobName} eseguito il: ${date}`);
        } catch (error) {
          logger.error(`Errore nell'esecuzione di ${this.jobName}: ${(error as Error).message}`);
        }
      },
      start: true,
      timeZone: "Europe/Rome",
      waitForCompletion: true, // Salta il nuovo run se il precedente è ancora in corso.
    });

    logger.info(this.isProduction
      ? `✅ ${this.jobName} attivo: ogni 2 min. dalle 07:00 alle 18:58 (lun-ven).`
      : `✅ ${this.jobName} attivo: ogni 1 min.`);
  }

  stop(): void {
    if (!this.activeJob) return;

    this.activeJob.stop();
    this.activeJob = null;
    logger.info(`✅ ${this.jobName} fermato`);
  }
}
