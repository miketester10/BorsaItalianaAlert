import { User } from "@prisma/client";

export interface CreateUserDto extends Pick<User, "telegramId" | "name" | "username"> {}
