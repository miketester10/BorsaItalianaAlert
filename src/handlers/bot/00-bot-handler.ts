import { Bot } from "gramio";
import { env } from "../../config/env";
import { logger } from "../../logger/logger";
import { BotCommand } from "../../enums/bot-command.enum";
import { MyMessageContext } from "../../types/custom-context.type";
import { handleHelpCommand, handleStartCommand, handleAdminCommand } from "./01-commands-basic.helper";
import { handlePrezzoCommand, handleAlertCommand, handleAlertsAttiviCommand, handleEliminaAlertsCommand } from "./02-commands-helper";
import { setupCallbacks } from "./03-callbacks-helper";
import { userHandler } from "./05-user-handler";
import { handleKofiAllCommand, handleKofiNewUsersCommand, handleMarkKofiDonorCommand, handleKofiUserCommand } from "./06-kofi-commands";

export class BotHandler {
  private readonly BOT_TOKEN: string = env.BOT_TOKEN;

  private static _instance: BotHandler;
  readonly bot: Bot;

  private constructor() {
    this.bot = new Bot(this.BOT_TOKEN);
  }

  static getInstance(): BotHandler {
    if (!BotHandler._instance) {
      BotHandler._instance = new BotHandler();
    }
    return BotHandler._instance;
  }

  async start(): Promise<void> {
    await this.initializeCommands();
    await this.bot.start();

    // Inizializza il menu dei comandi Telegram
    if (!(await this.initializeMenu())) return logger.warn("⚠️ Bot Telegram avviato senza Menu inizializzato");

    logger.info("✅ Bot Telegram avviato con successo");
  }

  async stop(): Promise<void> {
    await this.bot.stop();
    logger.info("✅ Bot Telegram fermato");
  }

  private async initializeMenu(): Promise<boolean> {
    try {
      const commands_set = await this.bot.api.setMyCommands({
        commands: [
          {
            command: BotCommand.PREZZO,
            description: "<ISIN> - Mostra il prezzo attuale",
          },
          {
            command: BotCommand.ALERT,
            description: "<ISIN> <prezzo> - Inserisci alert",
          },
          {
            command: BotCommand.ALERTS_ATTIVI,
            description: "Lista alerts attivi",
          },
          {
            command: BotCommand.ELIMINA_ALERTS,
            description: "Elimina tutti gli alerts attivi",
          },
          { command: BotCommand.START, description: "Avvia il bot" },
          { command: BotCommand.HELP, description: "Mostra l'elenco dei comandi disponibili" },
          { command: BotCommand.ADMIN, description: "Mostra i comandi riservati all'admin" },
        ],
      });
      return commands_set;
    } catch (error) {
      const unknownError = error as Error;
      logger.error(`Errore durante il settaggio dei comandi: ${unknownError.message}`);
      return false;
    }
  }

  private async initializeCommands(): Promise<void> {
    this.bot.on(["message", "callback_query"], async (ctx, next) => {
      await userHandler(ctx);
      return next();
    });

    this.bot.command(BotCommand.PREZZO, async (ctx: MyMessageContext) => {
      await handlePrezzoCommand(ctx);
    });
    this.bot.command(BotCommand.ALERT, async (ctx: MyMessageContext) => {
      await handleAlertCommand(ctx);
    });
    this.bot.command(BotCommand.ALERTS_ATTIVI, async (ctx: MyMessageContext) => {
      await handleAlertsAttiviCommand(ctx);
    });
    this.bot.command(BotCommand.ELIMINA_ALERTS, async (ctx: MyMessageContext) => {
      await handleEliminaAlertsCommand(ctx);
    });
    this.bot.command(BotCommand.START, async (ctx: MyMessageContext) => {
      await handleStartCommand(ctx);
    });
    this.bot.command(BotCommand.HELP, async (ctx: MyMessageContext) => {
      await handleHelpCommand(ctx);
    });
    this.bot.command(BotCommand.ADMIN, async (ctx: MyMessageContext) => {
      await handleAdminCommand(ctx);
    });
    this.bot.command(BotCommand.KOFI_ALL, async (ctx: MyMessageContext) => {
      await handleKofiAllCommand(ctx);
    });
    this.bot.command(BotCommand.KOFI_USER, async (ctx: MyMessageContext) => {
      await handleKofiUserCommand(ctx);
    });
    this.bot.command(BotCommand.KOFI_NEW_USERS, async (ctx: MyMessageContext) => {
      await handleKofiNewUsersCommand(ctx);
    });
    this.bot.command(BotCommand.MARK_KOFI_DONOR, async (ctx: MyMessageContext) => {
      await handleMarkKofiDonorCommand(ctx);
    });
    // Handle Callback
    setupCallbacks(this.bot);
  }
}
