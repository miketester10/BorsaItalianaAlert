import { AxiosError } from "axios";
import { BorsaItalianaHttpErrorResponse } from "../../interfaces/borsa-italiana-response.interface";
import { logger } from "../../logger/logger";
import { code, format, TelegramError } from "gramio";
import { MyCallbackQueryContext, MyMessageContext } from "../../interfaces/custom-context.interface";
import { replyOrEdit } from "../bot/commands-helper";

export const errorHandler = async (error: unknown, ctx: MyMessageContext | MyCallbackQueryContext): Promise<void> => {
  const defaultErrorMessage = format`${code(`❌ Si è verificato un errore. Riprova più tardi.`)}`;

  if (error instanceof TelegramError && error.message.includes("message is not modified")) {
    await (ctx as MyCallbackQueryContext).answerCallbackQuery(); // Stop animation of the button
    logger.error(`Telegram Error: ${error.message}`);
  } else if (error instanceof AxiosError) {
    const message = (error as AxiosError<BorsaItalianaHttpErrorResponse>).response?.data.message || error.message;
    const status = error.response?.status || "Unknown";
    const errorMessage = `Status ${status} - Message: ${message}`;
    logger.error(`Axios Error: ${errorMessage}`);
  } else {
    const unknownErrorMessage = (error as Error).message;
    logger.error(`Unknown Error: ${unknownErrorMessage}`);
  }

  try {
    await replyOrEdit(ctx, defaultErrorMessage);
  } catch (e) {
    logger.error(`Invio del messaggio di errore a Telegram non riuscito: ${(e as Error).message}`);
  }
};
