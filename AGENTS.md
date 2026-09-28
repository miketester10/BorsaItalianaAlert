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
bun run dev          # watch mode, job test ogni minuto
bun run start        # prod, decide il job in base a NODE_ENV
bun run typecheck    # tsc --noEmit — OBBLIGATORIO dopo ogni modifica
bunx prisma generate # dopo ogni modifica a prisma/schema.prisma
bunx prisma db push  # applica schema a MongoDB
docker compose up -d # bot + mongodb (immagine oven/bun)
```

Test job vs prod job: `src/main.ts` sceglie in base a `NODE_ENV === "production"`.
Prod: ogni 2 min, lun–ven 07:00–18:55 `Europe/Rome`. Dev/test: ogni minuto.

## Struttura

```
src/main.ts                         # entrypoint: server -> db -> bot -> job
src/handlers/bot/00-bot-handler.ts  # registrazione comandi + menu Telegram
src/handlers/bot/01-commands-basic.helper.ts  # start/help/admin
src/handlers/bot/02-commands-helper.ts         # prezzo/alert/alerts_attivi/elimina_alerts + replyOrEdit
src/handlers/bot/03-callbacks-helper.ts + 04-callbacks-data.ts  # inline keyboard callbacks
src/handlers/bot/05-user-handler.ts # sync utente ad ogni update + reattivazione status
src/handlers/bot/06-kofi-commands.ts
src/handlers/alert/alert-handler.ts # checkAndNotifyAlerts: raggruppa ISIN, fetch, confronta, notifica
src/handlers/api/api-handler.ts     # wrapper axios keep-alive, timeout 10s
src/handlers/database/database-handler.ts  # unico accesso a Prisma
src/handlers/error/error-handler.ts # gestione uniforme errori bot
src/handlers/server/server-handler.ts
src/jobs/alert-price.job.ts         # startAlertPriceJob / startTestAlertPriceJob / stopAlertPriceJob
src/lifecycle/shutdown.ts           # graceful shutdown
src/schemas/input-validator.schema.ts  # TUTTA la validazione input utente (Zod)
src/dto/ /src/interfaces/ /src/types/ /src/enums/ /src/consts/ /src/utils/
prisma/schema.prisma                # modelli User, Alert, enum Condition/UserStatus
```

## Pattern architetturali (obbligatori)

- **Singleton** in ogni handler: costruttore `private`, accesso solo via `XxxHandler.getInstance()`. Non usare `new` direttamente, non creare istanze multiple.
- **Separation of Concerns:** `bot/` = solo Telegram, `alert/` = logica soglie/notifiche, `api/` = solo HTTP, `database/` = solo Prisma, `error/` = solo gestione errori.
- **Lazy bot in AlertHandler:** usa il getter `get bot()` esistente per evitare dipendenze circolari con `BotHandler`. Non importare `bot` come singleton eager da `AlertHandler`.
- **DB ping reale:** `DatabaseHandler.connect()` fa `$connect()` + `$runCommandRaw({ ping: 1 })`. Non rimuovere il ping: `$connect()` da solo è lazy e darebbe falso OK con Mongo spento.
- **Shutdown order** (`src/lifecycle/shutdown.ts`): 1. `stopAlertPriceJob()` 2. in parallelo `bot.stop() + server.stop() + db.disconnect()` via `Promise.allSettled` 3. `process.exit(code)`. Segnali gestiti: `SIGINT`, `SIGTERM`.

## Convenzioni codice

- Validazione input: **sempre Zod** in `src/schemas/input-validator.schema.ts` (`validatePrezzoInput`, `validateAlertInput`, `validateKofiUserInput`, `validateKofiDonorInput`). ISIN: `/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/` + `.toUpperCase()` prima di validare. Mai validare inline con regex/`Number()` nei command handler.
- DB access: solo tramite `DatabaseHandler` + DTO (`CreateAlertDto`, `UpdateAlertDto`, `CreateUserDto`, `UpdateUserDto`). Mai chiamare `new PrismaClient()` fuori da `DatabaseHandler`.
- API Borsa Italiana: solo tramite `ApiHandler.getPrice()` con header `Authorization: Bearer ${JWT.BORSA_ITALIANA}` e URL `${API.BORSA_ITALIANA}${isin}${API.BORSA_ITALIANA_TAIL}`. Validare la risposta con `isBorsaItalianaValidResponse()` prima di leggere `intradayPoint.at(-1)?.endPx`. Prezzo corrente = **ultimo** elemento di `intradayPoint`.
- Ottimizzazione alert: raggruppa per ISIN unici (`Set`), fetch parallelo con `p-limit(40)`, risultati con `Promise.allSettled`, mappa `priceMap[isin]`. Conta successi/errori e logga success-rate. Non cambiare il limite 40 senza motivo.
- Notifiche: invia solo se `newCondition !== alert.lastCondition && newCondition !== equal` (`shouldNotify`). Dopo `sendNotification` OK, aggiorna DB con `lastCondition + lastCheckPrice`. Se `sendMessage` lancia `Forbidden`, mappa con `getUserStatusFromTelegramError()` e chiama `updateUserStatus()` (blocked/deactivated), poi `continue` senza aggiornare l'alert.
- Filtri utenti: il job elabora solo utenti `active` (`findAllAlerts({ onlyActiveUsers: true })`). `05-user-handler.ts` riporta a `active` chi interagisce di nuovo.
- Errori nei comandi bot: wrap `try/catch` + `errorHandler(error, ctx)` alla fine. Mai lanciare senza catch nei handler Telegram. `errorHandler` gestisce già `message is not modified` (solo `answerCallbackQuery`) e `AxiosError` con `status + message`.
- Risposte Telegram: usa helper `replyOrEdit(ctx, message, options)` per supportare sia comandi che callback. Formattazione con helper gramio (`format`, `code`, `bold`, `blockquote`, `InlineKeyboard`). Prezzi con `formatPrice()` da `src/utils/price-formatter.ts`.
- Nuovi comandi bot: 1. aggiungi handler in `01-`/`02-`/`06-`, 2. registra in `00-bot-handler.ts` sia in `inizializeCommands()` che in `inizializeMenu()` (menu visibile), 3. aggiungi schema Zod se ha input, 4. usa `ctx.sendChatAction("typing")` all'inizio.
- Logging: solo `logger` da `src/logger/logger.ts` (`info/warn/error/debug`). Mai `console.*`. Messaggi con emoji di stato esistenti (`✅`, `⚠️`, `❌`, `🚨`, `🟢`, `🔴`).
- Stile: ESM `import`, `async/await` (no `.then` a catena), nomi file `kebab-case`, classi `PascalCase`, costanti env in `src/consts/` (`API`, `JWT`), tipi condivisi in `src/types/custom-context.type.ts` (`MyMessageContext`, `MyCallbackQueryContext`, `isCallbackContext`).

## Env e database

Variabili da `.env.example`: `BOT_TOKEN`, `OWNER_TELEGRAM_ID`, `DATABASE_URL`, `BORSA_ITALIANA_API`, `BORSA_ITALIANA_API_TAIL`, `BORSA_ITALIANA_JWT`, `PORT`, `NODE_ENV`, `KOFI_DELAY_MS`. Mai committare `.env` (già in `.gitignore`). Costanti leggono `process.env.X!` — se aggiungi una var, aggiungila a `.env.example` + `src/consts/` se è un endpoint/secret riusato.

Schema Prisma: `User.telegramId @id @map("_id")`, `Alert @db.ObjectId`, relation `userTelegramId -> User.telegramId`, indici su `User.status` e `Alert(userTelegramId)`, `Alert(userTelegramId, isin, alertPrice)`. Dopo ogni modifica schema: `bunx prisma generate && bunx prisma db push`.

## Verifiche prima di finire

1. `bun run typecheck` deve passare senza errori.
2. Nessun `console.log`, nessun `new PrismaClient()` fuori da `DatabaseHandler`, nessun `new BotHandler/AlertHandler/...` diretto.
3. Se toccato `prisma/schema.prisma`: rigenerato client + push.
4. Se nuovo comando: registrato in comandi + menu + validato con Zod.
5. Non aggiungere dipendenze senza necessità; se le aggiungi usa `bun add`.

## Git

- Conventional commits minuscoli: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:` + descrizione breve (es. `docs: add AGENTS.md con guida operativa per AI`).
- File nuovi: `git add <file>` esplicito (`commit -am` non basta per gli untracked).
- Mai committare `.env`, `node_modules/`, `dist/`.

## Non fare

- Non usare `npm/npx/ts-node/tsx`; solo `bun/bunx`.
- Non aggiungere route Express oltre `/health`.
- Non modificare la cron prod (`*/2 7-18 * * 1-5`, timezone `Europe/Rome`) senza richiesta esplicita.
- Non inviare notifiche per condizione `equal` o non cambiata.
- Non esporre token/JWT nei log o nei messaggi Telegram.
