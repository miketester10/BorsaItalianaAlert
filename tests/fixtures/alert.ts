import { Condition, type Alert } from "@prisma/client";

// Crea un alert fittizio con valori di default sovrascrivibili.
export const createAlertFixture = (overrides: Partial<Alert> = {}): Alert => {
  return {
    id: "alert-test-1",
    userTelegramId: 123,
    isin: "IT0005518128",
    label: "BTP PER I TEST",
    alertPrice: 90,
    lastCondition: Condition.below,
    lastCheckPrice: 80,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
    ...overrides,
  };
};
