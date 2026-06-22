import { Bot, TelegramParams, InlineKeyboard, code, format, blockquote, bold, underline, italic } from "gramio";
import { DatabaseHandler } from "../database/database-handler";
import { handleAlertsAttiviCommand, handlePrezzoCommand } from "./02-commands-helper";
import { errorHandler } from "../error/error-handler";
import { logger } from "../../logger/logger";
import { formatPrice } from "../../utils/price-formatter";
import {
  cancelDeleteAllAlerts,
  cancelDeleteAlert,
  cancelKofiAll,
  confirmKofiAll,
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
        await ctx.editText(code(`❌ Alert non trovato.`));
        return ctx.answer();
      }

      const message = blockquote(
        format`⚠️ ${bold(format`${underline("Vuoi eliminare l'alert selezionato?")}`)}

                    ${bold("🆔 ISIN:")} ${code(alert.isin)}
                    ${bold("🏷️ Label:")} ${code(alert.label)}
                    ${bold("🔔 Alert Price:")} ${code(`${formatPrice(alert.alertPrice)}€`)}
                  `,
      );

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
        await ctx.editText(code(`❌ Alert non trovato.`));
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
      await ctx.editText(code(`✅ Tutti gli alerts sono stati eliminati con successo.`));
    } catch (error) {
      errorHandler(error, ctx);
    }
    return ctx.answer();
  });

  bot.callbackQuery(cancelDeleteAllAlerts, async (ctx) => {
    try {
      await ctx.editText(code(`❌ Comando annullato. Nessun alert attivo è stato eliminato.`));
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
        reply_markup: new InlineKeyboard().text("🔄 Aggiorna prezzo", currentPriceFromComandoPrezzo.pack({ isin }), { style: "primary" }),
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
          .text("🔄 Aggiorna prezzo", currentPriceFromCallbackAlertsAttivi.pack({ isin, alertId }), { style: "primary" })
          .row()
          .text("⬅️ Indietro", preDeleteAlert.pack({ alertId })),
      };
      await ctx.editText(message, replyOptions);
    } catch (error) {
      errorHandler(error, ctx);
    }
    return ctx.answer();
  });

  bot.callbackQuery(confirmKofiAll, async (ctx) => {
    try {
      const OWNER_TELEGRAM_ID = Number(process.env.OWNER_TELEGRAM_ID);

      await ctx.editText(code("⏳ Preparazione invio..."));

      const users = await dataBaseHandler.findAllUsers();
      const filteredUsers = users.filter((user) => user.telegramId !== OWNER_TELEGRAM_ID);
      const skipped = users.length - filteredUsers.length;

      if (filteredUsers.length === 0) {
        await ctx.editText(code("⚠️ Non è stato trovato nessun utente oltre all'admin."));
        return ctx.answer();
      }

      const label = filteredUsers.length === 1 ? "utente" : "utenti";
      await ctx.editText(format`${bold(`📬 Invio invito caffè a ${filteredUsers.length} ${label}...`)}`);

      const delayMs = Math.max(100, Number(process.env.KOFI_DELAY_MS) || 500);
      const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

      await ctx.editText(reportMessage);
    } catch (error) {
      errorHandler(error, ctx);
    }
    return ctx.answer();
  });

  bot.callbackQuery(cancelKofiAll, async (ctx) => {
    try {
      await ctx.editText(code("❌ Comando annullato."));
    } catch (error) {
      errorHandler(error, ctx);
    }
    return ctx.answer();
  });
};
