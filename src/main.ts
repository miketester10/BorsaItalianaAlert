import { ServerHandler } from "./handlers/server/server-handler";
import { DatabaseHandler } from "./handlers/database/database-handler";
import { BotHandler } from "./handlers/bot/00-bot-handler";

// import { startAlertPriceJob } from "./jobs/alert-price.job";
import { startTestAlertPriceJob } from "./jobs/alert-price.job";
import { logger } from "./logger/logger";

const serverHandler = ServerHandler.getInstance();
const databaseHandler = DatabaseHandler.getInstance();
const botHanlder = BotHandler.getInstance();

const main = async () => {
  try {
    await serverHandler.startServer(); // Start the server only for health checks endpoint (monitoring with Uptime Kuma)
    await databaseHandler.connect();
    await botHanlder.start();
    await startTestAlertPriceJob();
  } catch (error) {
    logger.error(`Unknown Error during the startup: ${(error as Error).message}`);
  }
};

main();
