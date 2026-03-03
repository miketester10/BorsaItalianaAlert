import { CallbackData } from "gramio";
import { CallbackId } from "../../enums/callback-id.enum";
import { CallbackKey } from "../../enums/callback-key.enum";

export const preDeleteAlert = new CallbackData(CallbackId.PRE_DELETE_ALERT).string(CallbackKey.ALERT_ID);

export const deleteAlert = new CallbackData(CallbackId.DELETE_ALERT).string(CallbackKey.ALERT_ID);
export const deleteAllAlerts = new CallbackData(CallbackId.DELETE_ALL_ALERTS);

export const cancelDeleteAlert = new CallbackData(CallbackId.CANCEL_DELETE_ALERT);
export const cancelDeleteAllAlerts = new CallbackData(CallbackId.CANCEL_DELETE_ALL_ALERTS);

export const currentPriceFromComandoPrezzo = new CallbackData(CallbackId.CURRENT_PRICE_FROM_COMANDO_PREZZO).string(CallbackKey.ISIN);
export const currentPriceFromCallbackAlertsAttivi = new CallbackData(CallbackId.CURRENT_PRICE_FROM_CALLBACK_ALERTS_ATTIVI)
  .string(CallbackKey.ISIN)
  .string(CallbackKey.ALERT_ID);
