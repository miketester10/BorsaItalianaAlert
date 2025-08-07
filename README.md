# Bot Borsa Italiana Alert

Bot Telegram per monitorare i prezzi dei titoli della Borsa Italiana e inviare notifiche automatiche quando i prezzi superano o scendono al di sotto delle soglie target impostate dagli utenti.

---

## Funzionalità

- **Monitoraggio prezzi in tempo reale** dei titoli della Borsa Italiana
- **Sistema di alert bidirezionali** con notifiche Telegram per superamento e discesa delle soglie
- **Interfaccia bot Telegram** con menu comandi intuitivo
- **Integrazione API sicura** con Borsa Italiana
- **Database MongoDB** per persistenza dati
- **CronJob automatico** per controllo prezzi periodico
- **Gestione utenti** con profili personalizzati
- **Logging strutturato** con Pino
- **Containerizzazione Docker** per deployment semplificato

## Stack Tecnologico

- **Linguaggio:** TypeScript (strict mode)
- **Framework/Librerie:**
  - [gramio](https://gramio.dev/) (Bot Telegram)
  - [Prisma](https://www.prisma.io/) (ORM per MongoDB)
  - [Axios](https://axios-http.com/) (Client HTTP)
  - [cron](https://github.com/node-cron/node-cron) (Scheduling)
  - [dotenv](https://github.com/motdotla/dotenv) (Gestione variabili ambiente)
  - [pino](https://getpino.io/) (Logging)
- **Database:** MongoDB con Prisma
- **Containerizzazione:** Docker
- **Pattern:** Singleton, Dependency Injection

## Iniziare

### Prerequisiti

- Node.js >= 18
- MongoDB (locale o cloud)
- Docker (opzionale, per setup containerizzato)

### Setup

1. **Clona il repository:**

   ```bash
   git clone https://github.com/tuousername/bot_borsa_italiana_alert.git
   cd bot_borsa_italiana_alert
   ```

2. **Installa le dipendenze:**

   ```bash
   npm install
   ```

3. **Configura le variabili ambiente:**

   - Copia `.env.example` in `.env` nella root del progetto e compila i valori richiesti (vedi sotto)

4. **Avvia MongoDB:**

   - Localmente: `docker-compose up -d mongodb`
   - Oppure usa la tua istanza MongoDB

5. **Esegui le migrazioni del database:**

   ```bash
   npx prisma generate
   npx prisma db push
   ```

6. **Avvia il bot in sviluppo:**

   ```bash
   npm run dev
   ```

7. **Oppure avvia con Docker:**
   ```bash
   docker-compose up -d
   ```

### Variabili Ambiente

Crea un file `.env` nella root del progetto con le seguenti variabili:

```env
# Bot Telegram
BOT_TOKEN=your_telegram_bot_token

# Database MongoDB
DATABASE_URL=mongodb://localhost:27017/borsa_italiana_alert

# API Borsa Italiana
BORSA_ITALIANA_API=your_borsa_italiana_api_endpoint
BORSA_ITALIANA_API_TAIL=your_borsa_italiana_api_tail_endpoint
BORSA_ITALIANA_JWT=your_borsa_italiana_jwt_token
```

### Script Principali

- `npm run dev` — Avvia il bot in modalità sviluppo (hot reload)
- `npm start` — Avvia il bot in modalità produzione

### Docker

- `docker-compose up -d` — Avvia bot e MongoDB in container
- `docker-compose down` — Ferma e rimuove i container

## Comandi del Bot

### Comandi Utente

- `/start` — Avvia il bot e registra l'utente
- `/prezzo <ISIN>` — Mostra il prezzo attuale di un titolo
- `/alert <ISIN> <prezzo>` — Crea un alert per un titolo
- `/alerts_attivi` — Lista tutti gli alert attivi dell'utente
- `/elimina_alerts` — Elimina tutti gli alert dell'utente

### Esempi di Utilizzo

```
/prezzo IT0003128367
/alert IT0003128367 15.50
/alerts_attivi
```

## Sistema di Alert

Il bot monitora automaticamente i prezzi dei titoli configurati e invia notifiche intelligenti quando:

- **🟢 Prezzo supera la soglia target** (condizione "above") - Notifica di opportunità di vendita
- **🔴 Prezzo scende sotto la soglia target** (condizione "below") - Notifica di opportunità di acquisto

### Logica di Notifica

Il sistema utilizza una logica bidirezionale che distingue tra:

- **Condizioni di superamento** (prezzo > target)
- **Condizioni di discesa** (prezzo < target)
- **Condizioni di equilibrio** (prezzo = target) - Nessuna notifica

### CronJob

- **Modalità Test:** Controllo ogni minuto (lun-ven, 00:00-23:55)
- **Modalità Produzione:** Controllo ogni 5 minuti (lun-ven, 07:00-18:55)

## Struttura del Progetto

```
├── src/
│   ├── handlers/         # Logica di business (bot, alert, api, database, error)
│   │   ├── bot/         # Gestione bot Telegram
│   │   ├── alert/       # Logica alert e notifiche
│   │   ├── api/         # Integrazione API esterne
│   │   ├── database/    # Operazioni database
│   │   └── error/       # Gestione errori
│   ├── types/           # Tipi TypeScript e type guards
│   ├── dto/             # Data Transfer Objects
│   ├── interfaces/      # Interfacce TypeScript
│   ├── enums/           # Enumerazioni
│   ├── consts/          # Costanti (API endpoints)
│   ├── jobs/            # CronJob e task schedulati
│   ├── logger/          # Configurazione logging
│   └── main.ts          # Punto di ingresso
├── prisma/              # Schema database e migrazioni
├── docker-compose.yml   # Configurazione Docker
├── package.json
├── tsconfig.json
└── README.md
```

## Architettura

### Design Patterns

- **Singleton Pattern:** Implementato in tutti gli handler per garantire istanze uniche
- **Dependency Injection:** Uso di getter per accesso controllato alle dipendenze
- **Separation of Concerns:** Ogni handler ha responsabilità specifiche

### Gestione Errori

- **Error Handler centralizzato** per gestione uniforme degli errori
- **Try-catch consistenti** in tutti i metodi
- **Logging strutturato** con Pino per debugging

### Type Safety

- **Interfacce TypeScript** per tutte le strutture dati
- **Type Guards** per validazione runtime delle risposte API e opzioni Telegram
- **Tipi centralizzati** in `src/types/` per riutilizzabilità
- **DTO pattern** per trasferimento dati sicuro

## Database Schema

### Modelli Prisma

```prisma
model User {
  telegramId Int      @id
  name       String
  username   String?
  alerts     Alert[]
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model Alert {
  id             String     @id @default(auto()) @map("_id")
  isin           String
  label          String
  alertPrice     Float
  lastCondition  Condition
  lastCheckPrice Float
  userTelegramId Int
  user           User       @relation(fields: [userTelegramId], references: [telegramId])
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt
}

enum Condition {
  above
  below
  equal
}
```

## API Integration

### Borsa Italiana API

- **Endpoint:** Integrazione con API ufficiali Borsa Italiana
- **Autenticazione:** Bearer token JWT
- **Rate Limiting:** Gestione automatica delle chiamate API
- **Validazione:** Type guards per risposte API

### Ottimizzazioni

- **Raggruppamento ISIN:** Riduzione chiamate API duplicate
- **Caching implicito:** Riutilizzo prezzi per alert multipli
- **Error handling:** Gestione graceful degli errori API

## Contribuire

Le pull request sono benvenute! Per modifiche importanti, apri prima un issue per discutere le modifiche proposte.

## Licenza

Questo progetto è sotto licenza MIT. Vedi il file [LICENSE](LICENSE) per i dettagli.

---

**Nota:** Questo bot è per uso educativo e personale. Assicurati di rispettare i termini di servizio delle API utilizzate.
