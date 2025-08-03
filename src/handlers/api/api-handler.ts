import axios, { RawAxiosRequestHeaders } from "axios";

export class ApiHandler {
  private static _instance: ApiHandler;

  private constructor() {}

  static getInstance(): ApiHandler {
    if (!ApiHandler._instance) {
      ApiHandler._instance = new ApiHandler();
    }
    return ApiHandler._instance;
  }

  async getPrice<T>(api: string, headers?: RawAxiosRequestHeaders): Promise<T> {
    const config = headers && { headers };
    const response = await axios.get<T>(api, config);
    return response.data;
  }
}
