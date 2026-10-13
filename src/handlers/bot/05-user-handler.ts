import { UserStatus } from "@prisma/client";
import { DatabaseHandler } from "../database/database-handler";
import { logger } from "../../logger/logger";
import { MyUserSourceContext } from "../../types/custom-context.type";

const databaseHandler: DatabaseHandler = DatabaseHandler.getInstance();

export const userHandler = async (ctx: MyUserSourceContext): Promise<void> => {
  if (!ctx.from) return;

  const telegramId = ctx.from.id;
  const name = ctx.from.firstName;
  const username = ctx.from.username ?? null;

  try {
    const user = await databaseHandler.findUserByTelegramId(telegramId);
    if (user) {
      const isUpdated = await databaseHandler.updateUser(telegramId, user, { name, username });

      if (user.status !== UserStatus.active) {
        await databaseHandler.updateUserStatus(telegramId, UserStatus.active);
        logger.info(`Utente [${name}] tornato attivo (status precedente: ${user.status}).`);
      }

      logger.debug(
        `Utente [${name}] già registrato. ${isUpdated ? `Dati aggiornati con successo.` : `Nessun dato da aggiornare è stato trovato.`}`,
      );
    } else {
      await databaseHandler.createUser({ telegramId, name, username });
      logger.info(`Nuovo utente [${name}] registrato con successo.`);
    }
  } catch (error) {
    logger.error(
      `Errore userHandler [${name} - Telegram ID: ${telegramId}]: ${(error as Error).message}`,
    );
  }
};
