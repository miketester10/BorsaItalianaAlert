# AGENTS.md — BorsaItalianaAlert

Bot Telegram (Bun + TypeScript strict) che monitora i prezzi dei titoli Borsa Italiana e invia alert quando il prezzo attraversa una soglia target.

## Stack

- Runtime: **Bun** (mai `npm`/`node`/`npx`, usa sempre `bun`/`bunx`)
- Linguaggio: TypeScript `strict` (`tsconfig.json`), `module: preserve`, `target: es2024`
- Bot: `gramio` — DB: `Prisma` + MongoDB — HTTP: `axios` — Jobs: `cron`
- Concorrenza API: `p-limit` — Log: `pino` + `pino-pretty` — Validazione: `zod`
- Server Express: solo endpoint `GET /health` per Uptime Kuma, nient'altro

## Comandi

```bash
bun install
bun dev              # watch mode, job test ogni minuto
bun start            # prod, decide il job in base a NODE_ENV
bun typecheck        # tsc --noEmit — OBBLIGATORIO dopo ogni modifica
bun test             # suite di test
bun prisma:generate  # dopo ogni modifica a prisma/schema.prisma
bun prisma:push      # applica schema a MongoDB
docker compose up -d # solo bot (immagine oven/bun pinnata, prisma db push all'avvio)
```

Test job vs prod job: `src/main.ts` sceglie in base a `NODE_ENV === "production"`.
Prod: ogni 2 min, lun–ven 07:00–18:58 `Europe/Rome`. Dev/test: ogni minuto.

## Struttura

```
src/main.ts                         # Composition Root e avvio: server -> db -> bot -> job
src/handlers/bot/00-bot-handler.ts  # registrazione comandi + menu Telegram
src/handlers/bot/01-commands-basic.helper.ts  # start/help/admin
src/handlers/bot/02-commands-helper.ts         # AlertCommands: prezzo/alert/alerts_attivi/elimina_alerts
src/handlers/bot/reply-or-edit.helper.ts        # helper neutro replyOrEdit (usato da bot/ ed error/, rompe il ciclo error <-> 02)
src/handlers/bot/03-callbacks-helper.ts + 04-callbacks-data.ts  # inline keyboard callbacks
src/handlers/bot/05-user-handler.ts # sync utente ad ogni update + reattivazione status
src/handlers/bot/06-kofi-commands.ts # KofiCommands: inviti e donatori
src/handlers/alert/alert-handler.ts # checkAndNotifyAlerts: raggruppa ISIN, fetch, confronta, notifica
src/handlers/notification/telegram-notification.service.ts  # messaggi di alert e classificazione errori Telegram
src/handlers/api/api-handler.ts     # wrapper axios keep-alive, timeout 10s
src/handlers/database/database-handler.ts  # unico accesso a Prisma
src/handlers/error/error-handler.ts # gestione uniforme errori bot
src/handlers/server/server-handler.ts
src/jobs/alert-price.job.ts         # AlertPriceJob: start / stop e controllo iniettato
src/lifecycle/shutdown.ts           # ShutdownHandler: segnali e graceful shutdown
src/schemas/input-validator.schema.ts  # TUTTA la validazione input utente (Zod)
src/config/env.schema.ts + env.ts      # validazione env Zod fail-fast (unico punto che legge process.env)
src/dto/ /src/interfaces/ /src/types/ /src/enums/ /src/utils/
prisma/schema.prisma                # modelli User, Alert, enum Condition/UserStatus
tests/commands|config|fixtures|helpers|interfaces|jobs|lifecycle|schemas|server|utils  # suite di test (factory dei mock in helpers/)
```

## Pattern architetturali (obbligatori)

- **Dependency Injection manuale.** `src/main.ts` è il Composition Root. Crea e condivide le istanze applicative, passa la configurazione validata e inietta le dipendenze nei costruttori. Le funzioni di registrazione dei callback e di sincronizzazione utente ricevono dipendenze esplicite come argomenti. Nei test costruisci istanze con fake locali.
- **Separation of Concerns:** `bot/` = solo Telegram, `alert/` = logica soglie e orchestrazione, `notification/` = invio Telegram, `api/` = solo HTTP, `database/` = solo Prisma, `error/` = solo gestione errori. `replyOrEdit` vive nel file neutro `src/handlers/bot/reply-or-edit.helper.ts`: importarlo sempre da lì, mai da `02-commands-helper.ts` (evita dipendenza circolare `error <-> 02`).
- **Contratti.** `DatabaseHandler` implementa `AlertRepository` e `UserRepository`. `ApiHandler` implementa `PriceProvider`. `AlertHandler` invia tramite `NotificationService`. `TelegramNotificationService` riceve la stessa API del bot utilizzato da `BotHandler` e traduce gli errori di consegna nello stato utente applicabile.
- **DB ping reale:** `DatabaseHandler.connect()` fa `$connect()` + `$runCommandRaw({ ping: 1 })`. Non rimuovere il ping: `$connect()` da solo è lazy e darebbe falso OK con Mongo spento.
- **Shutdown order** (`src/lifecycle/shutdown.ts`): 1. `job.stop()` 2. in parallelo `bot.stop() + server.stop() + db.disconnect()` via `Promise.allSettled` 3. `process.exit(code)`. Segnali gestiti: `SIGINT`, `SIGTERM`.
- **Autorizzazione:** i check riservati all'owner usano `checkOwner(ctx, AuthorizationAction.X)`. Il controllo è creato in `main.ts` tramite `createOwnerCheck` (fail-closed, warn sui tentativi). Le azioni sono nell'enum `AuthorizationAction` (`src/enums/authorization-action.enum.ts`); la proprietà di un alert si verifica in query con `findAlertByIdAndTelegramId(alertId, telegramId)` (null → "Alert non trovato"); i callback senza ID nel payload (es. `deleteAllAlerts`) agiscono solo sul mittente (`telegramId`), nessun check extra. Mai fidarsi degli ID arrivati nel callbackData.

