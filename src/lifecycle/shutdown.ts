import { BotHandler } from "../handlers/bot/00-bot-handler";
import { DatabaseHandler } from "../handlers/database/database-handler";
import { ServerHandler } from "../handlers/server/server-handler";
import { stopAlertPriceJob } from "../jobs/alert-price.job";
import { logger } from "../logger/logger";

const botHandler = BotHandler.getInstance();
const serverHandler = ServerHandler.getInstance();
const databaseHandler = DatabaseHandler.getInstance();

let isShuttingDown = false;

export const shutdown = async (exitCode: number, reason: string): Promise<void> => {
  if (isShuttingDown) {
    logger.warn(`Shutdown graceful in corso (${reason})...`);
    return;
  }

  isShuttingDown = true;
  logger.debug(`Shutdown graceful avviato (${reason})...`);

  try {
    stopAlertPriceJob();

    const results = await Promise.allSettled([botHandler.stop(), serverHandler.stop(), databaseHandler.disconnect()]);
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        const component = ["Bot", "Server", "Database"][index];
        logger.error(`Errore durante lo shutdown del ${component}: ${String(result.reason)}`);
      }
    });
  } finally {
    process.exit(exitCode);
  }
};

export const registerProcessShutdown = (): void => {
  process.on("SIGINT", () => {
    shutdown(0, "SIGINT");
  });

  process.on("SIGTERM", () => {
    shutdown(0, "SIGTERM");
  });
};
