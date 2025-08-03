export interface Alert {
  isin: string;
  targetPrice: number;
  above: boolean;
  below: boolean;
  lastNotificationSent: boolean; // per tracciare l'ultimo stato di notifica
  lastCheckPrice: number
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  telegramId: number; // ID univoco dell'utente Telegram
  name: string; // Nome dell'utente
  username: string | null; // Username Telegram
  alerts: Alert[]; // Array di alert dell'utente
  createdAt: Date;
  updatedAt: Date;
}
