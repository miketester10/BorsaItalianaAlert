import { TelegramInlineKeyboardButton, TelegramParams } from "gramio";
import { CallbackPayload } from "../../enums/callback-payload.enum";
import { CallbackRouter } from "../../interfaces/callback-router.interface";
import { MyCallbackQueryContext } from "../../interfaces/custom-context.interface";
import { logger } from "../../logger/logger";
import { DatabaseHandler } from "../database/database-handler";
import { handleAlertsAttiviCommand, handlePrezzoCommand } from "./commands-helper";
import { errorHandler } from "../error/error-handler";
import { formatPrice } from "../../utils/price-formatter";

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
    pre_delete: async (ctx, payload): Promise<void> => {
      switch (payload) {
        case CallbackPayload.SINGLE_ALERT:
          try {
            const alertId = ctx.update?.callback_query?.data?.split(":")[2];

            if (!alertId) {
              await ctx.editText(`❌ Errore: ID alert non valido.`);
              return;
            }

            const alert = await dataBaseHandler.findAlertById(alertId);
            if (!alert) {
              await ctx.editText(`❌ Alert non trovato.`);
              return;
            }

            const message = `⚠️ Vuoi eliminare l'alert selezionato?\n\nISIN: ${alert.isin}\nLabel: ${alert.label}\n🔔 Alert Price: ${formatPrice(alert.alertPrice)}€`;

            const inlineKeyboard: TelegramInlineKeyboardButton[][] = [
              [
                { text: "✅ Sì", callback_data: `delete:single_alert:${alertId}` },
                { text: "❌ No", callback_data: "cancel_delete:single_alert" },
              ],
              [{ text: "💰 Prezzo Attuale", callback_data: `current_price:single_alert:${alert.isin}` }],
            ];

            const replyOptions: Partial<TelegramParams.EditMessageTextParams> = {
              reply_markup: { inline_keyboard: inlineKeyboard },
            };

            await ctx.editText(message, replyOptions);
          } catch (error) {
            errorHandler(error, ctx);
          }
          break;
      }
    },

    delete: async (ctx, payload): Promise<void> => {
      switch (payload) {
        case CallbackPayload.ALL_ALERTS:
          try {
            const userTelegramId = ctx.from?.id!;
            await dataBaseHandler.deleteAllAlertsByTelegramId(userTelegramId);
            await ctx.editText(`✅ Tutti gli alerts sono stati eliminati con successo.`);
          } catch (error) {
            errorHandler(error, ctx);
          }
          break;
        case CallbackPayload.SINGLE_ALERT:
          try {
            const alertId = ctx.update?.callback_query?.data?.split(":")[2]!;

            const alert = await dataBaseHandler.findAlertById(alertId);
            if (!alert) {
              await ctx.editText(`❌ Alert non trovato.`);
              return;
            }

            await dataBaseHandler.deleteAlertById(alertId);
            handleAlertsAttiviCommand(ctx);
          } catch (error) {
            errorHandler(error, ctx);
          }
          break;
      }
    },

    cancel_delete: async (ctx, payload): Promise<void> => {
      switch (payload) {
        case CallbackPayload.ALL_ALERTS:
          await ctx.editText(`❌ Comando annullato. Nessun alert attivo è stato eliminato.`);
          break;
        case CallbackPayload.SINGLE_ALERT:
          handleAlertsAttiviCommand(ctx);
          break;
      }
    },

    current_price: async (ctx, payload): Promise<void> => {
      switch (payload) {
        case CallbackPayload.SINGLE_ALERT:
          const isin = ctx.update?.callback_query?.data?.split(":")[2]!;
          handlePrezzoCommand(ctx, isin);
          break;
      }
    },

    back: async (ctx, payload): Promise<void> => {
      switch (payload) {
        case CallbackPayload.ALL_ALERTS:
          handleAlertsAttiviCommand(ctx);
          break;
      }
    },
  };

  return callbackRouter;
};
