import { Bot, TelegramInlineKeyboardButton, TelegramParams } from "gramio";
import { DatabaseHandler } from "../database/database-handler";
import { handleAlertsAttiviCommand, handlePrezzoCommand } from "./02-commands-helper";
import { errorHandler } from "../error/error-handler";
import { formatPrice } from "../../utils/price-formatter";
import { cancelDeleteAllAlerts, cancelDeleteAlert, currentPriceFromCallbackAlertsAttivi, currentPriceFromComandoPrezzo, deleteAllAlerts, deleteAlert, preDeleteAlert } from "./04-callback-data";

const dataBaseHandler: DatabaseHandler = DatabaseHandler.getInstance();

export const setupCallbacks = (bot: Bot): void => {
  bot.callbackQuery(preDeleteAlert, async (ctx) => {
    try {
      const alertId = ctx.queryData.alertId;

      const alert = await dataBaseHandler.findAlertById(alertId);
      if (!alert) {
        await ctx.editText(`❌ Alert non trovato.`);
        return ctx.answer();
      }

      const message = `⚠️ Vuoi eliminare l'alert selezionato?\n\nISIN: ${alert.isin}\nLabel: ${alert.label}\n🔔 Alert Price: ${formatPrice(alert.alertPrice)}€`;

      const inlineKeyboard: TelegramInlineKeyboardButton[][] = [
        [
          { text: "✅ Sì", callback_data: deleteAlert.pack({ alertId }), style: "success" },
          { text: "❌ No", callback_data: cancelDeleteAlert.pack(), style: "danger" },
        ],
        [{ text: "💰 Prezzo Attuale", callback_data: currentPriceFromCallbackAlertsAttivi.pack({ isin: alert.isin, alertId }), style: "primary" }],
      ];

      const replyOptions: Partial<TelegramParams.EditMessageTextParams> = {
        reply_markup: { inline_keyboard: inlineKeyboard },
      };

      await ctx.editText(message, replyOptions);
    } catch (error) {
      errorHandler(error, ctx);
    }
    return ctx.answer();
  });

  bot.callbackQuery(deleteAlert, async (ctx) => {
    try {
      const alertId = ctx.queryData.alertId;

      const alert = await dataBaseHandler.findAlertById(alertId);
      if (!alert) {
        await ctx.editText(`❌ Alert non trovato.`);
        return ctx.answer();
      }

      await dataBaseHandler.deleteAlertById(alertId);
      await handleAlertsAttiviCommand(ctx);
    } catch (error) {
      errorHandler(error, ctx);
    }
    return ctx.answer();
  });

  bot.callbackQuery(cancelDeleteAlert, async (ctx) => {
    await handleAlertsAttiviCommand(ctx);
    return ctx.answer();
  });

  bot.callbackQuery(deleteAllAlerts, async (ctx) => {
    try {
      const userTelegramId = ctx.from.id;
      await dataBaseHandler.deleteAllAlertsByTelegramId(userTelegramId);
      await ctx.editText(`✅ Tutti gli alerts sono stati eliminati con successo.`);
    } catch (error) {
      errorHandler(error, ctx);
    }
    return ctx.answer();
  });

  bot.callbackQuery(cancelDeleteAllAlerts, async (ctx) => {
    await ctx.editText(`❌ Comando annullato. Nessun alert attivo è stato eliminato.`);
    return ctx.answer();
  });

  bot.callbackQuery(currentPriceFromComandoPrezzo, async (ctx) => {
    try {
      const isin = ctx.queryData.isin;

      const message = await handlePrezzoCommand(ctx, isin);
      const inlineKeyboard: TelegramInlineKeyboardButton[][] = [[{ text: "🔄 Aggiorna prezzo", callback_data: currentPriceFromComandoPrezzo.pack({ isin }) }]];
      const replyOptions: Partial<TelegramParams.EditMessageTextParams> = { reply_markup: { inline_keyboard: inlineKeyboard } };
      await ctx.editText(message, replyOptions);
    } catch (error) {
      errorHandler(error, ctx);
    }
    return ctx.answer();
  });

  bot.callbackQuery(currentPriceFromCallbackAlertsAttivi, async (ctx) => {
    try {
      const isin = ctx.queryData.isin;
      const alertId = ctx.queryData.alertId;

      const message = await handlePrezzoCommand(ctx, isin);
      const inlineKeyboard: TelegramInlineKeyboardButton[][] = [
        [{ text: "🔄 Aggiorna prezzo", callback_data: currentPriceFromCallbackAlertsAttivi.pack({ isin, alertId }) }],
        [{ text: "⬅️ Indietro", callback_data: preDeleteAlert.pack({ alertId }) }],
      ];
      const replyOptions: Partial<TelegramParams.EditMessageTextParams> = { reply_markup: { inline_keyboard: inlineKeyboard } };
      await ctx.editText(message, replyOptions);
    } catch (error) {
      errorHandler(error, ctx);
    }
    return ctx.answer();
  });
};
