import { Bot, TelegramParams, InlineKeyboard } from "gramio";
import { DatabaseHandler } from "../database/database-handler";
import { handleAlertsAttiviCommand, handlePrezzoCommand } from "./02-commands-helper";
import { errorHandler } from "../error/error-handler";
import { formatPrice } from "../../utils/price-formatter";
import {
  cancelDeleteAllAlerts,
  cancelDeleteAlert,
  currentPriceFromCallbackAlertsAttivi,
  currentPriceFromComandoPrezzo,
  deleteAllAlerts,
  deleteAlert,
  preDeleteAlert,
} from "./04-callbacks-data";

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

      const replyOptions: Partial<TelegramParams.EditMessageTextParams> = {
        reply_markup: new InlineKeyboard()
          .text("✅ Sì", deleteAlert.pack({ alertId }), { style: "success" })
          .text("❌ No", cancelDeleteAlert.pack(), { style: "danger" })
          .row()
          .text("💰 Prezzo Attuale", currentPriceFromCallbackAlertsAttivi.pack({ isin: alert.isin, alertId }), { style: "primary" }),
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
    try {
      await handleAlertsAttiviCommand(ctx);
    } catch (error) {
      errorHandler(error, ctx);
    }
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
    try {
      await ctx.editText(`❌ Comando annullato. Nessun alert attivo è stato eliminato.`);
    } catch (error) {
      errorHandler(error, ctx);
    }
    return ctx.answer();
  });

  bot.callbackQuery(currentPriceFromComandoPrezzo, async (ctx) => {
    try {
      const isin = ctx.queryData.isin;

      const message = await handlePrezzoCommand(ctx, isin);
      const replyOptions: Partial<TelegramParams.EditMessageTextParams> = {
        reply_markup: new InlineKeyboard().text("🔄 Aggiorna prezzo", currentPriceFromComandoPrezzo.pack({ isin })),
      };
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
      const replyOptions: Partial<TelegramParams.EditMessageTextParams> = {
        reply_markup: new InlineKeyboard()
          .text("🔄 Aggiorna prezzo", currentPriceFromCallbackAlertsAttivi.pack({ isin, alertId }))
          .row()
          .text("⬅️ Indietro", preDeleteAlert.pack({ alertId })),
      };
      await ctx.editText(message, replyOptions);
    } catch (error) {
      errorHandler(error, ctx);
    }
    return ctx.answer();
  });
};
