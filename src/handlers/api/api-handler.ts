import axios from "axios";
import { Agent as HttpAgent } from "http";
import { Agent as HttpsAgent } from "https";
import type { Env } from "../../config/env.schema";
import type { BorsaItalianaResponse } from "../../interfaces/borsa-italiana-response.interface";
import type { PriceProvider } from "../../interfaces/price-provider.interface";

type ApiConfig = Pick<Env, "BORSA_ITALIANA_API" | "BORSA_ITALIANA_API_TAIL" | "BORSA_ITALIANA_JWT">;

export class ApiHandler implements PriceProvider {
  // Un solo pool di connessioni TCP/TLS per tutte le richieste del provider.
  private readonly httpClient = axios.create({
    timeout: 10 * 1000,
    httpAgent: new HttpAgent({ keepAlive: true, keepAliveMsecs: 20 * 1000 }),
    httpsAgent: new HttpsAgent({ keepAlive: true, keepAliveMsecs: 20 * 1000 }),
  });

  constructor(private readonly config: ApiConfig) {}

  async getPriceByIsin(isin: string): Promise<BorsaItalianaResponse> {
    const { BORSA_ITALIANA_API, BORSA_ITALIANA_API_TAIL, BORSA_ITALIANA_JWT } = this.config;
    const response = await this.httpClient.get<BorsaItalianaResponse>(`${BORSA_ITALIANA_API}${isin}${BORSA_ITALIANA_API_TAIL}`, {
      headers: { Authorization: `Bearer ${BORSA_ITALIANA_JWT}` },
    });
    return response.data;
  }
}
