import { Prisma } from "@prisma/client";

export interface UpdateAlertDto extends Prisma.AlertUpdateInput {
  id: string;
}
