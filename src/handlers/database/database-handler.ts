import { Alert, PrismaClient, User } from "@prisma/client";
import { logger } from "../../logger/logger";
import { CreateUserDto } from "../../dto/create-user.dto";
import { UpdateUserDto } from "../../dto/update-user.dto";
import { CreateAlertDto } from "../../dto/create-alert.dto";

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

  async connect(): Promise<void> {
    try {
      await this.prisma.$connect();
      logger.info("✅ Database MongoDB connesso con successo");
    } catch (error) {
      logger.error(`❌ Errore di connessione al database MongoDB`);
      throw error;
    }
  }

  async createUser(createUsertDto: CreateUserDto): Promise<void> {
    const { telegramId, name, username } = createUsertDto;
    try {
      await this.prisma.user.create({
        data: {
          telegramId,
          name,
          username: username ?? null, // Assicuro che username sia sempre null se non fornito
        },
      });
    } catch (error) {
      throw error;
    }
  }

  async createAlert(createAlertDto: CreateAlertDto): Promise<void> {
    try {
      await this.prisma.alert.create({
        data: createAlertDto,
      });
    } catch (error) {
      throw error;
    }
  }

  async findUserByTelegramId(telegramId: number): Promise<User | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { telegramId },
        include: {
          alerts: true, // Include gli alert associati all'utente
        },
      });
      return user;
    } catch (error) {
      throw error;
    }
  }

  async findAlertsByTelegramId(userTelegramId: number): Promise<Alert[]> {
    try {
      const alerts = await this.prisma.alert.findMany({
        where: { userTelegramId },
        include: {
          user: true,
        },
      });
      return alerts;
    } catch (error) {
      throw error;
    }
  }

  async updateUser(telegramId: number, user: User, updateUserDto: UpdateUserDto): Promise<boolean> {
    const { name, username } = updateUserDto;
    try {
      const isDataChanged = user.name !== name || user.username !== username;

      if (isDataChanged) {
        await this.prisma.user.update({
          where: { telegramId },
          data: {
            name: name,
            username: username ?? null, // Assicuro che username sia sempre null se non fornito
          },
        });
        return true;
      }
      return false;
    } catch (error) {
      throw error;
    }
  }
}
