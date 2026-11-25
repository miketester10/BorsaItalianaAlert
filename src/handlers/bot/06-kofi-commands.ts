import { UserStatus } from "@prisma/client";
import { format, blockquote, bold, code, InlineKeyboard, FormattableString } from "gramio";
import { MyMessageContext, MyCallbackQueryContext, isCallbackContext } from "../../types/custom-context.type";
import { KofiUsersResult } from "../../interfaces/kofi-users-result.interface";
import { logger } from "../../logger/logger";
import type { UserRepository } from "../../interfaces/user-repository.interface";
import { errorHandler } from "../error/error-handler";
import { validateKofiDonorInput, validateKofiUserInput } from "../../schemas/input-validator.schema";
import { confirmKofiAll, confirmKofiUser, confirmKofiNewUsers, confirmMarkKofiDonor, cancelKofiAll, cancelKofiUser, cancelKofiNewUsers, cancelMarkKofiDonor } from "./04-callbacks-data";
import type { OwnerCheck } from "../../utils/authorization.util";
import { AuthorizationAction } from "../../enums/authorization-action.enum";
import { getUserStatusFromTelegramError } from "../../utils/user-status.util";

const buildKofiMessage = (userName: string): FormattableString => format`
  Ciao ${bold(userName)}! 👋

  Se il bot ti fa risparmiare tempo e ti è utile ogni giorno, puoi supportarne lo sviluppo con un semplice ${bold("caffè")} ☕

  Ogni contributo aiuta a ${bold("mantenere il servizio online")} ed ${bold("introdurre nuove funzionalità")}.

  ${bold("Anche un piccolo contributo fa la differenza.")}

  Grazie per il supporto! 🙏
`;

export const kofiKeyboard = new InlineKeyboard().url("☕ Offrimi un caffè", "https://ko-fi.com/borsaitalianabot", { style: "primary" });

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const sendKofiMessageToUser = async (ctx: MyCallbackQueryContext, telegramId: number, userName: string): Promise<void> => {
  await ctx.send(buildKofiMessage(userName), {
    chat_id: telegramId,
    link_preview_options: { is_disabled: true },
    reply_markup: kofiKeyboard,
  });
};

