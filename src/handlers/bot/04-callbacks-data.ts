import { CallbackData } from "gramio";
import { CallbackId } from "../../enums/callback-id.enum";
import { CallbackKey } from "../../enums/callback-key.enum";

export const preDeleteAlert = new CallbackData(CallbackId.PRE_DELETE_ALERT).string(CallbackKey.ALERT_ID);
export const deleteAlert = new CallbackData(CallbackId.DELETE_ALERT).string(CallbackKey.ALERT_ID);
export const deleteAllAlerts = new CallbackData(CallbackId.DELETE_ALL_ALERTS);

export const cancelDeleteAlert = new CallbackData(CallbackId.CANCEL_DELETE_ALERT);
export const cancelDeleteAllAlerts = new CallbackData(CallbackId.CANCEL_DELETE_ALL_ALERTS);

export const currentPriceFromComandoPrezzo = new CallbackData(CallbackId.CURRENT_PRICE_FROM_COMANDO_PREZZO).string(CallbackKey.ISIN);
export const currentPriceFromCallbackAlertsAttivi = new CallbackData(CallbackId.CURRENT_PRICE_FROM_CALLBACK_ALERTS_ATTIVI).string(CallbackKey.ISIN).string(CallbackKey.ALERT_ID);

export const confirmKofiAll = new CallbackData(CallbackId.CONFIRM_KOFI_ALL);
export const confirmKofiNewUsers = new CallbackData(CallbackId.CONFIRM_KOFI_NEW_USERS);

export const cancelKofiAll = new CallbackData(CallbackId.CANCEL_KOFI_ALL);
export const cancelKofiNewUsers = new CallbackData(CallbackId.CANCEL_KOFI_NEW_USERS);

export const confirmMarkKofiDonor = new CallbackData(CallbackId.CONFIRM_MARK_KOFI_DONOR).number(CallbackKey.KOFI_DONOR_TELEGRAM_ID);
export const cancelMarkKofiDonor = new CallbackData(CallbackId.CANCEL_MARK_KOFI_DONOR);
