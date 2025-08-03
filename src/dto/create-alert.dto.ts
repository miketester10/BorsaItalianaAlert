import { Alert } from "@prisma/client";

export interface CreateAlertDto extends Pick<Alert, "userTelegramId" | "isin" | "alertPrice"> {}
