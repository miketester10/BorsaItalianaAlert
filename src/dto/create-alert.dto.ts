import { Alert } from "@prisma/client";

export interface CreateAlertDto extends Omit<Alert, "id" | "createdAt" | "updatedAt"> {}
