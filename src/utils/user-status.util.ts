import { UserStatus } from "@prisma/client";
import { TelegramError } from "gramio";

/**
 * Classifica lo stato di un utente Telegram a partire dall'errore restituito
 * dal Bot API durante l'invio di un messaggio.
 * Ritorna null se l'errore non indica un cambio di stato (es. rete, server, ecc.).
 */
export const getUserStatusFromTelegramError = (error: unknown): UserStatus | null => {
  if (!(error instanceof TelegramError)) return null;

  const message = error.message.toLowerCase();
  if (message.includes("blocked by the user")) return UserStatus.blocked;
  if (message.includes("user is deactivated")) return UserStatus.deactivated;

  return null;
};
