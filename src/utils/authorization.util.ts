import type { MyCallbackQueryContext, MyMessageContext } from "../types/custom-context.type";
import { env } from "../config/env";
import { AuthorizationAction } from "../enums/authorization-action.enum";
import { logger } from "../logger/logger";

const OWNER_TELEGRAM_ID = env.OWNER_TELEGRAM_ID;

/**
 * true se il mittente è l'owner del bot, altrimenti logga il tentativo e ritorna false.
 *
 * Estrazione fail-closed con `ctx.from?.id` (mai throw): i check nei comandi stanno
 * anche fuori dai `try`, quindi un throw non finirebbe in `errorHandler`.
 *
 * @param ctx - Contesto Telegram del comando o del callback (da qui si legge il mittente).
 * @param action - Azione protetta (`AuthorizationAction`), usata come etichetta nel log.
 */
export const checkOwner = (ctx: MyMessageContext | MyCallbackQueryContext, action: AuthorizationAction): boolean => {
  const telegramId = ctx.from?.id;

  if (typeof telegramId === "number" && telegramId === OWNER_TELEGRAM_ID) return true;

  logger.warn(`Tentativo non autorizzato ${action} da ${ctx.from?.firstName} (ID: ${telegramId ?? "sconosciuto"})`);
  return false;
};
