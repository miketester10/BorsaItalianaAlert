import { CronJob } from "cron";
import { logger } from "./logger/logger";
import { Bot } from "gramio";

// ✅ Cron: ogni 20 minuti dalle 07:00 alle 18:59, dal lunedì al venerdì

export const startJob = async (bot: Bot) => {
  const job = new CronJob(
    "*/1 0-8 * * 1-5",
    async () => {
      // controllo alert db
      // chiamo api
      // invio notifiche bot.api.sendMessage({})
      // aggiorno db
      const date = new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" });
      logger.info(`Job eseguito il: ${date}`);
    },
    null,
    true,
    "Europe/Rome"
  );
  job.start();
  logger.info("✅ Cron attivo: ogni 20 minuti dalle 07:00 alle 18:59 (lun-ven).");
};
