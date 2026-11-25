import type { MyCallbackQueryContext, MyMessageContext } from "../types/custom-context.type";
import { AuthorizationAction } from "../enums/authorization-action.enum";
import { logger } from "../logger/logger";

export type OwnerCheck = (ctx: MyMessageContext | MyCallbackQueryContext, action: AuthorizationAction) => boolean;

/**
 * true se il mittente è l'owner del bot, altrimenti logga il tentativo e ritorna false.
 *
 * Estrazione fail-closed con `ctx.from?.id` (mai throw): i check nei comandi stanno
 * anche fuori dai `try`, quindi un throw non finirebbe in `errorHandler`.
 *
 * Il contesto fornisce il mittente e `AuthorizationAction` etichetta l’azione nei log.
 */
export const createOwnerCheck = (ownerTelegramId: number): OwnerCheck => (ctx, action) => {
  const telegramId = ctx.from?.id;

  if (typeof telegramId === "number" && telegramId === ownerTelegramId) return true;

  logger.warn(`Tentativo non autorizzato ${action} da ${ctx.from?.firstName} (ID: ${telegramId ?? "sconosciuto"})`);
  return false;
};
