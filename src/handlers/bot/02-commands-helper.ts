import { format, FormattableString, italic, TelegramParams, underline, InlineKeyboard, blockquote, code, bold } from "gramio";
import { API } from "../../consts/api";
import { JWT } from "../../consts/jwt";
import { BorsaItalianaApiResponse, isBorsaItalianaValidResponse } from "../../interfaces/borsa-italiana-response.interface";
import { isCallbackContext, MyCallbackQueryContext, MyMessageContext } from "../../types/custom-context.type";
import { logger } from "../../logger/logger";
import { DatabaseHandler } from "../database/database-handler";
import { ApiHandler } from "../api/api-handler";
import { AlertHandler } from "../alert/alert-handler";
import { errorHandler } from "../error/error-handler";
import { TelegramOptionsCustom } from "../../types/telegram-options-custom.type";
import { validateInput } from "../../schemas/input-validator.schema";
import { CommandType } from "../../enums/command-type.enum";
import { formatPrice } from "../../utils/price-formatter";
import { currentPriceFromComandoPrezzo, preDeleteAlert, deleteAllAlerts, cancelDeleteAllAlerts } from "./04-callbacks-data";

const dataBaseHandler: DatabaseHandler = DatabaseHandler.getInstance();
const apiHandler: ApiHandler = ApiHandler.getInstance();
const alertHandler: AlertHandler = AlertHandler.getInstance();

export async function handlePrezzoCommand(ctx: MyMessageContext): Promise<void>;
export async function handlePrezzoCommand(ctx: MyCallbackQueryContext, isinFromCallback: string): Promise<FormattableString>;
export async function handlePrezzoCommand(ctx: MyMessageContext | MyCallbackQueryContext, isinFromCallback?: string): Promise<FormattableString | void> {
  const isinRaw = ctx.update?.message?.text?.trim().split(/\s+/)[1]?.toUpperCase();
  let isin: string;
  let message: FormattableString;

  try {
    if (!isCallbackContext(ctx)) {
      await ctx.sendChatAction("typing");

      const validation = validateInput(CommandType.PREZZO, isinRaw);

      if (!validation.success) {
        logger.error(validation.errors);
        message = code(`⚠️ Inserisci un ISIN valido.`);
        await ctx.reply(message);
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
      const price = response.intradayPoint.at(-1)?.endPx!;
      const label = response.label;
      message = blockquote(
        format`${bold("🆔 ISIN:")} ${code(isin)}
                    ${bold("🏷️ Label:")} ${code(label)}
                    ${bold("💰 Prezzo:")} ${code(`${formatPrice(price)}€`)}
                  `,
      );
      logger.info(`Ultimo prezzo: ${price}€`);
    } else {
      message = code(`⚠️ ISIN non valido o non trovato.`);
      logger.warn(`ISIN ${isin} non valido o non trovato.`);
      await replyOrEdit(ctx, message);
      return;
    }

    if (isCallbackContext(ctx)) {
      return message;
    } else {
      const replyOptions: TelegramOptionsCustom = {
        reply_markup: new InlineKeyboard().text("🔄 Aggiorna prezzo", currentPriceFromComandoPrezzo.pack({ isin })),
      };
      await replyOrEdit(ctx, message, replyOptions);
    }
  } catch (error) {
    errorHandler(error, ctx);
  }
}

export const handleAlertCommand = async (ctx: MyMessageContext): Promise<void> => {
  const userTelegramId = ctx.from?.id!;
  const [command, isinRaw, priceRaw] = ctx.update?.message?.text?.trim().split(/\s+/) as [string, string | undefined, string | undefined];
  let message: FormattableString;

  try {
    await ctx.sendChatAction("typing");

    const validation = validateInput(CommandType.ALERT, isinRaw, priceRaw);

    if (!validation.success) {
      logger.error(validation.errors);
      message = code(`⚠️ Inserisci un ISIN ed un prezzo valido.`);
      await ctx.reply(message);
      return;
    }

    const { isin, alertPrice } = validation.data;

    const response = await apiHandler.getPrice<BorsaItalianaApiResponse>(`${API.BORSA_ITALIANA}${isin}${API.BORSA_ITALIANA_TAIL}`, {
      Authorization: `Bearer ${JWT.BORSA_ITALIANA}`,
    });

    if (isBorsaItalianaValidResponse(response)) {
      const alert = await dataBaseHandler.findAlert(userTelegramId, isin, alertPrice);
      if (alert) {
        message = code(`⚠️ Alert già registrato.`);
        logger.warn(`Alert già registrato.`);
      } else {
        const label = response.label;
        const lastCheckPrice = response.intradayPoint.at(-1)?.endPx!;
        const lastCondition = alertHandler.calculateCondition(lastCheckPrice, alertPrice);
        await dataBaseHandler.createAlert({ userTelegramId, isin, label, alertPrice, lastCondition, lastCheckPrice });
        message = code(`✅ Alert registrato con successo.`);
        logger.info(`Alert per ISIN ${isin} registrato con successo. Alert price: ${formatPrice(alertPrice)}€`);
      }
    } else {
      message = code(`⚠️ ISIN non trovato. Nessun alert è stato registrato.`);
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

      message = blockquote(
        format`${bold("📋 Lista degli alerts attivi")}

                    ${underline(italic("Seleziona un alert per eliminarlo \no per controllare il prezzo attuale"))}
                  `,
      );

      // Creo i pulsanti inline per ogni alert
      const keyboard = new InlineKeyboard();
      alerts.forEach((alert, _index) => {
        let textButton = `${_index + 1}: ${alert.isin} - ${formatPrice(alert.alertPrice)}€`;
        keyboard.text(textButton, preDeleteAlert.pack({ alertId: alert.id }), { style: "primary" }).row();
      });

      replyOptions = { reply_markup: keyboard };
    } else {
      message = code(`⚠️ Non hai nessun alert attivo.`);
    }

    await replyOrEdit(ctx, message, replyOptions);
  } catch (error) {
    errorHandler(error, ctx);
  }
};

export const handleEliminaAlertsCommand = async (ctx: MyMessageContext): Promise<void> => {
  const userTelegramId = ctx.from?.id!;
  let message: string | FormattableString;
  let replyOptions: TelegramOptionsCustom = {};

  try {
    await ctx.sendChatAction("typing");

    const alerts = await dataBaseHandler.findAllAlertsByTelegramId(userTelegramId);

    if (alerts.length > 0) {
      message = blockquote(format`${bold("⚠️ Vuoi eliminare tutti gli alerts attivi?")}`);
      replyOptions.reply_markup = new InlineKeyboard()
        .text("✅ Sì", deleteAllAlerts.pack(), { style: "success" })
        .text("❌ No", cancelDeleteAllAlerts.pack(), { style: "danger" });
    } else {
      message = code(`⚠️ Non hai nessun alert attivo da eliminare.`);
    }

    await ctx.reply(message, replyOptions);
  } catch (error) {
    errorHandler(error, ctx);
  }
};

export const replyOrEdit = async (
  ctx: MyMessageContext | MyCallbackQueryContext,
  text: string | FormattableString,
  options?: TelegramOptionsCustom,
): Promise<void> => {
  if (isCallbackContext(ctx)) {
    await ctx.editText(text, options as TelegramParams.EditMessageTextParams);
  } else {
    await ctx.reply(text, options);
  }
};
