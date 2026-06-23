import { format, blockquote, bold, italic, code, InlineKeyboard, FormattableString } from "gramio";
import { MyMessageContext, MyCallbackQueryContext } from "../../types/custom-context.type";
import { logger } from "../../logger/logger";
import { DatabaseHandler } from "../database/database-handler";
import { errorHandler } from "../error/error-handler";
import { confirmKofiAll, cancelKofiAll, confirmKofiNewUsers, cancelKofiNewUsers } from "./04-callbacks-data";

const databaseHandler = DatabaseHandler.getInstance();
const OWNER_TELEGRAM_ID = Number(process.env.OWNER_TELEGRAM_ID);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const buildKofiMessage = (userName: string): FormattableString => format`
  Ciao ${bold(userName)}! 👋

  Se il bot ti piace e lo ritieni funzionale, sentiti libero di offrirmi un caffè! ☕

  ${blockquote(format`${italic("Il tuo supporto mi aiuta a mantenere il bot attivo ed a migliorarlo.")}`)}

  👉 ${bold("https://ko-fi.com/borsaitalianabot")}

  Grazie mille! 🙏
`;

export const sendKofiMessages = async (ctx: MyCallbackQueryContext, isNewUsers: boolean): Promise<void> => {
  try {
    await ctx.editText(code("⏳ Preparazione invio..."));

    const users = await databaseHandler.findAllUsers(isNewUsers);
    const filteredUsers = users.filter((user) => user.telegramId !== OWNER_TELEGRAM_ID);
    const skipped = users.length - filteredUsers.length;

    if (filteredUsers.length === 0) {
      await ctx.editText(code("⚠️ Nessun utente da notificare trovato."));
      return;
    }

    const label = filteredUsers.length === 1 ? "utente" : "utenti";
    await ctx.editText(format`${bold(`📬 Invio invito caffè a ${filteredUsers.length} ${label}...`)}`);

    const delayMs = Math.max(100, Number(process.env.KOFI_DELAY_MS) || 500);

    let sent = 0;
    let failed = 0;
    const sentIds: number[] = [];

    for (const user of filteredUsers) {
      try {
        await ctx.send(buildKofiMessage(user.name), {
          chat_id: user.telegramId,
          link_preview_options: { is_disabled: true },
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
  const telegramId = ctx.from?.id!;

  if (telegramId !== OWNER_TELEGRAM_ID) {
    logger.warn(`Tentativo non autorizzato comando [ ${isNewUsers ? "/kofi_new_user" : "/kofi_all"} ] da ${ctx.from?.firstName} (ID: ${telegramId})`);
    return;
  }

  try {
    await ctx.sendChatAction("typing");

    const users = await databaseHandler.findAllUsers(isNewUsers);
    const filteredUsers = users.filter((user) => user.telegramId !== OWNER_TELEGRAM_ID);

    if (filteredUsers.length === 0) {
      await ctx.reply(code("⚠️ Nessun utente da notificare trovato."));
      return;
    }

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
