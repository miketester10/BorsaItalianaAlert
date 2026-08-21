import { UserStatus } from "@prisma/client";
import { format, blockquote, bold, code, InlineKeyboard, FormattableString } from "gramio";
import { MyMessageContext, MyCallbackQueryContext, isCallbackContext } from "../../types/custom-context.type";
import { KofiUsersResult } from "../../interfaces/kofi-users-result.interface";
import { logger } from "../../logger/logger";
import { DatabaseHandler } from "../database/database-handler";
import { errorHandler } from "../error/error-handler";
import { validateKofiDonorInput, validateKofiUserInput } from "../../schemas/input-validator.schema";
import { confirmKofiAll, confirmKofiUser, confirmKofiNewUsers, confirmMarkKofiDonor, cancelKofiAll, cancelKofiUser, cancelKofiNewUsers, cancelMarkKofiDonor } from "./04-callbacks-data";
import { getUserStatusFromTelegramError } from "../../utils/user-status.util";

const databaseHandler = DatabaseHandler.getInstance();
const OWNER_TELEGRAM_ID = Number(process.env.OWNER_TELEGRAM_ID);

const buildKofiMessage = (userName: string): FormattableString => format`
  Ciao ${bold(userName)}! 👋

  Se il bot ti fa risparmiare tempo e ti è utile ogni giorno, puoi supportarne lo sviluppo con un semplice ${bold("caffè")} ☕

  Ogni contributo aiuta a ${bold("mantenere il servizio online")} ed ${bold("introdurre nuove funzionalità")}.

  ${bold("Anche un piccolo contributo fa la differenza.")}

  Grazie per il supporto! 🙏
`;

export const kofiKeyboard = new InlineKeyboard().url("☕ Offrimi un caffè", "https://ko-fi.com/borsaitalianabot", { style: "primary" });

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const checkKofiUsersExist = async (ctx: MyMessageContext | MyCallbackQueryContext, isNewUsers: boolean): Promise<KofiUsersResult | null> => {
  const users = await databaseHandler.findAllUsers({ onlyNotNotified: isNewUsers, excludeRecent: true, excludeDonors: true, onlyActive: true });
  const filteredUsers = users.filter((user) => user.telegramId !== OWNER_TELEGRAM_ID);

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
};

export const sendKofiMessageToUser = async (ctx: MyCallbackQueryContext, telegramId: number, userName: string): Promise<void> => {
  await ctx.send(buildKofiMessage(userName), {
    chat_id: telegramId,
    link_preview_options: { is_disabled: true },
    reply_markup: kofiKeyboard,
  });
};

export const sendKofiMessages = async (ctx: MyCallbackQueryContext, isNewUsers: boolean): Promise<void> => {
  try {
    const result = await checkKofiUsersExist(ctx, isNewUsers);
    if (!result) return;
    const { users, filteredUsers, skipped } = result;

    const label = filteredUsers.length === 1 ? "utente" : "utenti";
    await ctx.editText(format`${bold(`📬 Invio invito caffè a ${filteredUsers.length} ${label}...`)}`);

    const delayMs = Math.max(100, Number(process.env.KOFI_DELAY_MS) || 500);

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
          await databaseHandler.updateUserStatus(user.telegramId, status);
          logger.warn(`Utente ${user.telegramId} marcato come ${status}`);
        }
        failed++;
      }

      await delay(delayMs);
    }

    if (sentIds.length > 0) {
      await databaseHandler.updateKofiNotifiedBatch(sentIds);
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
    errorHandler(error, ctx);
  }
};

const showKofiConfirmPrompt = async (ctx: MyMessageContext, isNewUsers: boolean): Promise<void> => {
  const telegramId = ctx.from?.id;

  if (telegramId !== OWNER_TELEGRAM_ID) {
    logger.warn(`Tentativo non autorizzato comando [ ${isNewUsers ? "/kofi_new_users" : "/kofi_all"} ] da ${ctx.from?.firstName} (ID: ${telegramId})`);
    return;
  }

  try {
    await ctx.sendChatAction("typing");

    const result = await checkKofiUsersExist(ctx, isNewUsers);
    if (!result) return;
    const { filteredUsers } = result;

    const label = filteredUsers.length === 1 ? "utente" : "utenti";
    const confirmData = isNewUsers ? confirmKofiNewUsers : confirmKofiAll;
    const cancelData = isNewUsers ? cancelKofiNewUsers : cancelKofiAll;

    const confirmMessage = blockquote(format`${bold(`⚠️ Sei sicuro di voler inviare il messaggio a ${filteredUsers.length} ${label}?`)}`);

    const keyboard = new InlineKeyboard().text("✅ Invia", confirmData.pack(), { style: "success" }).text("❌ Annulla", cancelData.pack(), { style: "danger" });

    await ctx.reply(confirmMessage, { reply_markup: keyboard });
  } catch (error) {
    errorHandler(error, ctx);
  }
};

export const handleKofiAllCommand = async (ctx: MyMessageContext): Promise<void> => {
  await showKofiConfirmPrompt(ctx, false);
};

export const handleKofiUserCommand = async (ctx: MyMessageContext): Promise<void> => {
  const telegramId = ctx.from?.id;

  if (telegramId !== OWNER_TELEGRAM_ID) {
    logger.warn(`Tentativo non autorizzato comando [ /kofi_user ] da ${ctx.from?.firstName} (ID: ${telegramId})`);
    return;
  }

  try {
    await ctx.sendChatAction("typing");

    const rawId = ctx.update?.message?.text?.trim().split(/\s+/)[1];
    const validation = validateKofiUserInput(rawId);

    if (!validation.success) {
      await ctx.reply(code("⚠️ Inserisci un Telegram ID valido."));
      return;
    }

    const targetTelegramId = validation.data;
    const user = await databaseHandler.findUserByTelegramId(targetTelegramId);

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
      .text("✅ Invia", confirmKofiUser.pack({ kofiUserTelegramId: targetTelegramId }), { style: "success" })
      .text("❌ Annulla", cancelKofiUser.pack(), { style: "danger" });

    await ctx.reply(confirmMessage, { reply_markup: keyboard });
  } catch (error) {
    errorHandler(error, ctx);
  }
};

export const handleKofiNewUsersCommand = async (ctx: MyMessageContext): Promise<void> => {
  await showKofiConfirmPrompt(ctx, true);
};

export const handleMarkKofiDonorCommand = async (ctx: MyMessageContext): Promise<void> => {
  const telegramId = ctx.from?.id;

  if (telegramId !== OWNER_TELEGRAM_ID) {
    logger.warn(`Tentativo non autorizzato comando [ /mark_kofi_donor ] da ${ctx.from?.firstName} (ID: ${telegramId})`);
    return;
  }

  try {
    await ctx.sendChatAction("typing");

    const rawId = ctx.update?.message?.text?.trim().split(/\s+/)[1];
    const validation = validateKofiDonorInput(rawId);

    if (!validation.success) {
      await ctx.reply(code("⚠️ Inserisci un Telegram ID valido."));
      return;
    }

    const targetTelegramId = validation.data;
    const user = await databaseHandler.findUserByTelegramId(targetTelegramId);

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
      .text("✅ Conferma", confirmMarkKofiDonor.pack({ donorTelegramId: targetTelegramId }), { style: "success" })
      .text("❌ Annulla", cancelMarkKofiDonor.pack(), { style: "danger" });

    await ctx.reply(confirmMessage, { reply_markup: keyboard });
  } catch (error) {
    errorHandler(error, ctx);
  }
};
