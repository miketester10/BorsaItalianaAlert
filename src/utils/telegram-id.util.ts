import type { MyCallbackQueryContext, MyMessageContext } from "../types/custom-context.type";

/**
 * Estrae il Telegram ID del mittente o lancia se assente.
 * Sostituisce `ctx.from?.id!`: il throw finisce nel `try/catch` del chiamante
 * (`errorHandler`), mai `undefined` silenzioso a runtime.
 */
export const requireTelegramId = (ctx: MyMessageContext | MyCallbackQueryContext): number => {
  const telegramId = ctx.from?.id;
  if (typeof telegramId !== "number") {
    throw new Error("Telegram ID mittente mancante");
  }
  return telegramId;
};
