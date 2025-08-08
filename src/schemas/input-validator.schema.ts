import { z } from "zod";
import { CommandType } from "../enums/command-type.enum";

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

// Comando /alert [ISIN] [ALERT_PRICE]
const alertSchema = z.object({
  isin: isinSchema,
  alertPrice: alertPriceSchema,
});

export type IsinValidated = z.infer<typeof isinSchema>;
export type AlertValidated = z.infer<typeof alertSchema>;

type ValidateResult<T> = { success: true; data: T } | { success: false; errors: string[] };

// Overload
export function validateInput(command: CommandType.PREZZO, isin: string | undefined): ValidateResult<IsinValidated>;
export function validateInput(command: CommandType.ALERT, isin: string | undefined, alertPrice: string | undefined): ValidateResult<AlertValidated>;
// Implementazione concreta
export function validateInput(command: CommandType, isin: string | undefined, alertPrice?: string): ValidateResult<any> {
  if (command === CommandType.PREZZO) {
    const result = isinSchema.safeParse(isin);
    if (!result.success) {
      return { success: false, errors: result.error.issues.map((e) => e.message) };
    }
    return { success: true, data: result.data };
  }

  if (command === CommandType.ALERT) {
    if (!alertPrice) {
      return { success: false, errors: ["Il prezzo è richiesto per il comando /alert"] };
    }
    const result = alertSchema.safeParse({ isin, alertPrice });
    if (!result.success) {
      return { success: false, errors: result.error.issues.map((e) => e.message) };
    }
    return { success: true, data: result.data };
  }
  // Fallback
  return { success: false, errors: ["Comando non supportato"] };
}
