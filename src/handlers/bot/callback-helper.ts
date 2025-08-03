import { CallbackPayload } from "../../enums/callback-payload.enum";
import { CallbackRouter } from "../../interfaces/callback-router.interface";
import { MyCallbackQueryContext } from "../../interfaces/custom-context.interface";
import { logger } from "../../logger/logger";
import { DatabaseHandler } from "../database/database-handler";
import { handleError } from "./commands-helper";

const dataBaseHandler: DatabaseHandler = DatabaseHandler.getInstance();

export const handleCallbackQuery = async (ctx: MyCallbackQueryContext): Promise<void> => {
  const data = ctx.update?.callback_query?.data;
  const [action, payload] = data?.split(":") || [];

  const cbRouter = callbackRouter();
  const actionHandler = cbRouter[action];

  if (actionHandler) {
    await actionHandler(ctx, payload);
  } else {
    logger.error(`No actionHandler found for: ${action}`);
  }
  // Stop animation of the button
  await ctx.answerCallbackQuery();
};

const callbackRouter = (): CallbackRouter => {
  const callbackRouter: CallbackRouter = {
    delete: async (ctx, payload): Promise<void> => {
      switch (payload) {
        case CallbackPayload.ALL_ALERTS:
          try {
            const userTelegramId = ctx.from?.id!;
            await dataBaseHandler.deleteAllAlertsByTelegramId(userTelegramId);
            await ctx.editText(`✅ Tutti gli alerts sono stati eliminati con successo.`);
            logger.info(`Tutti gli alerts dello user ${userTelegramId} sono stati eliminati.`);
          } catch (error) {
            handleError(error, ctx);
          }
          break;
      }
    },
    cancel_delete: async (ctx, payload): Promise<void> => {
      switch (payload) {
        case CallbackPayload.ALL_ALERTS:
          await ctx.editText(`❌ Comando annullato. Nessun alert attivo è stato eliminato.`);
          break;
      }
    },
  };

  return callbackRouter;
};