## Convenzioni codice

- Validazione input: **sempre Zod** in `src/schemas/input-validator.schema.ts` (`validatePrezzoInput`, `validateAlertInput`, `validateKofiUserInput`, `validateKofiDonorInput`). ISIN: `/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/` + normalizzazione centralizzata nello schema (`preprocess` con `trim()` + `toUpperCase()`): accetta anche minuscole. Mai duplicare `.toUpperCase()` nei command handler. Mai validare inline con regex/`Number()` nei command handler.
- DB access: tramite `AlertRepository` / `UserRepository` e i relativi DTO (`CreateAlertDto`, `UpdateAlertDto`, `CreateUserDto`, `UpdateUserDto`). Mai chiamare `new PrismaClient()` fuori da `DatabaseHandler`.
- API Borsa Italiana: tramite `PriceProvider.getPriceByIsin(isin)`. `ApiHandler` costruisce URL e header `Authorization` dalla configurazione iniettata. Prezzo corrente = **ultimo** elemento di `intradayPoint`, da leggere solo con `getLastPriceStatus()` (unica chiamata: `ok` con `price+label`, `invalid`, `nodata` con `raw`; verifica risposta + tipo `number` + `NaN` + `> 0`): mai `!` su `endPx`, mai salvare/inviare prezzi non validati. Se `nodata`, messaggio utente `⚠️ Prezzo non disponibile.` (+ warn con valore raw) e skip senza scrivere nel DB.
- Ottimizzazione alert: raggruppa per ISIN unici (`Set`), fetch parallelo con `p-limit(40)`, risultati con `Promise.allSettled`, mappa `priceMap[isin]`. Conta successi/errori e logga success-rate. Non cambiare il limite 40 senza motivo.
- Notifiche: invia solo se `newCondition !== alert.lastCondition && newCondition !== equal` (`shouldNotify`). Dopo `sendAlert` OK, aggiorna DB con `lastCondition + lastCheckPrice`. L’adapter mappa gli errori di blocco o disattivazione con `getUserStatusFromTelegramError()`. In caso di errore il job aggiorna lo stato utente se applicabile e prosegue senza aggiornare l’alert.
- Filtri utenti: il job elabora solo utenti `active` (`findAllAlerts({ onlyActiveUsers: true })`). `05-user-handler.ts` riporta a `active` chi interagisce di nuovo.
- Errori nei comandi bot: wrap `try/catch` + `await errorHandler(error, ctx)` alla fine (sempre `await`, mai floating). Mai lanciare senza catch nei handler Telegram. Mai `!` su `ctx.from` (né `?.x!` altrove): nei contesti message usa `requireTelegramId(ctx)` da `src/utils/telegram-id.util.ts` dentro il `try` (lancia → `errorHandler`); nei callback `ctx.from` è non-optional: estrai sempre `const telegramId = ctx.from.id` e passa la variabile (mai `ctx.from.id` inline come argomento). `05-user-handler.ts` non rilancia mai (solo `logger.error`), così il middleware chiama sempre `next()`. `errorHandler` gestisce già `message is not modified` (solo `answerCallbackQuery`) e `AxiosError` con `status + message`.
- Risposte Telegram: usa helper `replyOrEdit(ctx, message, options)` da `src/handlers/bot/reply-or-edit.helper.ts` per supportare sia comandi che callback. Formattazione con helper gramio (`format`, `code`, `bold`, `blockquote`, `InlineKeyboard`). Prezzi con `formatPrice()` da `src/utils/price-formatter.ts`.
- Nuovi comandi bot: 1. aggiungi handler in `01-`/`02-`/`06-`, 2. registra in `00-bot-handler.ts` sia in `initializeCommands()` che in `initializeMenu()` (menu visibile) usando `BotCommand` (`src/enums/bot-command.enum.ts`), 3. usa lo stesso enum nei testi di help (mai stringhe hardcoded), 4. aggiungi schema Zod se ha input, 5. usa `ctx.sendChatAction("typing")` all'inizio.
- Logging: solo `logger` da `src/logger/logger.ts` (`info/warn/error/debug`). Mai `console.*`. Messaggi con emoji di stato esistenti (`✅`, `⚠️`, `❌`, `🚨`, `🟢`, `🔴`).
- Stile: ESM `import`, `async/await` (no `.then` a catena), nomi file `kebab-case`, classi `PascalCase`, env validato in `src/config/` (`env.schema.ts` + `env.ts`), tipi condivisi in `src/types/custom-context.type.ts` (`MyMessageContext`, `MyCallbackQueryContext`, `isCallbackContext`). Per il Telegram ID utente si usa sempre `telegramId` (variabili e parametri; plurale `telegramIds`); restano qualificati `OWNER_TELEGRAM_ID` (owner) e i campi del modello Prisma (`User.telegramId`, `Alert.userTelegramId`).

