import { Bot } from "gramio";
import { logger } from "../../logger/logger";
import { MyCallbackQueryContext, MyMessageContext } from "../../interfaces/custom-context.interface";
import { handlePrezzoCommand, handleStartCommand, handleAlertCommand, handleAlertsAttiviCommand, handleEliminaAlertsCommand } from "./commands-helper";
import { handleCallbackQuery } from "./callback-helper";

export class BotHandler {
  private readonly BOT_TOKEN: string = process.env.BOT_TOKEN!;

  private static _instance: BotHandler;
  readonly bot: Bot;

  private constructor() {
    this.bot = new Bot(this.BOT_TOKEN).onStart(async (ctx) => {
      if (!(await this.inizializeMenu())) {
        logger.warn("⚠️ Bot Telegram avviato senza Menu inizializzato");
      } else {
        logger.info("✅ Bot Telegram avviato con successo");
      }
      this.inizializeCommands();
    });
  }

  static getInstance(): BotHandler {
    if (!BotHandler._instance) {
      BotHandler._instance = new BotHandler();
    }
    return BotHandler._instance;
  }

  async start(): Promise<void> {
    await this.bot.start();
  }

  private async inizializeMenu(): Promise<boolean> {
    try {
      const commands_set = await this.bot.api.setMyCommands({
        commands: [
          { command: "start", description: "Avvia il bot" },
          {
            command: "prezzo",
            description: "<ISIN> - Mostra il prezzo attuale",
          },
          {
            command: "alert",
            description: "<ISIN> <prezzo> - Inserisci alert",
          },
          {
            command: "alerts_attivi",
            description: "Lista degli alert attivi",
          },
          {
            command: "elimina_alerts",
            description: "Elimina tutti gli alerts attivi",
          },
        ],
      });
      return commands_set;
    } catch (error) {
      const unknownError = error as Error;
      logger.error(`Errore durante il settaggio dei comandi: ${unknownError.message}`);
      return false;
    }
  }

  private async inizializeCommands(): Promise<void> {
    this.bot.command("start", async (ctx: MyMessageContext) => {
      await handleStartCommand(ctx);
    });
    this.bot.command("prezzo", async (ctx: MyMessageContext) => {
      await handlePrezzoCommand(ctx);
    });
    this.bot.command("alert", async (ctx: MyMessageContext) => {
      await handleAlertCommand(ctx);
    });
    this.bot.command("alerts_attivi", async (ctx: MyMessageContext) => {
      await handleAlertsAttiviCommand(ctx);
    });
    this.bot.command("elimina_alerts", async (ctx: MyMessageContext) => {
      await handleEliminaAlertsCommand(ctx);
    });
    // Handle Callback
    this.bot.callbackQuery<RegExp>(/^.+$/, async (ctx: MyCallbackQueryContext) => {
      await handleCallbackQuery(ctx);
    });
  }
}
