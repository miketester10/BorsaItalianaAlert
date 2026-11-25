import { env } from "./config/env";
import { Bot } from "gramio";
import { AlertHandler } from "./handlers/alert/alert-handler";
import { ApiHandler } from "./handlers/api/api-handler";
import { BotHandler } from "./handlers/bot/00-bot-handler";
import { AlertCommands } from "./handlers/bot/02-commands-helper";
import { KofiCommands } from "./handlers/bot/06-kofi-commands";
import { DatabaseHandler } from "./handlers/database/database-handler";
import { TelegramNotificationService } from "./handlers/notification/telegram-notification.service";
import { ServerHandler } from "./handlers/server/server-handler";
import { AlertPriceJob } from "./jobs/alert-price.job";
import { ShutdownHandler } from "./lifecycle/shutdown";
import { logger } from "./logger/logger";
import { createOwnerCheck } from "./utils/authorization.util";

const serverHandler = new ServerHandler(env.PORT);
const databaseHandler = new DatabaseHandler(env.DATABASE_URL);
const priceProvider = new ApiHandler({
  BORSA_ITALIANA_API: env.BORSA_ITALIANA_API,
  BORSA_ITALIANA_API_TAIL: env.BORSA_ITALIANA_API_TAIL,
  BORSA_ITALIANA_JWT: env.BORSA_ITALIANA_JWT,
});
const telegramBot = new Bot(env.BOT_TOKEN);
const checkOwner = createOwnerCheck(env.OWNER_TELEGRAM_ID);

const alertCommands = new AlertCommands(databaseHandler, priceProvider);
const kofiCommands = new KofiCommands(databaseHandler, checkOwner, env.OWNER_TELEGRAM_ID, env.KOFI_DELAY_MS);
const botHandler = new BotHandler(telegramBot, databaseHandler, databaseHandler, alertCommands, kofiCommands, checkOwner);
const notificationService = new TelegramNotificationService(telegramBot.api);
const alertHandler = new AlertHandler(databaseHandler, databaseHandler, priceProvider, notificationService);
const job = new AlertPriceJob(() => alertHandler.checkAndNotifyAlerts(), env.NODE_ENV === "production");
const shutdownHandler = new ShutdownHandler({
  job,
  bot: botHandler,
  server: serverHandler,
  database: databaseHandler,
  process,
});

const main = async () => {
  try {
    await serverHandler.start(); // Endpoint /health per Uptime Kuma.
    await databaseHandler.connect();
    await botHandler.start();
    job.start();
  } catch (error) {
    logger.error(`Unknown Error during the startup: ${(error as Error).message}`);
    await shutdownHandler.shutdown(1, "startup-error");
  }
};

shutdownHandler.registerProcessShutdown();

void main();
