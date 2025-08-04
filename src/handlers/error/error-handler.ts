import { AxiosError } from "axios";
import { BorsaItalianaHttpErrorResponse } from "../../interfaces/borsa-italiana-response.interface";
import { logger } from "../../logger/logger";
import { MyMessageContext } from "../../interfaces/custom-context.interface";
import { code, format, FormattableString } from "gramio";

export const errorHandler = (error: unknown): FormattableString => {
  const defaultErrorMessage = format`${code(`❌ Si è verificato un errore. Riprova più tardi.`)}`;

  if (error instanceof AxiosError) {
    const message = (error as AxiosError<BorsaItalianaHttpErrorResponse>).response?.data.message || error.message;
    const status = error.response?.status || "Unknown";
    const errorMessage = `Status ${status} - Message: ${message}`;
    logger.error(`Axios Error: ${errorMessage}`);
  } else {
    const unknownErrorMessage = (error as Error).message;
    logger.error(`Unknown Error: ${unknownErrorMessage}`);
  }

  return defaultErrorMessage;
};
