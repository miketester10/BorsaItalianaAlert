import type { Bot } from "gramio";
import { logger } from "../../logger/logger";
import { BotCommand } from "../../enums/bot-command.enum";
import { MyMessageContext } from "../../types/custom-context.type";
import { handleHelpCommand, handleStartCommand, handleAdminCommand } from "./01-commands-basic.helper";
import type { AlertCommands } from "./02-commands-helper";
import { setupCallbacks } from "./03-callbacks-helper";
import { userHandler } from "./05-user-handler";
import type { KofiCommands } from "./06-kofi-commands";
import type { AlertRepository } from "../../interfaces/alert-repository.interface";
import type { UserRepository } from "../../interfaces/user-repository.interface";
import type { OwnerCheck } from "../../utils/authorization.util";

export class BotHandler {
  constructor(
    private readonly bot: Bot,
    private readonly alertRepository: AlertRepository,
    private readonly userRepository: UserRepository,
    private readonly alertCommands: AlertCommands,
    private readonly kofiCommands: KofiCommands,
    private readonly checkOwner: OwnerCheck,
  ) {}

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
      await userHandler(ctx, this.userRepository);
      return next();
    });

    this.bot.command(BotCommand.PREZZO, async (ctx: MyMessageContext) => {
      await this.alertCommands.handlePrezzoCommand(ctx);
    });
    this.bot.command(BotCommand.ALERT, async (ctx: MyMessageContext) => {
      await this.alertCommands.handleAlertCommand(ctx);
    });
    this.bot.command(BotCommand.ALERTS_ATTIVI, async (ctx: MyMessageContext) => {
      await this.alertCommands.handleAlertsAttiviCommand(ctx);
    });
    this.bot.command(BotCommand.ELIMINA_ALERTS, async (ctx: MyMessageContext) => {
      await this.alertCommands.handleEliminaAlertsCommand(ctx);
    });
    this.bot.command(BotCommand.START, async (ctx: MyMessageContext) => {
      await handleStartCommand(ctx);
    });
    this.bot.command(BotCommand.HELP, async (ctx: MyMessageContext) => {
      await handleHelpCommand(ctx);
    });
    this.bot.command(BotCommand.ADMIN, async (ctx: MyMessageContext) => {
      await handleAdminCommand(ctx, this.checkOwner);
    });
    this.bot.command(BotCommand.KOFI_ALL, async (ctx: MyMessageContext) => {
      await this.kofiCommands.handleKofiAllCommand(ctx);
    });
    this.bot.command(BotCommand.KOFI_USER, async (ctx: MyMessageContext) => {
      await this.kofiCommands.handleKofiUserCommand(ctx);
    });
    this.bot.command(BotCommand.KOFI_NEW_USERS, async (ctx: MyMessageContext) => {
      await this.kofiCommands.handleKofiNewUsersCommand(ctx);
    });
    this.bot.command(BotCommand.MARK_KOFI_DONOR, async (ctx: MyMessageContext) => {
      await this.kofiCommands.handleMarkKofiDonorCommand(ctx);
    });
    // Handle Callback
    setupCallbacks(
      this.bot,
      this.alertRepository,
      this.userRepository,
      this.alertCommands,
      this.kofiCommands,
      this.checkOwner,
    );
  }
}
