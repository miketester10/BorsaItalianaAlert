import express, { Request, Response, Express } from "express";
import { logger } from "../../logger/logger";

export class ServerHandler {
  private readonly EXPRESS_PORT: number = parseInt(process.env.PORT!);

  private static _instance: ServerHandler;
  private readonly app: Express = express();

  private constructor() {}

  static getInstance(): ServerHandler {
    if (!ServerHandler._instance) {
      ServerHandler._instance = new ServerHandler();
    }
    return ServerHandler._instance;
  }

  async startServer(): Promise<void> {
    // Setup Health route
    this.app.get("/health", (req: Request, res: Response) => {
      res.status(200).json({ status: "OK" });
    });

    return new Promise<void>((resolve, reject) => {
      const server = this.app.listen(this.EXPRESS_PORT, () => {
        logger.info(`✅ Server ready on port ${this.EXPRESS_PORT}`);
        resolve();
      });

      server.on("error", (error) => {
        logger.error(`❌ Server failed to start: ${error.message}`);
        reject(error);
      });
    });
  }
}
