import { DatabaseHandler } from "../database/database-handler";
import { logger } from "../../logger/logger";
import { MyUserSourceContext } from "../../types/custom-context.type";

const dataBaseHandler: DatabaseHandler = DatabaseHandler.getInstance();

export const userHandler = async (ctx: MyUserSourceContext): Promise<void> => {
  if (!ctx.from) return;

  const telegramId = ctx.from.id;
  const name = ctx.from.firstName;
  const username = ctx.from.username ?? null;

  const user = await dataBaseHandler.findUserByTelegramId(telegramId);
  if (user) {
    const isUpdated = await dataBaseHandler.updateUser(telegramId, user, { name, username });
    logger.debug(`Utente [${name}] già registrato. ${isUpdated ? `Dati aggiornati con successo.` : `Nessun dato da aggiornare è stato trovato.`}`);
  } else {
    await dataBaseHandler.createUser({ telegramId, name, username });
    logger.info(`Nuovo utente [${name}] registrato con successo.`);
  }
};
