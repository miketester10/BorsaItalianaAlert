import { User } from "@prisma/client";

export interface KofiUsersResult {
  users: User[];
  filteredUsers: User[];
  skipped: number;
}
