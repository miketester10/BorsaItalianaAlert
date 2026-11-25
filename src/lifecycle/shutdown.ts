import { logger } from "../logger/logger";

type ShutdownDependencies = {
  job: { stop(): void };
  bot: { stop(): Promise<void> };
  server: { stop(): Promise<void> };
  database: { disconnect(): Promise<void> };
  process: {
    on(signal: "SIGINT" | "SIGTERM", listener: () => void): unknown;
    exit(code: number): void;
  };
};

export class ShutdownHandler {
  private isShuttingDown = false;

  constructor(private readonly dependencies: ShutdownDependencies) {}

  async shutdown(exitCode: number, reason: string): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn(`Shutdown graceful in corso (${reason})...`);
      return;
    }

    this.isShuttingDown = true;
    logger.debug(`Shutdown graceful avviato (${reason})...`);

    const { job, bot, server, database, process } = this.dependencies;
    try {
      job.stop();

      const results = await Promise.allSettled([bot.stop(), server.stop(), database.disconnect()]);
      results.forEach((result, index) => {
        if (result.status === "rejected") {
          const component = ["Bot", "Server", "Database"][index];
          logger.error(`Errore durante lo shutdown del ${component}: ${String(result.reason)}`);
        }
      });
    } finally {
      process.exit(exitCode);
    }
  }

  registerProcessShutdown(): void {
    const { process } = this.dependencies;
    process.on("SIGINT", () => {
      void this.shutdown(0, "SIGINT");
    });
    process.on("SIGTERM", () => {
      void this.shutdown(0, "SIGTERM");
    });
  }
}
