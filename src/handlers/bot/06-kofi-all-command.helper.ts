import { format, blockquote, bold, code, InlineKeyboard } from "gramio";
import { MyMessageContext } from "../../types/custom-context.type";
import { logger } from "../../logger/logger";
import { DatabaseHandler } from "../database/database-handler";
import { errorHandler } from "../error/error-handler";
import { confirmKofiAll, cancelKofiAll } from "./04-callbacks-data";

const databaseHandler = DatabaseHandler.getInstance();

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

    if (filteredUsers.length === 0) {
      await ctx.reply(code("⚠️ Non è stato trovato nessun utente oltre all'admin."));
      return;
    }

    const label = filteredUsers.length === 1 ? "utente" : "utenti";

    const confirmMessage = blockquote(format`${bold(`⚠️ Sei sicuro di voler inviare il messaggio a ${filteredUsers.length} ${label}?`)}`);

    const keyboard = new InlineKeyboard().text("✅ Invia", confirmKofiAll.pack(), { style: "success" }).text("❌ Annulla", cancelKofiAll.pack(), { style: "danger" });

    await ctx.reply(confirmMessage, { reply_markup: keyboard });
  } catch (error) {
    errorHandler(error, ctx);
  }
};
