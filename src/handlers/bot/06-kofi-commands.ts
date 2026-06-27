import { format, blockquote, bold, italic, code, InlineKeyboard, FormattableString } from "gramio";
import { MyMessageContext, MyCallbackQueryContext, isCallbackContext } from "../../types/custom-context.type";
import { KofiUsersResult } from "../../interfaces/kofi-users-result.interface";
import { logger } from "../../logger/logger";
import { DatabaseHandler } from "../database/database-handler";
import { errorHandler } from "../error/error-handler";
import { CommandType } from "../../enums/command-type.enum";
import { validateInput } from "../../schemas/input-validator.schema";
import { confirmKofiAll, cancelKofiAll, confirmKofiNewUsers, cancelKofiNewUsers, confirmMarkKofiDonor, cancelMarkKofiDonor } from "./04-callbacks-data";

const databaseHandler = DatabaseHandler.getInstance();
const OWNER_TELEGRAM_ID = Number(process.env.OWNER_TELEGRAM_ID);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchKofiUsers = async (isNewUsers: boolean): Promise<KofiUsersResult> => {
  const users = await databaseHandler.findAllUsers({ onlyNotNotified: isNewUsers, excludeRecent: true, excludeDonors: true });
  const filteredUsers = users.filter((user) => user.telegramId !== OWNER_TELEGRAM_ID);
  return { users, filteredUsers, skipped: users.length - filteredUsers.length };
};

const checkKofiUsersExist = async (ctx: MyMessageContext | MyCallbackQueryContext, isNewUsers: boolean): Promise<KofiUsersResult | null> => {
  const result = await fetchKofiUsers(isNewUsers);
  if (result.filteredUsers.length === 0) {
    const msg = code("⚠️ Nessun utente da notificare trovato.");
    if (isCallbackContext(ctx)) {
      await ctx.editText(msg);
    } else {
      await ctx.reply(msg);
    }
    return null;
  }
  return result;
};

const buildKofiMessage = (userName: string): FormattableString => format`
  Ciao ${bold(userName)}! 👋

  Se il bot ti fa risparmiare tempo e ti è utile ogni giorno, puoi supportarne lo sviluppo con un semplice ${bold("caffè")} ☕

  Ogni contributo aiuta a ${bold("mantenere il servizio online")} ed ${bold("introdurre nuove funzionalità")}.

  ${bold("Anche un piccolo contributo fa la differenza.")}

  Grazie per il supporto! 🙏
`;

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

    const kofiKeyboard = new InlineKeyboard().url("☕ Offrimi un caffè", "https://ko-fi.com/borsaitalianabot", { style: "primary" });

    for (const user of filteredUsers) {
      try {
        await ctx.send(buildKofiMessage(user.name), {
          chat_id: user.telegramId,
          link_preview_options: { is_disabled: true },
          reply_markup: kofiKeyboard,
        });
        sent++;
        sentIds.push(user.telegramId);
      } catch (error) {
        logger.error(`Errore invio a ${user.name} (ID: ${user.telegramId}): ${(error as Error).message}`);
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

export const handleKofiNewUsersCommand = async (ctx: MyMessageContext): Promise<void> => {
  await showKofiConfirmPrompt(ctx, true);
};

export const handleKofiDonorCommand = async (ctx: MyMessageContext): Promise<void> => {
  const telegramId = ctx.from?.id;

  if (telegramId !== OWNER_TELEGRAM_ID) {
    logger.warn(`Tentativo non autorizzato comando [ /mark_kofi_donor ] da ${ctx.from?.firstName} (ID: ${telegramId})`);
    return;
  }

  try {
    await ctx.sendChatAction("typing");

    const rawId = ctx.update?.message?.text?.trim().split(/\s+/)[1];
    const validation = validateInput(CommandType.KOFI_DONOR, rawId);

    if (!validation.success) {
      await ctx.reply(code("⚠️ Inserisci un Telegram ID valido."));
      return;
    }

    const donorTelegramId = validation.data;
    const user = await databaseHandler.findUserByTelegramId(donorTelegramId);

    if (!user) {
      await ctx.reply(code("⚠️ Utente non trovato."));
      return;
    }

    const confirmMessage = blockquote(
      format`${bold("⚠️ Vuoi marcare come donatore il seguente utente?")}

        ${bold("Name:")} ${code(user.name)}
        ${bold("Username:")} ${code(user.username ?? "null")}`,
    );

    const keyboard = new InlineKeyboard().text("✅ Conferma", confirmMarkKofiDonor.pack({ donorTelegramId }), { style: "success" }).text("❌ Annulla", cancelMarkKofiDonor.pack(), { style: "danger" });

    await ctx.reply(confirmMessage, { reply_markup: keyboard });
  } catch (error) {
    errorHandler(error, ctx);
  }
};
