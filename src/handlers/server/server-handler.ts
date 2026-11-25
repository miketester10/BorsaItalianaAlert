import express, { Request, Response, Express } from "express";
import { Server } from "http";
import { logger } from "../../logger/logger";

export class ServerHandler {
  private readonly app: Express = express();
  private server: Server | null = null;

  constructor(private readonly port: number) {}

  async start(): Promise<void> {
    // Setup Health route
    this.app.get("/health", (req: Request, res: Response) => {
      res.status(200).json({ status: "OK" });
    });

    return new Promise<void>((resolve, reject) => {
      this.server = this.app.listen(this.port, () => {
        logger.info(`✅ Server ready on port ${this.port}`);
        resolve();
      });

      this.server.on("error", (error) => {
        logger.error(`❌ Server failed to start: ${error.message}`);
        reject(error);
      });
    });
  }

  async stop(): Promise<void> {
    const server = this.server;
    if (!server) return;

    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    this.server = null;
    logger.info("✅ Server fermato");
  }
}
