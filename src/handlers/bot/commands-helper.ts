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
import { TelegramOptionsCustom } from "../../types/telegram-options-custom.type";
import { validateInput } from "../../schemas/input-validator.schema";
import { CommandType } from "../../enums/command-type.enum";
import { formatPrice } from "../../utils/price-formatter";
import { CallbackPayload } from "../../enums/callback-payload.enum";

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

export async function handlePrezzoCommand(ctx: MyMessageContext): Promise<void>;
export async function handlePrezzoCommand(ctx: MyCallbackQueryContext, isinFromCallback: string): Promise<string>;
export async function handlePrezzoCommand(ctx: MyMessageContext | MyCallbackQueryContext, isinFromCallback?: string): Promise<string | void> {
  const isinRaw = ctx.update?.message?.text?.trim().split(/\s+/)[1]?.toUpperCase();
  let isin: string;
  let message: string;

  try {
    if (!isCallbackContext(ctx)) {
      await ctx.sendChatAction("typing");

      const validation = validateInput(CommandType.PREZZO, isinRaw);

      if (!validation.success) {
        logger.error(validation.errors);
        await ctx.reply(`⚠️ Inserisci un ISIN valido.`);
        return;
      } else {
        isin = validation.data;
      }
    } else {
      if (!isinFromCallback) throw new Error(`ISIN non ricevuto dalla Callback`);
      isin = isinFromCallback;
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

    if (isCallbackContext(ctx)) {
      return message;
    } else {
      const inlineKeyboard: TelegramInlineKeyboardButton[][] = [[{ text: "🔄 Aggiorna prezzo", callback_data: `current_price:${CallbackPayload.FROM_COMANDO_PREZZO}:${isin}` }]];
      const replyOptions: TelegramOptionsCustom = { reply_markup: { inline_keyboard: inlineKeyboard } };
      await replyOrEdit(ctx, message, replyOptions);
    }
  } catch (error) {
    errorHandler(error, ctx);
  }
}

export const handleAlertCommand = async (ctx: MyMessageContext): Promise<void> => {
  const userTelegramId = ctx.from?.id!;
  const [command, isinRaw, priceRaw] = ctx.update?.message?.text?.trim().split(/\s+/) as [string, string | undefined, string | undefined];
  let message: string;

  try {
    await ctx.sendChatAction("typing");

    const validation = validateInput(CommandType.ALERT, isinRaw, priceRaw);

    if (!validation.success) {
      logger.error(validation.errors);
      await ctx.reply(`⚠️ Inserisci un ISIN ed un prezzo valido.`);
      return;
    }

    const { isin, alertPrice } = validation.data;

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
        logger.info(`Alert per ISIN ${isin} registrato con successo. Alert price: ${formatPrice(alertPrice)}€`);
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
  let replyOptions: TelegramOptionsCustom = {};

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
          text: `${_index + 1}: ${alert.isin} - ${formatPrice(alert.alertPrice)}€`,
          callback_data: `pre_delete:${CallbackPayload.SINGLE_ALERT}:${alert.id}`,
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
  let replyOptions: TelegramOptionsCustom = {};

  try {
    await ctx.sendChatAction("typing");

    const alerts = await dataBaseHandler.findAllAlertsByTelegramId(userTelegramId);

    if (alerts.length > 0) {
      message = `⚠️ Vuoi eliminare tutti gli alerts attivi?`;
      inlineKeyboard = [
        [
          { text: "✅ Sì", callback_data: `delete:${CallbackPayload.ALL_ALERTS}` },
          { text: "❌ No", callback_data: `cancel_delete:${CallbackPayload.ALL_ALERTS}` },
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

export const replyOrEdit = async (ctx: MyMessageContext | MyCallbackQueryContext, text: string | FormattableString, options?: TelegramOptionsCustom): Promise<void> => {
  if (isCallbackContext(ctx)) {
    await ctx.editText(text, options as TelegramParams.EditMessageTextParams);
  } else {
    await ctx.reply(text, options);
  }
};
