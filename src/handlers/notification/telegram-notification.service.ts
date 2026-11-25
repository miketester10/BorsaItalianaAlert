import { type Alert, Condition } from "@prisma/client";
import { blockquote, bold, code, format, type FormattableString, underline } from "gramio";
import type { NotificationResult, NotificationService } from "../../interfaces/notification-service.interface";
import { formatPrice } from "../../utils/price-formatter";
import { getUserStatusFromTelegramError } from "../../utils/user-status.util";

type TelegramApi = {
  sendMessage(params: { chat_id: number; text: FormattableString }): Promise<unknown>;
};

export class TelegramNotificationService implements NotificationService {
  constructor(private readonly api: TelegramApi) {}

  async sendAlert(alert: Alert, price: number, condition: Condition): Promise<NotificationResult> {
    try {
      const priceMovementLine = condition === Condition.above ? format`🟢 Il prezzo ha ${bold("SUPERATO")}` : format`🔴 Il prezzo è ${bold("SCESO")} sotto`;

      const message = blockquote(
        format`🚨 ${bold(format`${underline("ALERT")}`)}

                    ${bold("🆔 ISIN:")} ${code(alert.isin)}
                    ${bold("🏷️ Label:")} ${code(alert.label)}
                    ${priceMovementLine} ${code(`${formatPrice(alert.alertPrice)}€`)}
                    ${bold("💰 Prezzo attuale:")} ${code(`${price}€`)}
                `,
      );

      await this.api.sendMessage({ chat_id: alert.userTelegramId, text: message });
      return { sent: true };
    } catch (error) {
      return { sent: false, error, userStatus: getUserStatusFromTelegramError(error) };
    }
  }
}