## Env e database

Variabili da `.env.example`: `BOT_TOKEN`, `OWNER_TELEGRAM_ID`, `DATABASE_URL`, `BORSA_ITALIANA_API`, `BORSA_ITALIANA_API_TAIL`, `BORSA_ITALIANA_JWT`, `PORT`, `NODE_ENV`, `KOFI_DELAY_MS`. Mai committare `.env` (già in `.gitignore`). Tutte validate in `src/config/env.schema.ts` con fail-fast all'avvio — se aggiungi una var, aggiungila a `.env.example` + allo schema. Mai leggere `process.env` fuori da `src/config/env.ts`.

Schema Prisma: `User.telegramId @id @map("_id")`, `Alert @db.ObjectId`, relation `userTelegramId -> User.telegramId`, indici su `User.status` e `Alert(userTelegramId)`, `Alert(userTelegramId, isin, alertPrice)`. Dopo ogni modifica schema: `bun prisma:generate && bun prisma:push` (push manuale solo su DB corretto e autorizzato; in produzione lo applica il container all'avvio, scelta accettata — vedi `docker-compose.yml`).

## CI/CD (`.github/workflows/deploy.yml`)

- Job `verifica-codice-pre-deploy`: `bun install --frozen-lockfile` + `bun prisma:generate` + `bun typecheck` + `bun test`. Se fallisce, il deploy non parte.
- Job `deploy-vps` (`needs` verifica): SSH su VPS, `git pull`, restart container solo se ci sono modifiche.
- Nomi job/step in italiano, id in kebab-case. Non aggiungere `db push` in CI (solo `generate`): l'unico push automatico ammesso è quello del container all'avvio (`docker-compose.yml`).
- Push che toccano solo docs (`**.md`, `AGENTS.md`, `LICENSE`, `.gitignore`, `.env.example`) non avviano la pipeline (`paths-ignore`): il container monta il repo live e non ne ha bisogno. Override manuale: `[skip ci]` nel messaggio.

## Ricerca web

- Puoi usare internet (`websearch`/`webfetch` o altri tool) quando non sai qualcosa, servono più spiegazioni, dettagli tecnici o esempi per spiegarli all'utente. Verifica sempre versioni/API dai registry o docs ufficiali, non a memoria.

## Verifiche prima di finire

1. `bun typecheck` deve passare senza errori. Riporta l'errore reale se fallisce; non dichiarare controlli superati se non eseguiti.
2. Nessun `console.log`, nessun `new PrismaClient()` fuori da `DatabaseHandler`, `new BotHandler/AlertHandler/...` solo in `main.ts` e nei test.
3. Se toccato `prisma/schema.prisma`: rigenerato client + push (solo se autorizzato e sul DB corretto).
4. Se nuovo comando: registrato in comandi + menu + validato con Zod.
5. Non aggiungere dipendenze senza necessità; se le aggiungi usa `bun add`.
6. Dopo ogni modifica al codice, controllare sempre se `README.md` e/o `AGENTS.md` vanno aggiornati (struttura, env, comandi, cron, pattern) e aggiornarli se necessario.
7. Controllare sempre typo, naming incoerenti e convenzioni violate (`initialize`, camelCase come `databaseHandler`, file `kebab-case`, classi `PascalCase`).

## Git

- Mai committare in automatico: solo su richiesta esplicita dell'utente.
- Conventional commits minuscoli in inglese: `feat:`, `fix:`, `perf:`, `test:`, `refactor:`, `docs:`, `chore:` + descrizione breve (es. `test: add test suite for zod input validation`).
- File nuovi: `git add <file>` esplicito (`commit -am` non basta per gli untracked).
- Mai committare `.env`, `node_modules/`, `dist/`.
- Mai fare push, merge o deploy senza richiesta esplicita.

## Non fare

- Non usare `npm/npx/ts-node/tsx`; solo `bun/bunx`.
- Non aggiungere route Express oltre `/health`.
- Non modificare la cron prod (`*/2 7-18 * * 1-5`, timezone `Europe/Rome`) senza richiesta esplicita.
- Non inviare notifiche per condizione `equal` o non cambiata.
- Non esporre token/JWT nei log o nei messaggi Telegram.
