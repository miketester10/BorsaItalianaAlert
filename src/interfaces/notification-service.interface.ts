import type { Alert, Condition, UserStatus } from "@prisma/client";

export type NotificationResult =
  | { sent: true }
  | { sent: false; error: unknown; userStatus: UserStatus | null };

export interface NotificationService {
  /** Ritorna l’esito della consegna e lo stato utente applicabile in caso di errore. */
  sendAlert(alert: Alert, price: number, condition: Condition): Promise<NotificationResult>;
}
