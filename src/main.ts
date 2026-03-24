import { ServerHandler } from "./handlers/server/server-handler";
import { DatabaseHandler } from "./handlers/database/database-handler";
import { BotHandler } from "./handlers/bot/00-bot-handler";

import { startAlertPriceJob, startTestAlertPriceJob } from "./jobs/alert-price.job";
import { registerProcessShutdown, shutdown } from "./lifecycle/shutdown";
import { logger } from "./logger/logger";

const serverHandler = ServerHandler.getInstance();
const databaseHandler = DatabaseHandler.getInstance();
const botHandler = BotHandler.getInstance();

const isProductionEnv = process.env.NODE_ENV === "production";
const job = isProductionEnv ? startAlertPriceJob : startTestAlertPriceJob;

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

registerProcessShutdown();

main();
