import { Condition } from "@prisma/client";

export const calculateCondition = (currentPrice: number, alertPrice: number): Condition => {
  if (currentPrice > alertPrice) return Condition.above;
  if (currentPrice < alertPrice) return Condition.below;
  return Condition.equal;
};