export class KofiCommands {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly checkOwner: OwnerCheck,
    private readonly ownerTelegramId: number,
    private readonly delayMs: number,
  ) {}

  private async checkKofiUsersExist(ctx: MyMessageContext | MyCallbackQueryContext, isNewUsers: boolean): Promise<KofiUsersResult | null> {
    const users = await this.userRepository.findAllUsers({ onlyNotNotified: isNewUsers, excludeRecent: true, excludeDonors: true, onlyActive: true });
    const filteredUsers = users.filter((user) => user.telegramId !== this.ownerTelegramId);

    if (filteredUsers.length === 0) {
      const msg = code("⚠️ Nessun utente da notificare trovato.");
      if (isCallbackContext(ctx)) {
        await ctx.editText(msg);
      } else {
        await ctx.reply(msg);
      }
      return null;
    }

    return { users, filteredUsers, skipped: users.length - filteredUsers.length };
  }

  async sendKofiMessages(ctx: MyCallbackQueryContext, isNewUsers: boolean): Promise<void> {
    try {
      const result = await this.checkKofiUsersExist(ctx, isNewUsers);
      if (!result) return;
      const { users, filteredUsers, skipped } = result;

      const label = filteredUsers.length === 1 ? "utente" : "utenti";
      await ctx.editText(format`${bold(`📬 Invio invito caffè a ${filteredUsers.length} ${label}...`)}`);

      let sent = 0;
      let failed = 0;
      const sentIds: number[] = [];

      for (const user of filteredUsers) {
        try {
          await sendKofiMessageToUser(ctx, user.telegramId, user.name);
          sent++;
          sentIds.push(user.telegramId);
        } catch (error) {
          logger.error(`Errore invio a ${user.name} (ID: ${user.telegramId}): ${(error as Error).message}`);
          const status = getUserStatusFromTelegramError(error);
          if (status) {
            await this.userRepository.updateUserStatus(user.telegramId, status);
            logger.warn(`Utente ${user.telegramId} marcato come ${status}`);
          }
          failed++;
        }

        await delay(this.delayMs);
      }

      if (sentIds.length > 0) {
        await this.userRepository.updateKofiNotifiedBatch(sentIds);
      }

      const reportMessage = format`
      ${bold("✅ Report invio caffè:")}

      ${blockquote(format`${bold("Inviati con successo:")} ${sent}
        ${bold("Falliti:")} ${failed}
        ${bold("Saltati (admin):")} ${skipped}
        ${bold("Totale utenti:")} ${users.length}`)}
    `;

      await ctx.editText(reportMessage);
    } catch (error) {
      await errorHandler(error, ctx);
    }
  }

  private async showKofiConfirmPrompt(ctx: MyMessageContext, isNewUsers: boolean): Promise<void> {
    const action = isNewUsers ? AuthorizationAction.KOFI_NEW_USERS_COMMAND : AuthorizationAction.KOFI_ALL_COMMAND;

    if (!this.checkOwner(ctx, action)) return;

    try {
      await ctx.sendChatAction("typing");

      const result = await this.checkKofiUsersExist(ctx, isNewUsers);
      if (!result) return;
      const { filteredUsers } = result;

      const label = filteredUsers.length === 1 ? "utente" : "utenti";
      const confirmData = isNewUsers ? confirmKofiNewUsers : confirmKofiAll;
      const cancelData = isNewUsers ? cancelKofiNewUsers : cancelKofiAll;

      const confirmMessage = blockquote(format`${bold(`⚠️ Sei sicuro di voler inviare il messaggio a ${filteredUsers.length} ${label}?`)}`);

      const keyboard = new InlineKeyboard().text("✅ Invia", confirmData.pack(), { style: "success" }).text("❌ Annulla", cancelData.pack(), { style: "danger" });

      await ctx.reply(confirmMessage, { reply_markup: keyboard });
    } catch (error) {
      await errorHandler(error, ctx);
    }
  }

  async handleKofiAllCommand(ctx: MyMessageContext): Promise<void> {
    await this.showKofiConfirmPrompt(ctx, false);
  }

  async handleKofiUserCommand(ctx: MyMessageContext): Promise<void> {
    if (!this.checkOwner(ctx, AuthorizationAction.KOFI_USER_COMMAND)) return;

    try {
      await ctx.sendChatAction("typing");

      const rawId = ctx.update?.message?.text?.trim().split(/\s+/)[1];
      const validation = validateKofiUserInput(rawId);

      if (!validation.success) {
        await ctx.reply(code("⚠️ Inserisci un Telegram ID valido."));
        return;
      }

      const telegramId = validation.data;
      const user = await this.userRepository.findUserByTelegramId(telegramId);

      if (!user) {
        await ctx.reply(code("⚠️ Utente non trovato."));
        return;
      }

      if (user.status !== UserStatus.active) {
        await ctx.reply(code(`⚠️ Utente non raggiungibile (status: ${user.status}).`));
        return;
      }

      if (user.kofiDonatedAt) {
        await ctx.reply(code("⚠️ Questo utente ha già donato."));
        return;
      }

      const confirmMessage = blockquote(
        format`${bold("⚠️ Sei sicuro di voler inviare il messaggio al seguente utente?")}

        ${bold("Name:")} ${code(user.name)}
        ${bold("Username:")} ${code(user.username ?? "null")}
        ${bold("CreatedAt:")} ${code(user.createdAt)}
        ${bold("KofiNotified:")} ${code(user.kofiNotified)}
        ${bold("KofiNotifiedAt:")} ${code(user.kofiNotifiedAt ?? "null")}`,
      );

      const keyboard = new InlineKeyboard()
        .text("✅ Invia", confirmKofiUser.pack({ kofiUserTelegramId: telegramId }), { style: "success" })
        .text("❌ Annulla", cancelKofiUser.pack(), { style: "danger" });

      await ctx.reply(confirmMessage, { reply_markup: keyboard });
    } catch (error) {
      await errorHandler(error, ctx);
    }
  }

  async handleKofiNewUsersCommand(ctx: MyMessageContext): Promise<void> {
    await this.showKofiConfirmPrompt(ctx, true);
  }

  async handleMarkKofiDonorCommand(ctx: MyMessageContext): Promise<void> {
    if (!this.checkOwner(ctx, AuthorizationAction.MARK_KOFI_DONOR_COMMAND)) return;

    try {
      await ctx.sendChatAction("typing");

      const rawId = ctx.update?.message?.text?.trim().split(/\s+/)[1];
      const validation = validateKofiDonorInput(rawId);

      if (!validation.success) {
        await ctx.reply(code("⚠️ Inserisci un Telegram ID valido."));
        return;
      }

      const telegramId = validation.data;
      const user = await this.userRepository.findUserByTelegramId(telegramId);

      if (!user) {
        await ctx.reply(code("⚠️ Utente non trovato."));
        return;
      }

      if (!user.kofiNotified) {
        await ctx.reply(code("⚠️ Questo utente non ha ancora ricevuto la notifica Kofi. Impossibile marcare come donatore."));
        return;
      }

      if (user.kofiDonatedAt) {
        await ctx.reply(code("⚠️ Questo utente è già stato marcato come donatore."));
        return;
      }

      const confirmMessage = blockquote(
        format`${bold("⚠️ Vuoi marcare come donatore il seguente utente?")}

        ${bold("Name:")} ${code(user.name)}
        ${bold("Username:")} ${code(user.username ?? "null")}
        ${bold("Status:")} ${code(user.status)}`,
      );

      const keyboard = new InlineKeyboard()
        .text("✅ Conferma", confirmMarkKofiDonor.pack({ donorTelegramId: telegramId }), { style: "success" })
        .text("❌ Annulla", cancelMarkKofiDonor.pack(), { style: "danger" });

      await ctx.reply(confirmMessage, { reply_markup: keyboard });
    } catch (error) {
      await errorHandler(error, ctx);
    }
  }
}
