import { Prisma } from "@prisma/client";

export interface UpdateUserDto extends Pick<Prisma.UserUpdateInput, "name" | "username"> {}
