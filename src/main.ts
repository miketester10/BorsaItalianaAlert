import { ServerHandler } from "./handlers/server/server-handler";
import { DatabaseHandler } from "./handlers/database/database-handler";
import { BotHandler } from "./handlers/bot/00-bot-handler";

import { startAlertPriceJob, startTestAlertPriceJob, stopAlertPriceJob } from "./jobs/alert-price.job";
import { logger } from "./logger/logger";

const serverHandler = ServerHandler.getInstance();
const databaseHandler = DatabaseHandler.getInstance();
const botHandler = BotHandler.getInstance();

const isProductionEnv = process.env.NODE_ENV === "production";
const job = isProductionEnv ? startAlertPriceJob : startTestAlertPriceJob;

let isShuttingDown = false;

const main = async () => {
  try {
    await serverHandler.start(); // Start the server only for health checks endpoint (monitoring with Uptime Kuma)
    await databaseHandler.connect();
    await botHandler.start();
    await job();
  } catch (error) {
    logger.error(`Unknown Error during the startup: ${(error as Error).message}`);
    await shutdown(1, "startup-error");
  }
};

const shutdown = async (exitCode: number, reason: string): Promise<void> => {
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
process.on("SIGINT", () => {
  shutdown(0, "SIGINT");
});
process.on("SIGTERM", () => {
  shutdown(0, "SIGTERM");
});

main();
