import { Prisma } from "@prisma/client";

export interface UpdateUserDto extends Omit<Prisma.UserUpdateInput, "alerts" | "createdAt" | "updatedAt"> {}
