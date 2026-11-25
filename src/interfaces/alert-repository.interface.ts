import type { Alert } from "@prisma/client";
import type { CreateAlertDto } from "../dto/create-alert.dto";
import type { UpdateAlertDto } from "../dto/update-alert.dto";

export interface AlertRepository {
  createAlert(alert: CreateAlertDto): Promise<void>;
  findAlert(telegramId: number, isin: string, alertPrice: number): Promise<Alert | null>;
  findAlertByIdAndTelegramId(alertId: string, telegramId: number): Promise<Alert | null>;
  findAllAlerts(options?: { onlyActiveUsers?: boolean }): Promise<Alert[]>;
  findAllAlertsByTelegramId(telegramId: number): Promise<Alert[]>;
  updateAlert(alert: UpdateAlertDto): Promise<void>;
  deleteAlertById(alertId: string): Promise<void>;
  deleteAllAlertsByTelegramId(telegramId: number): Promise<void>;
}
