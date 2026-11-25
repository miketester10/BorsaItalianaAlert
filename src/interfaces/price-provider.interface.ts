import type { BorsaItalianaResponse } from "./borsa-italiana-response.interface";

export interface PriceProvider {
  getPriceByIsin(isin: string): Promise<BorsaItalianaResponse>;
}
