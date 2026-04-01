import { DatabaseHandler } from "../database/database-handler";
import { MyCallbackQueryContext, MyMessageContext } from "../../interfaces/custom-context.interface";
import { logger } from "../../logger/logger";

const dataBaseHandler: DatabaseHandler = DatabaseHandler.getInstance();

export const userHandler = async (ctx: MyMessageContext | MyCallbackQueryContext): Promise<void> => {
  const telegramId = ctx.from?.id!;
  const name = ctx.from?.firstName!;
  const username = ctx.from?.username ?? null;

  const user = await dataBaseHandler.findUserByTelegramId(telegramId);
  if (user) {
    const isUpdated = await dataBaseHandler.updateUser(telegramId, user, { name, username });
    logger.warn(`Utente ${name} già registrato. ${isUpdated ? `Dati aggiornati con successo.` : `Nessun dato da aggiornare è stato trovato.`}`);
  } else {
    await dataBaseHandler.createUser({ telegramId, name, username });
    logger.info(`Nuovo utente registrato con successo.`);
  }
};
