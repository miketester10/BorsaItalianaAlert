import { Bot } from "gramio";
import { logger } from "../../logger/logger";
import { MyCallbackQueryContext, MyMessageContext } from "../../interfaces/custom-context.interface";
import { handleHelpCommand, handleStartCommand } from "./01-commands-basic.helper";
import { handlePrezzoCommand, handleAlertCommand, handleAlertsAttiviCommand, handleEliminaAlertsCommand } from "./02-commands-helper";
import { handleCallbackQuery } from "./03-callback-helper";

export class BotHandler {
  private readonly BOT_TOKEN: string = process.env.BOT_TOKEN!;

  private static _instance: BotHandler;
  private readonly _bot: Bot;

  private constructor() {
    this._bot = new Bot(this.BOT_TOKEN);
  }

  static getInstance(): BotHandler {
    if (!BotHandler._instance) {
      BotHandler._instance = new BotHandler();
    }
    return BotHandler._instance;
  }

  get bot(): Bot {
    return this._bot;
  }

  async start(): Promise<void> {
    await this.inizializeCommands();
    await this._bot.start();

    // Inizializza il menu dei comandi Telegram
    if (!(await this.inizializeMenu())) return logger.warn("⚠️ Bot Telegram avviato senza Menu inizializzato");

    logger.info("✅ Bot Telegram avviato con successo");
  }

  private async inizializeMenu(): Promise<boolean> {
    try {
      const commands_set = await this._bot.api.setMyCommands({
        commands: [
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
            description: "Lista alerts attivi",
          },
          {
            command: "elimina_alerts",
            description: "Elimina tutti gli alerts attivi",
          },
          { command: "start", description: "Avvia il bot" },
          { command: "help", description: "Mostra l'elenco dei comandi disponibili" },
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
    this._bot.command("prezzo", async (ctx: MyMessageContext) => {
      await handlePrezzoCommand(ctx);
    });
    this._bot.command("alert", async (ctx: MyMessageContext) => {
      await handleAlertCommand(ctx);
    });
    this._bot.command("alerts_attivi", async (ctx: MyMessageContext) => {
      await handleAlertsAttiviCommand(ctx);
    });
    this._bot.command("elimina_alerts", async (ctx: MyMessageContext) => {
      await handleEliminaAlertsCommand(ctx);
    });
    this._bot.command("start", async (ctx: MyMessageContext) => {
      await handleStartCommand(ctx);
    });
    this.bot.command("help", async (ctx: MyMessageContext) => {
      await handleHelpCommand(ctx);
    });
    // Handle Callback
    this._bot.callbackQuery<RegExp>(/^.+$/, async (ctx: MyCallbackQueryContext) => {
      await handleCallbackQuery(ctx);
    });
  }
}
