import { Bot, format, blockquote, bold, italic, code } from "gramio";
import { MyMessageContext } from "../../types/custom-context.type";
import { logger } from "../../logger/logger";
import { DatabaseHandler } from "../database/database-handler";
import { errorHandler } from "../error/error-handler";

const databaseHandler = DatabaseHandler.getInstance();

const delay = (ms: number) => new Promise((resolve, _reject) => setTimeout(resolve, ms));

export const handleKofiAllCommand = async (ctx: MyMessageContext, bot: Bot): Promise<void> => {
  const OWNER_TELEGRAM_ID = Number(process.env.OWNER_TELEGRAM_ID);
  const telegramId = ctx.from?.id!;

  if (telegramId !== OWNER_TELEGRAM_ID) {
    logger.warn(`Tentativo non autorizzato di /kofi_all da ${ctx.from?.firstName} (ID: ${telegramId})`);
    return;
  }

  try {
    await ctx.sendChatAction("typing");

    const users = await databaseHandler.findAllUsers();

    if (users.length === 0) {
      await ctx.reply(code("⚠️ Nessun utente registrato nel database."));
      return;
    }

    await ctx.reply(format`${bold(`📬 Invito caffè a ${users.length} utenti...`)}`);

    const delayMs = Math.max(100, Number(process.env.KOFI_DELAY_MS) || 500);

    let sent = 0;
    let failed = 0;

    for (const user of users) {
      try {
        const message = format`
          Ciao ${bold(user.name)}! 👋

          Se il bot ti piace e lo ritieni funzionale, sentiti libero di offrirmi un caffè! ☕

          ${blockquote(format`${italic("Il tuo supporto mi aiuta a mantenere il bot attivo e a migliorarlo.")}`)}

          👉 ${bold("https://ko-fi.com/mikedeveloper")}

          Grazie mille! 🙏
        `;

        await bot.api.sendMessage({ chat_id: user.telegramId, text: message, link_preview_options: { is_disabled: true } });
        sent++;
      } catch (error) {
        logger.error(`Errore invio a ${user.name} (ID: ${user.telegramId}): ${(error as Error).message}`);
        failed++;
      }

      await delay(delayMs);
    }

    await ctx.reply(format`
      ${bold("✅ Report invio caffè:")}

      ${blockquote(format`${bold("Inviato con successo:")} ${sent}
        ${bold("Falliti:")} ${failed}
        ${bold("Totale utenti:")} ${users.length}`)}
    `);
  } catch (error) {
    errorHandler(error, ctx);
  }
};
