import type { MyCallbackQueryContext, MyMessageContext } from "../types/custom-context.type";
import { env } from "../config/env";
import { logger } from "../logger/logger";

const OWNER_TELEGRAM_ID = env.OWNER_TELEGRAM_ID;

/**
 * true se il mittente è l'owner del bot, altrimenti logga il tentativo e ritorna false.
 *
 * Estrazione fail-closed con `ctx.from?.id` (mai throw): i check nei comandi stanno
 * anche fuori dai `try`, quindi un throw non finirebbe in `errorHandler`.
 *
 * @param ctx - Contesto Telegram del comando o del callback (da qui si legge il mittente).
 * @param action - Etichetta per il log, es. "comando [ /kofi_user ]" o "callback [ confirmKofiAll ]"
 */
export const checkOwner = (ctx: MyMessageContext | MyCallbackQueryContext, action: string): boolean => {
  const telegramId = ctx.from?.id;

  if (typeof telegramId === "number" && telegramId === OWNER_TELEGRAM_ID) return true;

  logger.warn(`Tentativo non autorizzato ${action} da ${ctx.from?.firstName} (ID: ${telegramId ?? "sconosciuto"})`);
  return false;
};
