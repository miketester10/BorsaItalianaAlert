import { format, FormattableString, italic, TelegramInlineKeyboardButton, underline } from "gramio";
import { API } from "../../consts/api";
import { JWT } from "../../consts/jwt";
import { BorsaItalianaApiResponse, isBorsaItalianaValidResponse } from "../../interfaces/borsa-italiana-response.interface";
import { isCallbackContext, MyCallbackQueryContext, MyMessageContext } from "../../interfaces/custom-context.interface";
import { logger } from "../../logger/logger";
import { ApiHandler } from "../api/api-handler";
import { DatabaseHandler } from "../database/database-handler";
import { errorHandler } from "../error/error-handler";

const dataBaseHandler: DatabaseHandler = DatabaseHandler.getInstance();
const apiHandler: ApiHandler = ApiHandler.getInstance();

export const handleStartCommand = async (ctx: MyMessageContext): Promise<void> => {
  try {
    await ctx.sendChatAction("typing");
    const telegramId = ctx.from?.id!;
    const name = ctx.from?.firstName!;
    const username = ctx.from?.username ?? null;
    logger.info(`Bot avviato da: ${name} - Telegram ID: ${telegramId}`);

    const user = await dataBaseHandler.findUserByTelegramId(telegramId);
    if (user) {
      const isUpdated = await dataBaseHandler.updateUser(telegramId, user, { name, username });
      logger.warn(`Utente già registrato. ${isUpdated ? `Dati aggiornati con successo.` : `Nessun dato da aggiornare è stato trovato.`}`);
    } else {
      await dataBaseHandler.createUser({ telegramId, name, username });
      logger.info(`Nuovo utente registrato con successo.`);
    }
    await ctx.reply(`👋 Ciao ${name}`);
  } catch (error) {
    handleError(error, ctx);
  }
};

export const handlePrezzoCommand = async (ctx: MyMessageContext): Promise<void> => {
  try {
    await ctx.sendChatAction("typing");
    const isin = ctx.update?.message?.text?.trim().split(/\s+/)[1]?.toUpperCase();
    if (!isin) {
      await ctx.reply("⚠️ Inserisci un ISIN valido.");
      return;
    }
    const response = await apiHandler.getPrice<BorsaItalianaApiResponse>(`${API.BORSA_ITALIANA}${isin}${API.BORSA_ITALIANA_TAIL}`, {
      Authorization: `Bearer ${JWT.BORSA_ITALIANA}`,
    });
    if (isBorsaItalianaValidResponse(response)) {
      const price = response.intradayPoint.at(-1)?.endPx;
      const label = response.label;
      logger.info(`Ultimo prezzo: ${price}€`);
      await ctx.reply(`ISIN: ${isin}\nLabel: ${label}\n💰 Prezzo: ${price}€`);
    } else {
      logger.warn(`ISIN ${isin} non valido o non trovato.`);
      await ctx.reply("⚠️ ISIN non valido o non trovato.");
    }
  } catch (error) {
    handleError(error, ctx);
  }
};

export const handleAlertCommand = async (ctx: MyMessageContext): Promise<void> => {
  try {
    await ctx.sendChatAction("typing");
    const userTelegramId = ctx.from?.id!;
    const [command, isinRaw, priceRaw] = ctx.update?.message?.text?.trim().split(/\s+/) as [string, string | undefined, string | undefined];
    const isin = isinRaw?.toUpperCase();
    const alertPrice = Number(priceRaw?.replace(",", "."));
    if (!isin || isNaN(alertPrice)) {
      await ctx.reply("⚠️ Inserisci un ISIN ed un prezzo valido.");
      return;
    }
    const response = await apiHandler.getPrice<BorsaItalianaApiResponse>(`${API.BORSA_ITALIANA}${isin}${API.BORSA_ITALIANA_TAIL}`, {
      Authorization: `Bearer ${JWT.BORSA_ITALIANA}`,
    });
    if (isBorsaItalianaValidResponse(response)) {
      const alert = await dataBaseHandler.findAlert(userTelegramId, isin, alertPrice);
      if (alert) {
        logger.warn(`Alert già registrato.`);
        await ctx.reply(`⚠️ Alert già registrato.`);
      } else {
        const label = response.label;
        await dataBaseHandler.createAlert({ userTelegramId, isin, label, alertPrice });
        logger.info(`Alert per ISIN ${isin} registrato con successo. Alert price: ${alertPrice}€`);
        await ctx.reply(`✅ Alert registrato con successo.`);
      }
    } else {
      logger.warn(`ISIN ${isin} non trovato. Nessun alert è stato registrato.`);
      await ctx.reply(`⚠️ ISIN non trovato. Nessun alert è stato registrato.`);
    }
  } catch (error) {
    handleError(error, ctx);
  }
};

export const handleAlertsAttiviCommand = async (ctx: MyMessageContext | MyCallbackQueryContext): Promise<void> => {
  try {
    if (!isCallbackContext(ctx)) {
      await ctx.sendChatAction("typing");
    }

    const userTelegramId = ctx.from?.id!;
    const alerts = await dataBaseHandler.findAllAlertsByTelegramId(userTelegramId);

    if (alerts.length > 0) {
      let message = format`📋 Lista degli alert attivi\n\n${underline(italic(`Seleziona un alert per eliminarlo singolarmente`))}`;

      // Creo i pulsanti inline per ogni alert
      const inlineKeyboard: TelegramInlineKeyboardButton[][] = alerts.map((alert, _index) => [
        {
          text: `${_index + 1}: ${alert.isin} - ${alert.alertPrice}€`,
          callback_data: `pre_delete:single_alert:${alert.id}`,
        },
      ]);

      const replyOptions = {
        reply_markup: { inline_keyboard: inlineKeyboard },
      };

      await replyOrEdit(ctx, message, replyOptions);
    } else {
      await replyOrEdit(ctx, `⚠️ Non hai nessun alert attivo.`);
    }
  } catch (error) {
    handleError(error, ctx);
  }
};

export const handleEliminaAlertsCommand = async (ctx: MyMessageContext): Promise<void> => {
  try {
    await ctx.sendChatAction("typing");

    const userTelegramId = ctx.from?.id!;
    const alerts = await dataBaseHandler.findAllAlertsByTelegramId(userTelegramId);
    if (alerts.length > 0) {
      const message = "⚠️ Vuoi eliminare tutti gli alerts attivi?";
      const inlineKeyboard: TelegramInlineKeyboardButton[][] = [
        [
          { text: "✅ Sì", callback_data: "delete:all_alerts" },
          { text: "❌ No", callback_data: "cancel_delete:all_alerts" },
        ],
      ];

      const replyOptions = {
        reply_markup: { inline_keyboard: inlineKeyboard },
      };
      await ctx.reply(message, replyOptions);
    } else {
      await ctx.reply(`⚠️ Non hai nessun alert attivo da eliminare.`);
    }
  } catch (error) {
    handleError(error, ctx);
  }
};

export const handleError = async (error: unknown, ctx: MyMessageContext | MyCallbackQueryContext): Promise<void> => {
  try {
    const message = errorHandler(error);
    await replyOrEdit(ctx, message);
  } catch (error) {
    logger.error(`Invio del messaggio di errore a Telegram non riuscito: ${(error as Error).message}`);
  }
};

const replyOrEdit = async (ctx: MyMessageContext | MyCallbackQueryContext, text: string | FormattableString, options?: Object): Promise<void> => {
  if (isCallbackContext(ctx)) {
    await ctx.editText(text, options);
  } else {
    await ctx.reply(text, options);
  }
};
