import axios from "axios";
import { Agent as HttpAgent } from "http";
import { Agent as HttpsAgent } from "https";
import { env } from "../../config/env";
import type { BorsaItalianaResponse } from "../../interfaces/borsa-italiana-response.interface";
import type { PriceProvider } from "../../interfaces/price-provider.interface";

// Reuse TCP/TLS connections and set a sane timeout
const httpAgent = new HttpAgent({
  keepAlive: true,
  keepAliveMsecs: 20 * 1000, // 20 secondi
});
const httpsAgent = new HttpsAgent({
  keepAlive: true,
  keepAliveMsecs: 20 * 1000,
});

const httpClient = axios.create({
  timeout: 10 * 1000, // 10 secondi
  httpAgent,
  httpsAgent,
});

export class ApiHandler implements PriceProvider {
  private static _instance: ApiHandler;

  private constructor() {}

  static getInstance(): ApiHandler {
    if (!ApiHandler._instance) {
      ApiHandler._instance = new ApiHandler();
    }
    return ApiHandler._instance;
  }

  async getPriceByIsin(isin: string): Promise<BorsaItalianaResponse> {
    const response = await httpClient.get<BorsaItalianaResponse>(`${env.BORSA_ITALIANA_API}${isin}${env.BORSA_ITALIANA_API_TAIL}`, {
      headers: { Authorization: `Bearer ${env.BORSA_ITALIANA_JWT}` },
    });
    return response.data;
  }
}
