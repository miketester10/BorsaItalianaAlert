import { format, FormattableString, italic, TelegramInlineKeyboardButton, TelegramParams, underline } from "gramio";
import { API } from "../../consts/api";
import { JWT } from "../../consts/jwt";
import { BorsaItalianaApiResponse, isBorsaItalianaValidResponse } from "../../interfaces/borsa-italiana-response.interface";
import { isCallbackContext, MyCallbackQueryContext, MyMessageContext } from "../../interfaces/custom-context.interface";
import { logger } from "../../logger/logger";
import { DatabaseHandler } from "../database/database-handler";
import { ApiHandler } from "../api/api-handler";
import { AlertHandler } from "../alert/alert-handler";
import { errorHandler } from "../error/error-handler";
import { isEditMessageOptions, isSendMessageOptions, TelegramOptions } from "../../types/telegram-options.type";

const dataBaseHandler: DatabaseHandler = DatabaseHandler.getInstance();
const apiHandler: ApiHandler = ApiHandler.getInstance();
const alertHandler: AlertHandler = AlertHandler.getInstance();

export const handleStartCommand = async (ctx: MyMessageContext): Promise<void> => {
  const telegramId = ctx.from?.id!;
  const name = ctx.from?.firstName!;
  const username = ctx.from?.username ?? null;

  try {
    await ctx.sendChatAction("typing");

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
    errorHandler(error, ctx);
  }
};

export const handlePrezzoCommand = async (ctx: MyMessageContext | MyCallbackQueryContext, codiceIsin?: string): Promise<void> => {
  const isinRaw = ctx.update?.message?.text?.trim().split(/\s+/)[1]?.toUpperCase();
  let isin: string;
  let message: string;
  let inlineKeyboard: TelegramInlineKeyboardButton[][];
  let replyOptions: TelegramOptions = {};

  try {
    if (!isCallbackContext(ctx)) {
      await ctx.sendChatAction("typing");

      if (!isinRaw) {
        await ctx.reply(`⚠️ Inserisci un ISIN valido.`);
        return;
      } else {
        isin = isinRaw;
      }
    } else {
      if (!codiceIsin) throw new Error(`ISIN non ricevuto dalla Callback`);
      isin = codiceIsin;
      inlineKeyboard = [[{ text: "⬅️ Torna agli alerts attivi", callback_data: `back:all_alerts` }]];
      replyOptions = { reply_markup: { inline_keyboard: inlineKeyboard } };
    }

    const response = await apiHandler.getPrice<BorsaItalianaApiResponse>(`${API.BORSA_ITALIANA}${isin}${API.BORSA_ITALIANA_TAIL}`, {
      Authorization: `Bearer ${JWT.BORSA_ITALIANA}`,
    });

    if (isBorsaItalianaValidResponse(response)) {
      const price = response.intradayPoint.at(-1)?.endPx;
      const label = response.label;
      message = `ISIN: ${isin}\nLabel: ${label}\n💰 Prezzo: ${price}€`;
      logger.info(`Ultimo prezzo: ${price}€`);
    } else {
      message = `⚠️ ISIN non valido o non trovato.`;
      logger.warn(`ISIN ${isin} non valido o non trovato.`);
    }

    await replyOrEdit(ctx, message, replyOptions);
  } catch (error) {
    errorHandler(error, ctx);
  }
};

