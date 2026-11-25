import { mock } from "bun:test";
import type { AlertRepository } from "../../src/interfaces/alert-repository.interface";
import type { PriceProvider } from "../../src/interfaces/price-provider.interface";
import type { UserRepository } from "../../src/interfaces/user-repository.interface";
import { createValidResponse } from "../fixtures/borsa-italiana-response";

export const createAlertRepositoryMock = () => ({
  findAllAlerts: mock<AlertRepository["findAllAlerts"]>(async () => []),
  findAlert: mock<AlertRepository["findAlert"]>(async () => null),
  findAllAlertsByTelegramId: mock<AlertRepository["findAllAlertsByTelegramId"]>(async () => []),
  createAlert: mock<AlertRepository["createAlert"]>(async () => {}),
  updateAlert: mock<AlertRepository["updateAlert"]>(async () => {}),
});

export const createUserStatusRepositoryMock = () => ({
  updateUserStatus: mock<UserRepository["updateUserStatus"]>(async () => {}),
});

export const createPriceProviderMock = () => ({
  getPriceByIsin: mock<PriceProvider["getPriceByIsin"]>(async () => createValidResponse(100)),
});
