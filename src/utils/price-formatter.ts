import fromExponential from "from-exponential";

/**
 * Nota di contesto (perché esiste questa utility):
 * Prisma con connettore MongoDB può serializzare numeri molto piccoli
 * ma in notazione scientifica (es. 1e-6). Usiamo questa funzione per
 * convertire quei valori in forma decimale leggibile quando li mostriamo
 * all'utente, senza cambiare il modo in cui i numeri sono salvati o
 * usati internamente per i calcoli.
 */

/**
 * Utility per formattare i prezzi in modo leggibile per l'utente.
 * Converte la notazione scientifica (1e-6) in formato decimale (0.000001).
 */
export function formatPrice(price: number): string {
  return fromExponential(price); // "1e-6" -> "0.000001"
}
