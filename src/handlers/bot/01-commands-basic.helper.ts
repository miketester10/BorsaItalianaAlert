import { blockquote, bold, code, format, italic, underline } from "gramio";
import { MyMessageContext } from "../../types/custom-context.type";
import { logger } from "../../logger/logger";
import { BotCommand } from "../../enums/bot-command.enum";
import { AuthorizationAction } from "../../enums/authorization-action.enum";
import { errorHandler } from "../error/error-handler";
import { kofiKeyboard } from "./06-kofi-commands";
import { requireTelegramId } from "../../utils/telegram-id.util";
import type { OwnerCheck } from "../../utils/authorization.util";

export const handleStartCommand = async (ctx: MyMessageContext): Promise<void> => {
  try {
    const telegramId = requireTelegramId(ctx);
    const name = ctx.from?.firstName ?? "utente";

    logger.info(`Bot avviato da: ${name} - Telegram ID: ${telegramId}`);

    await ctx.sendChatAction("typing");

    const message = format`
      👋 Ciao ${name}

      Sono ${bold("Borsa Italiana Alert Bot 🤖")}

      Per visualizzare l'elenco completo dei comandi, usa:
      ${blockquote(code(`/${BotCommand.HELP}`))}

      ${blockquote(`⚠️ Per maggiori informazioni contatta lo sviluppatore:\n@m1keehrmantraut`)}
    `;

    await ctx.reply(message, { reply_markup: kofiKeyboard });
  } catch (error) {
    await errorHandler(error, ctx);
  }
};

export const handleHelpCommand = async (ctx: MyMessageContext): Promise<void> => {
  try {
    await ctx.sendChatAction("typing");
    const message = format`
      ${bold("📚 ELENCO DEI COMANDI 📚")}

      ${blockquote(
        format`🔹${code(`/${BotCommand.PREZZO} <ISIN>`)} - Restituisce il prezzo aggiornato del titolo con l’ISIN indicato.
      ${italic("Esempio:")} ${code(`/${BotCommand.PREZZO} IT0005648149`)}
    🔹${code(`/${BotCommand.ALERT} <ISIN> <prezzo>`)} - Imposta un alert su un titolo. Il bot invierà una notifica quando il prezzo del titolo scenderà o supererà il valore impostato. È bidirezionale.
      ${italic("Esempio:")} ${code(`/${BotCommand.ALERT} IT0005648149 99.50`)}
    🔹${code(`/${BotCommand.ALERTS_ATTIVI}`)} - Mostra tutti gli alerts attualmente impostati dall’utente.
        Cliccando sul singolo alert si può decidere se eliminarlo o visualizzare direttamente il prezzo aggiornato del titolo senza usare il comando ${code(`/${BotCommand.PREZZO} <ISIN>`)}.
    🔹${code(`/${BotCommand.ELIMINA_ALERTS}`)} - Elimina in un solo comando tutti gli alerts impostati, previa conferma.
    🔹${code(`/${BotCommand.START}`)} - Avvia il bot.
    🔹${code(`/${BotCommand.HELP}`)} - Ricevi questo messaggio.`,
      )}

      ℹ️ ${underline(italic("Suggerimenti d’uso:"))}
      È possibile impostare più alert sullo stesso titolo con prezzi diversi. Inserire sempre il codice ISIN corretto per evitare errori. 
      Il prezzo dell'alert in formato decimale deve essere scritto con il punto e non con la virgola. 
      ${italic("Esempio:")} 
      ${code("99.50 -> corretto ✅")}
      ${code("99,50 -> errato ❌")}
    `;

    await ctx.reply(message, { reply_markup: kofiKeyboard });
  } catch (error) {
    await errorHandler(error, ctx);
  }
};

export const handleAdminCommand = async (ctx: MyMessageContext, checkOwner: OwnerCheck): Promise<void> => {
  if (!checkOwner(ctx, AuthorizationAction.ADMIN_COMMAND)) {
    await ctx.reply(code("⚠️ Comando riservato all'admin."));
    return;
  }

  try {
    await ctx.sendChatAction("typing");
    const message = format`
      ${bold("🛠️ COMANDI ADMIN 🛠️")}

      ${blockquote(
        format`🔹${code(`/${BotCommand.KOFI_ALL}`)} - Invia il messaggio Kofi a tutti gli utenti che non hanno ancora donato e registrati da più di 31 giorni.
      🔹${code(`/${BotCommand.KOFI_NEW_USERS}`)} - Invia il messaggio Kofi SOLO agli utenti che non l'hanno mai ricevuto (non donatori, registrati da più di 31 giorni).
      🔹${code(`/${BotCommand.KOFI_USER} <telegramId>`)} - Invia il messaggio Kofi a un singolo utente.
        NON applica il filtro dei 31 giorni: può riceverlo anche se registrato da poco o già notificato. Unico vincolo: non deve aver già donato.
      🔹${code(`/${BotCommand.MARK_KOFI_DONOR} <telegramId>`)} - Marca un utente come donatore Kofi.
        Richiede che l'utente abbia GIÀ ricevuto la notifica Kofi. Una volta marcato, sarà escluso da tutte le campagne future.`,
      )}

      ℹ️ ${underline(italic("REGOLA DEI 31 GIORNI:"))}
      Un utente registrato da meno di ${code("31 giorni")} è considerato ${bold(`"troppo recente"`)} e NON riceverà alcuna notifica Kofi via ${code(`/${BotCommand.KOFI_ALL}`)} e ${code(`/${BotCommand.KOFI_NEW_USERS}`)}. L'unica eccezione è ${code(`/${BotCommand.KOFI_USER}`)}.
    `;

    await ctx.reply(message);
  } catch (error) {
    await errorHandler(error, ctx);
  }
};
