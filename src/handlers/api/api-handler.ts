import axios, { RawAxiosRequestHeaders } from "axios";
import { Agent as HttpAgent } from "http";
import { Agent as HttpsAgent } from "https";

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

export class ApiHandler {
  private static _instance: ApiHandler;

  private constructor() {}

  static getInstance(): ApiHandler {
    if (!ApiHandler._instance) {
      ApiHandler._instance = new ApiHandler();
    }
    return ApiHandler._instance;
  }

  async getPrice<T>(api: string, headers: RawAxiosRequestHeaders = {}): Promise<T> {
    const response = await httpClient.get<T>(api, { headers });
    return response.data;
  }
}
