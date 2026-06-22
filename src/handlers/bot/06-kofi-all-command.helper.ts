import { format, blockquote, bold, italic, code } from "gramio";
import { MyMessageContext } from "../../types/custom-context.type";
import { logger } from "../../logger/logger";
import { DatabaseHandler } from "../database/database-handler";
import { errorHandler } from "../error/error-handler";

const databaseHandler = DatabaseHandler.getInstance();

const delay = (ms: number) => new Promise((resolve, _reject) => setTimeout(resolve, ms));

export const handleKofiAllCommand = async (ctx: MyMessageContext): Promise<void> => {
  const OWNER_TELEGRAM_ID = Number(process.env.OWNER_TELEGRAM_ID);
  const telegramId = ctx.from?.id!;

  if (telegramId !== OWNER_TELEGRAM_ID) {
    logger.warn(`Tentativo non autorizzato comando [ /kofi_all ] da ${ctx.from?.firstName} (ID: ${telegramId})`);
    return;
  }

  try {
    await ctx.sendChatAction("typing");

    const users = await databaseHandler.findAllUsers();

    if (users.length === 0) {
      await ctx.reply(code("⚠️ Nessun utente registrato nel database."));
      return;
    }

    const filteredUsers = users.filter((user) => user.telegramId !== OWNER_TELEGRAM_ID);
    const skipped = users.length - filteredUsers.length;

    if (filteredUsers.length === 0) {
      await ctx.reply(code("⚠️ Non è stato trovato nessun utente oltre all'admin."));
      return;
    }

    const label = filteredUsers.length === 1 ? "utente" : "utenti";
    const statusMessage = await ctx.reply(format`${bold(`📬 Invio invito caffè a ${filteredUsers.length} ${label}...`)}`);

    const delayMs = Math.max(100, Number(process.env.KOFI_DELAY_MS) || 500);

    let sent = 0;
    let failed = 0;

    for (const user of filteredUsers) {
      try {
        const message = format`
          Ciao ${bold(user.name)}! 👋

          Se il bot ti piace e lo ritieni funzionale, sentiti libero di offrirmi un caffè! ☕

          ${blockquote(format`${italic("Il tuo supporto mi aiuta a mantenere il bot attivo ed a migliorarlo.")}`)}

          👉 ${bold("https://ko-fi.com/borsaitalianabot")}

          Grazie mille! 🙏
        `;

        await ctx.send(message, {
          chat_id: user.telegramId,
          link_preview_options: { is_disabled: true },
        });
        sent++;
      } catch (error) {
        logger.error(`Errore invio a ${user.name} (ID: ${user.telegramId}): ${(error as Error).message}`);
        failed++;
      }

      await delay(delayMs);
    }

    const reportMessage = format`
      ${bold("✅ Report invio caffè:")}

      ${blockquote(format`${bold("Inviati con successo:")} ${sent}
      ${bold("Falliti:")} ${failed}
      ${bold("Saltati (admin):")} ${skipped}
      ${bold("Totale utenti:")} ${users.length}`)}
    `;

    await ctx.editMessageText(reportMessage, {
      chat_id: statusMessage.chat.id,
      message_id: statusMessage.id,
    });
  } catch (error) {
    errorHandler(error, ctx);
  }
};
