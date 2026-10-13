import { Alert, Prisma, PrismaClient, User, UserStatus } from "@prisma/client";
import { logger } from "../../logger/logger";
import { CreateUserDto } from "../../dto/create-user.dto";
import { UpdateUserDto } from "../../dto/update-user.dto";
import { CreateAlertDto } from "../../dto/create-alert.dto";
import { UpdateAlertDto } from "../../dto/update-alert.dto";
import { FindAllUsersOptions } from "../../interfaces/find-all-users-options.interface";

export class DatabaseHandler {
  private static _instance: DatabaseHandler;
  readonly prisma: PrismaClient;

  private constructor() {
    this.prisma = new PrismaClient(); // new PrismaClient({ log: ["query", "warn", "error"] });  se voglio vedere i log delle query
  }

  static getInstance(): DatabaseHandler {
    if (!DatabaseHandler._instance) {
      DatabaseHandler._instance = new DatabaseHandler();
    }
    return DatabaseHandler._instance;
  }

  /**
   * Connette il client al database MongoDB.
   *
   * NOTA: `$connect()` è lazy — inizializza il query engine ma NON verifica
   * la reale raggiungibilità del server (il driver MongoDB fa "server selection"
   * solo quando esegue una query). Senza il ping, con il container spento
   * verrebbe loggato un falso `✅ Database MongoDB connesso con successo` e l'errore emergerebbe solo alla
   * prima query (~30s di server selection timeout), lasciando il bot avviato
   * in stato inconsistente.
   *
   * Per questo dopo `$connect()` eseguiamo un ping reale:
   * `await this.prisma.$runCommandRaw({ ping: 1 })`.
   * Se il DB non è raggiungibile fallisce subito → throw → shutdown graceful → exit(1).
   *
   * @see https://github.com/prisma/prisma/issues/25418
   */
  async connect(): Promise<void> {
    try {
      await this.prisma.$connect();
      await this.prisma.$runCommandRaw({ ping: 1 });
      logger.info("✅ Database MongoDB connesso con successo");
    } catch (error) {
      logger.error(`❌ Errore di connessione al database MongoDB`);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      logger.info("✅ Database MongoDB disconnesso");
    } catch (error) {
      logger.error(`❌ Errore durante la disconnessione dal database MongoDB`);
      throw error;
    }
  }

  async createUser(createUserDto: CreateUserDto): Promise<void> {
    await this.prisma.user.create({
      data: {
        ...createUserDto,
        kofiNotifiedAt: null,
        kofiDonatedAt: null,
      },
    });
  }

  async createAlert(createAlertDto: CreateAlertDto): Promise<void> {
    await this.prisma.alert.create({
      data: createAlertDto,
    });
  }

  async findUserByTelegramId(telegramId: number): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { telegramId },
    });
    return user;
  }

  async findAlert(userTelegramId: number, isin: string, alertPrice: number): Promise<Alert | null> {
    const alert = await this.prisma.alert.findFirst({
      where: { userTelegramId, isin, alertPrice },
    });
    return alert;
  }

  async findAlertById(alertId: string): Promise<Alert | null> {
    const alert = await this.prisma.alert.findUnique({
      where: { id: alertId },
    });
    return alert;
  }

  async findAllAlerts(options?: { onlyActiveUsers?: boolean }): Promise<Alert[]> {
    const where: Prisma.AlertWhereInput = {};

    if (options?.onlyActiveUsers) {
      where.user = { status: UserStatus.active };
    }

    const alerts = await this.prisma.alert.findMany({ where });
    return alerts;
  }

  async findAllAlertsByTelegramId(userTelegramId: number): Promise<Alert[]> {
    const alerts = await this.prisma.alert.findMany({
      where: { userTelegramId },
    });
    return alerts;
  }

  /**
   * Recupera gli utenti con filtri opzionali.
   * @param options - Oggetto opzioni con i filtri da applicare
   * @param options.onlyNotNotified - Se true, esclude utenti con kofiNotified = true
   * @param options.excludeRecent - Se true, esclude utenti registrati da meno di 31 giorni
   * @param options.excludeDonors - Se true, esclude utenti che hanno già donato (kofiDonatedAt != null)
   * @param options.onlyActive - Se true, include solo utenti con status = active (esclude blocked e deactivated)
   * @returns Promise<User[]>
   */
  async findAllUsers(options?: FindAllUsersOptions): Promise<User[]> {
    const where: Prisma.UserWhereInput = {};

    if (options?.onlyNotNotified) {
      where.kofiNotified = false;
    }

    if (options?.excludeRecent) {
      const cutoffDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      where.createdAt = { lt: cutoffDate };
    }

    if (options?.excludeDonors) {
      where.kofiDonatedAt = null;
    }

    if (options?.onlyActive) {
      where.status = UserStatus.active;
    }

    const users = await this.prisma.user.findMany({ where });
    return users;
  }

  async markKofiDonor(telegramId: number): Promise<void> {
    await this.prisma.user.update({
      where: { telegramId },
      data: { kofiDonatedAt: new Date() },
    });
  }

  async updateKofiNotifiedBatch(telegramIds: number[]): Promise<void> {
    if (telegramIds.length === 0) return;
    await this.prisma.user.updateMany({
      where: { telegramId: { in: telegramIds } },
      data: {
        kofiNotified: true,
        kofiNotifiedAt: new Date(),
      },
    });
  }

  async updateUser(telegramId: number, user: User, updateUserDto: UpdateUserDto): Promise<boolean> {
    const { name, username } = updateUserDto;
    const isDataChanged = user.name !== name || user.username !== username;

    if (isDataChanged) {
      await this.prisma.user.update({
        where: { telegramId },
        data: {
          name: name,
          username: username ?? null, // Assicuro che username sia sempre null se non fornito (undefined)
        },
      });
      return true;
    }
    return false;
  }

  async updateUserStatus(telegramId: number, status: UserStatus): Promise<void> {
    await this.prisma.user.update({
      where: { telegramId },
      data: {
        status,
        statusChangedAt: new Date(),
      },
    });
  }

  async updateAlert(updateAlertDto: UpdateAlertDto): Promise<void> {
    const { id, ...rest } = updateAlertDto;
    await this.prisma.alert.update({
      where: { id },
      data: rest,
    });
  }

  async deleteAlertById(alertId: string): Promise<void> {
    await this.prisma.alert.delete({
      where: { id: alertId },
    });
  }

  async deleteAllAlertsByTelegramId(userTelegramId: number): Promise<void> {
    await this.prisma.alert.deleteMany({
      where: { userTelegramId },
    });
  }
}
