import type { User, UserStatus } from "@prisma/client";
import type { CreateUserDto } from "../dto/create-user.dto";
import type { UpdateUserDto } from "../dto/update-user.dto";
import type { FindAllUsersOptions } from "./find-all-users-options.interface";

export interface UserRepository {
  createUser(user: CreateUserDto): Promise<void>;
  findUserByTelegramId(telegramId: number): Promise<User | null>;
  findAllUsers(options?: FindAllUsersOptions): Promise<User[]>;
  markKofiDonor(telegramId: number): Promise<void>;
  updateKofiNotifiedBatch(telegramIds: number[]): Promise<void>;
  updateUser(telegramId: number, user: User, changes: UpdateUserDto): Promise<boolean>;
  updateUserStatus(telegramId: number, status: UserStatus): Promise<void>;
}
