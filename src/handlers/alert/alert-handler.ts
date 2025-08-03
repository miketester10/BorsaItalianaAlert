import { Alert } from "../../interfaces/alert.interface";

export class AlertHandler {
  /**
   * Controlla se è necessario inviare una notifica basandosi sul prezzo corrente
   * @param alert Alert da controllare
   * @param currentPrice Prezzo corrente del BTP
   * @returns boolean True se è necessario inviare una notifica
   */
  public static shouldSendNotification(alert: Alert, currentPrice: number): boolean {
    // Se non abbiamo un prezzo precedente, aggiorniamo solo i dati
    if (!alert.lastCheckPrice) {
      return false;
    }

    const isPriceAboveTarget = currentPrice > alert.targetPrice;
    const wasPriceAboveTarget = alert.lastCheckPrice > alert.targetPrice;

    // Condizioni per inviare la notifica:
    // 1. Il prezzo ha attraversato la soglia target (da sopra a sotto o viceversa)
    // 2. Non abbiamo inviato una notifica per questo stato (lastNotificationSent è l'opposto)
    const crossedThreshold = isPriceAboveTarget !== wasPriceAboveTarget;
    const shouldNotify = crossedThreshold && alert.lastNotificationSent !== isPriceAboveTarget;

    return shouldNotify;
  }

  /**
   * Aggiorna lo stato dell'alert dopo il controllo
   * @param alert Alert da aggiornare
   * @param currentPrice Prezzo corrente del BTP
   * @returns Alert Aggiornato con i nuovi valori
   */
  public static updateAlertState(alert: Alert, currentPrice: number): Alert {
    return {
      ...alert,
      lastCheckPrice: currentPrice,
      lastNotificationSent: currentPrice > alert.targetPrice,
    };
  }

  /**
   * Genera il messaggio di notifica per l'utente
   * @param alert Alert che ha triggherato la notifica
   * @param currentPrice Prezzo corrente del BTP
   * @returns string Messaggio da inviare all'utente
   */
  public static generateNotificationMessage(alert: Alert, currentPrice: number): string {
    const direction = currentPrice > alert.targetPrice ? "ha superato" : "è sceso sotto";
    return `🚨 Attenzione! Il BTP con ISIN ${alert.isin} ${direction} il prezzo target di ${alert.targetPrice}. Prezzo attuale: ${currentPrice}`;
  }
}
