import { BotHandler } from "./handlers/bot/00-bot-handler";
import { DatabaseHandler } from "./handlers/database/database-handler";
// import { startAlertPriceJob } from "./jobs/alert-price.job";
import { startTestAlertPriceJob } from "./jobs/alert-price.job";
import { logger } from "./logger/logger";

const databaseHandler = DatabaseHandler.getInstance();
const botHanlder = BotHandler.getInstance();

const main = async () => {
  try {
    await databaseHandler.connect();
    await botHanlder.start();
    await startTestAlertPriceJob();
  } catch (error) {
    logger.error(`Unknown Error during the startup: ${(error as Error).message}`);
  }
};

main();
