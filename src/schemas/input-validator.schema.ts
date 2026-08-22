import { z } from "zod";

// Validazione ISIN: 2 lettere, 9 alfanumerici, 1 cifra finale
const isinSchema = z
  .string()
  .trim()
  .nonempty("ISIN non può essere vuoto")
  .regex(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/, "ISIN non valido");

// Validazione ALERT_PRICE
const alertPriceSchema = z
  .string()
  .trim()
  .nonempty("Il prezzo non può essere vuoto")
  .transform((val, ctx) => {
    const num = Number(val);
    if (isNaN(num)) {
      ctx.addIssue({ code: "custom", message: "Il prezzo deve essere un numero valido" });
      return z.NEVER; // interrompe la trasformazione e segnala errore;
    }
    return num;
  })
  .refine((num) => num > 0, "Il prezzo deve essere maggiore di zero");

const telegramIdSchema = z
  .string()
  .trim()
  .nonempty("Telegram ID non può essere vuoto")
  .transform((val, ctx) => {
    const num = Number(val);
    if (isNaN(num) || !Number.isInteger(num) || num <= 0) {
      ctx.addIssue({ code: "custom", message: "Telegram ID non valido" });
      return z.NEVER;
    }
    return num;
  });

// Comando /alert [ISIN] [ALERT_PRICE]
const alertSchema = z.object({
  isin: isinSchema,
  alertPrice: alertPriceSchema,
});

type IsinValidated = z.infer<typeof isinSchema>;
type AlertValidated = z.infer<typeof alertSchema>;

type ValidateResult<T> = { success: true; data: T } | { success: false; errors: string[] };

/**
 * Valida un ISIN per il comando /prezzo.
 * @param rawIsin - Valore grezzo ricevuto dall'input utente (es. "IT0005...")
 */
export const validatePrezzoInput = (rawIsin: string | undefined): ValidateResult<IsinValidated> => {
  const result = isinSchema.safeParse(rawIsin);
  if (!result.success) {
    return { success: false, errors: result.error.issues.map((e) => e.message) };
  }
  return { success: true, data: result.data };
};

/**
 * Valida ISIN e prezzo per il comando /alert.
 * @param rawIsin - ISIN grezzo dall'input utente
 * @param rawAlertPrice - Prezzo soglia grezzo dall'input utente
 */
export const validateAlertInput = (
  rawIsin: string | undefined,
  rawAlertPrice: string | undefined,
): ValidateResult<AlertValidated> => {
  if (!rawIsin) {
    return { success: false, errors: ["L'isin è richiesto per il comando /alert"] };
  }
  if (!rawAlertPrice) {
    return { success: false, errors: ["Il prezzo è richiesto per il comando /alert"] };
  }
  const result = alertSchema.safeParse({ isin: rawIsin, alertPrice: rawAlertPrice });
  if (!result.success) {
    return { success: false, errors: result.error.issues.map((e) => e.message) };
  }
  return { success: true, data: result.data };
};

const parseTelegramId = (rawTelegramId: string | undefined): ValidateResult<number> => {
  const result = telegramIdSchema.safeParse(rawTelegramId);
  if (!result.success) {
    return { success: false, errors: result.error.issues.map((e) => e.message) };
  }
  return { success: true, data: result.data };
};

/**
 * Valida un Telegram ID per il comando /kofi_user.
 * @param rawTelegramId - ID Telegram grezzo dall'input utente
 */
export const validateKofiUserInput = (
  rawTelegramId: string | undefined,
): ValidateResult<number> => {
  return parseTelegramId(rawTelegramId);
};

/**
 * Valida un Telegram ID per il comando /mark_kofi_donor.
 * @param rawTelegramId - ID Telegram grezzo dall'input utente
 */
export const validateKofiDonorInput = (
  rawTelegramId: string | undefined,
): ValidateResult<number> => {
  return parseTelegramId(rawTelegramId);
};
