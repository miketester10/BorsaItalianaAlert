import { blockquote, bold, code, format, italic, underline, InlineKeyboard } from "gramio";
import { MyMessageContext } from "../../types/custom-context.type";
import { logger } from "../../logger/logger";
import { errorHandler } from "../error/error-handler";

const OWNER_TELEGRAM_ID = Number(process.env.OWNER_TELEGRAM_ID);

export const handleStartCommand = async (ctx: MyMessageContext): Promise<void> => {
  const telegramId = ctx.from?.id!;
  const name = ctx.from?.firstName!;

  logger.info(`Bot avviato da: ${name} - Telegram ID: ${telegramId}`);

  try {
    await ctx.sendChatAction("typing");

    const message = format`
      👋 Ciao ${name}

      Sono ${bold("Borsa Italiana Alert Bot 🤖")}

      Per visualizzare l'elenco completo dei comandi, usa:
      ${blockquote(code("/help"))}

      ${blockquote(`⚠️ Per maggiori informazioni contatta lo sviluppatore:\n@m1keehrmantraut`)}
    `;

    const kofiKeyboard = new InlineKeyboard().url("☕ Offrimi un caffè", "https://ko-fi.com/borsaitalianabot", { style: "primary" });

    await ctx.reply(message, { reply_markup: kofiKeyboard });
  } catch (error) {
    errorHandler(error, ctx);
  }
};

export const handleHelpCommand = async (ctx: MyMessageContext): Promise<void> => {
  try {
    await ctx.sendChatAction("typing");
    const message = format`
      ${bold("📚 ELENCO DEI COMANDI 📚")}

      ${blockquote(
        format`🔹${code("/prezzo <ISIN>")} - Restituisce il prezzo aggiornato del titolo con l’ISIN indicato.
      ${italic("Esempio:")} ${code("/prezzo IT0005648149")}
    🔹${code("/alert <ISIN> <prezzo>")} - Imposta un alert su un titolo. Il bot invierà una notifica quando il prezzo del titolo scenderà o supererà il valore impostato. È bidirezionale.
      ${italic("Esempio:")} ${code("/alert IT0005648149 99.50")}
    🔹${code("/alerts_attivi")} - Mostra tutti gli alerts attualmente impostati dall’utente.
        Cliccando sul singolo alert si può decidere se eliminarlo o visualizzare direttamente il prezzo aggiornato del titolo senza usare il comando ${code("/prezzo <ISIN>")}.
    🔹${code("/elimina_alerts")} - Elimina in un solo comando tutti gli alerts impostati, previa conferma.
    🔹${code("/start")} - Avvia il bot.
    🔹${code("/help")} - Ricevi questo messaggio.`,
      )}

      ℹ️ ${underline(italic("Suggerimenti d’uso:"))}
      È possibile impostare più alert sullo stesso titolo con prezzi diversi. Inserire sempre il codice ISIN corretto per evitare errori. 
      Il prezzo dell'alert in formato decimale deve essere scritto con il punto e non con la virgola. 
      ${italic("Esempio:")} 
      ${code("99.50 -> corretto ✅")}
      ${code("99,50 -> errato ❌")}
    `;

    const kofiKeyboard = new InlineKeyboard().url("☕ Offrimi un caffè", "https://ko-fi.com/borsaitalianabot", { style: "primary" });

    await ctx.reply(message, { reply_markup: kofiKeyboard });
  } catch (error) {
    errorHandler(error, ctx);
  }
};

export const handleAdminCommand = async (ctx: MyMessageContext): Promise<void> => {
  const telegramId = ctx.from?.id;

  if (telegramId !== OWNER_TELEGRAM_ID) {
    await ctx.reply(code("⚠️ Comando riservato all'admin."));
    return;
  }

  try {
    await ctx.sendChatAction("typing");
    const message = format`
      ${bold("🛠️ COMANDI ADMIN 🛠️")}

      ${blockquote(
        format`🔹${code("/kofi_all")} - Invia il messaggio Kofi a tutti gli utenti (non donatori).
      🔹${code("/kofi_new_users")} - Invia il messaggio Kofi ai nuovi utenti (non donatori, non notificati).
      🔹${code("/mark_kofi_donor <telegramId>")} - Marca un utente come donatore Kofi.`,
      )}
    `;

    await ctx.reply(message);
  } catch (error) {
    errorHandler(error, ctx);
  }
};
