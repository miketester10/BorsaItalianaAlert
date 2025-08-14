import { blockquote, bold, code, format, italic, link, underline } from "gramio";
import { MyMessageContext } from "../../interfaces/custom-context.interface";
import { logger } from "../../logger/logger";
import { DatabaseHandler } from "../database/database-handler";
import { errorHandler } from "../error/error-handler";

const dataBaseHandler: DatabaseHandler = DatabaseHandler.getInstance();

export const handleStartCommand = async (ctx: MyMessageContext): Promise<void> => {
  const telegramId = ctx.from?.id!;
  const name = ctx.from?.firstName!;
  const username = ctx.from?.username ?? null;

  try {
    await ctx.sendChatAction("typing");

    logger.info(`Bot avviato da: ${name} - Telegram ID: ${telegramId}`);

    const user = await dataBaseHandler.findUserByTelegramId(telegramId);
    if (user) {
      const isUpdated = await dataBaseHandler.updateUser(telegramId, user, { name, username });
      logger.warn(`Utente già registrato. ${isUpdated ? `Dati aggiornati con successo.` : `Nessun dato da aggiornare è stato trovato.`}`);
    } else {
      await dataBaseHandler.createUser({ telegramId, name, username });
      logger.info(`Nuovo utente registrato con successo.`);
    }

    const message = format`
      👋 Ciao ${name}

      Sono ${bold("Borsa Italiana Alert Bot 🤖")}

      Per visualizzare l'elenco completo dei comandi, usa:
      ${blockquote(code("/help"))}

      ${blockquote(`⚠️ Per maggiori informazioni contatta lo sviluppatore:\n@m1keehrmantraut`)}

      👨🏻‍💻 ${link("GitHub", "https://github.com/miketester10/BorsaItalianaAlert")}
    `;

    await ctx.reply(message, { link_preview_options: { is_disabled: true } });
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
    🔹${code("/help")} - Ricevi questo messaggio.`
      )}

      ℹ️ ${underline(italic("Suggerimenti d’uso:"))}
      È possibile impostare più alert sullo stesso titolo con prezzi diversi. Inserire sempre il codice ISIN corretto per evitare errori. 
      Il prezzo dell'alert in formato decimale deve essere scritto con il punto e non con la virgola. 
      ${italic("Esempio:")} 
      ${code("99.50 -> corretto ✅")}
      ${code("99,50 -> errato ❌")}
    `;

    await ctx.reply(message);
  } catch (error) {
    errorHandler(error, ctx);
  }
};