export const handleAlertCommand = async (ctx: MyMessageContext): Promise<void> => {
  const userTelegramId = ctx.from?.id!;
  const [command, isinRaw, priceRaw] = ctx.update?.message?.text?.trim().split(/\s+/) as [string, string | undefined, string | undefined];
  const isin = isinRaw?.toUpperCase();
  const alertPrice = Number(priceRaw?.replace(",", "."));
  let message: string;

  try {
    await ctx.sendChatAction("typing");

    if (!isin || isNaN(alertPrice)) {
      await ctx.reply(`⚠️ Inserisci un ISIN ed un prezzo valido.`);
      return;
    }

    const response = await apiHandler.getPrice<BorsaItalianaApiResponse>(`${API.BORSA_ITALIANA}${isin}${API.BORSA_ITALIANA_TAIL}`, {
      Authorization: `Bearer ${JWT.BORSA_ITALIANA}`,
    });

    if (isBorsaItalianaValidResponse(response)) {
      const alert = await dataBaseHandler.findAlert(userTelegramId, isin, alertPrice);
      if (alert) {
        message = `⚠️ Alert già registrato.`;
        logger.warn(`Alert già registrato.`);
      } else {
        const label = response.label;
        const lastCheckPrice = response.intradayPoint.at(-1)?.endPx!;
        const lastCondition = alertHandler.calculateCondition(lastCheckPrice, alertPrice);
        await dataBaseHandler.createAlert({ userTelegramId, isin, label, alertPrice, lastCondition, lastCheckPrice });
        message = `✅ Alert registrato con successo.`;
        logger.info(`Alert per ISIN ${isin} registrato con successo. Alert price: ${alertPrice}€`);
      }
    } else {
      message = `⚠️ ISIN non trovato. Nessun alert è stato registrato.`;
      logger.warn(`ISIN ${isin} non trovato. Nessun alert è stato registrato.`);
    }

    await ctx.reply(message);
  } catch (error) {
    errorHandler(error, ctx);
  }
};

export const handleAlertsAttiviCommand = async (ctx: MyMessageContext | MyCallbackQueryContext): Promise<void> => {
  const userTelegramId = ctx.from?.id!;
  let message: string | FormattableString;
  let inlineKeyboard: TelegramInlineKeyboardButton[][];
  let replyOptions: TelegramOptions = {};

  try {
    if (!isCallbackContext(ctx)) {
      await ctx.sendChatAction("typing");
    }

    const alerts = await dataBaseHandler.findAllAlertsByTelegramId(userTelegramId);

    if (alerts.length > 0) {
      // Ordina gli alert per ISIN (alfabetico) e per prezzo (decrescente)
      alerts.sort((a, b) => {
        const isinCompare = a.isin.localeCompare(b.isin);
        if (isinCompare !== 0) return isinCompare;
        return b.alertPrice - a.alertPrice;
      });

      message = format`📋 Lista degli alerts attivi\n\n${underline(italic(`Seleziona un alert per eliminarlo \no per controllare il prezzo attuale`))}`;

      // Creo i pulsanti inline per ogni alert
      inlineKeyboard = alerts.map((alert, _index) => [
        {
          text: `${_index + 1}: ${alert.isin} - ${alert.alertPrice}€`,
          callback_data: `pre_delete:single_alert:${alert.id}`,
        },
      ]);

      replyOptions = { reply_markup: { inline_keyboard: inlineKeyboard } };
    } else {
      message = `⚠️ Non hai nessun alert attivo.`;
    }

    await replyOrEdit(ctx, message, replyOptions);
  } catch (error) {
    errorHandler(error, ctx);
  }
};

export const handleEliminaAlertsCommand = async (ctx: MyMessageContext): Promise<void> => {
  const userTelegramId = ctx.from?.id!;
  let message: string | FormattableString;
  let inlineKeyboard: TelegramInlineKeyboardButton[][];
  let replyOptions: TelegramOptions = {};

  try {
    await ctx.sendChatAction("typing");

    const alerts = await dataBaseHandler.findAllAlertsByTelegramId(userTelegramId);

    if (alerts.length > 0) {
      message = `⚠️ Vuoi eliminare tutti gli alerts attivi?`;
      inlineKeyboard = [
        [
          { text: "✅ Sì", callback_data: "delete:all_alerts" },
          { text: "❌ No", callback_data: "cancel_delete:all_alerts" },
        ],
      ];

      replyOptions.reply_markup = { inline_keyboard: inlineKeyboard };
    } else {
      message = `⚠️ Non hai nessun alert attivo da eliminare.`;
    }

    await ctx.reply(message, replyOptions);
  } catch (error) {
    errorHandler(error, ctx);
  }
};

export const replyOrEdit = async (ctx: MyMessageContext | MyCallbackQueryContext, text: string | FormattableString, options?: TelegramOptions): Promise<void> => {
  if (isCallbackContext(ctx)) {
    if (isEditMessageOptions(options)) {
      await ctx.editText(text, options);
    } else {
      await ctx.editText(text);
    }
  } else {
    if (isSendMessageOptions(options)) {
      await ctx.reply(text, options);
    } else {
      await ctx.reply(text);
    }
  }
};
