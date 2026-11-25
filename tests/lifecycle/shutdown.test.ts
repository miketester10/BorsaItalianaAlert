import { expect, mock, test } from "bun:test";
import { EventEmitter } from "events";
import { ShutdownHandler } from "../../src/lifecycle/shutdown";

test("ferma il cron, chiude le risorse in parallelo e propaga il codice di uscita", async () => {
  const calls: string[] = [];
  const botStopped = Promise.withResolvers<void>();
  const exit = mock((_code: number) => {});
  const shutdown = new ShutdownHandler({
    job: { stop: () => { calls.push("cron"); } },
    bot: { stop: () => { calls.push("bot"); return botStopped.promise; } },
    server: { stop: async () => { calls.push("server"); throw new Error("errore simulato"); } },
    database: { disconnect: async () => { calls.push("database"); } },
    process: Object.assign(new EventEmitter(), { exit }),
  });

  const pending = shutdown.shutdown(1, "startup-error");
  expect(calls).toEqual(["cron", "bot", "server", "database"]);
  await shutdown.shutdown(0, "SIGINT");
  expect(exit).not.toHaveBeenCalled();
  botStopped.resolve();
  await pending;
  expect(exit).toHaveBeenCalledTimes(1);
  expect(exit).toHaveBeenCalledWith(1);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  test(`intercetta ${signal} ed esce con codice 0`, async () => {
    const exited = Promise.withResolvers<number>();
    const process = Object.assign(new EventEmitter(), { exit: exited.resolve });
    const stopJob = mock(() => {});
    const shutdown = new ShutdownHandler({
      job: { stop: stopJob },
      bot: { stop: async () => {} },
      server: { stop: async () => {} },
      database: { disconnect: async () => {} },
      process,
    });

    shutdown.registerProcessShutdown();
    process.emit(signal);

    expect(await exited.promise).toBe(0);
    expect(stopJob).toHaveBeenCalledTimes(1);
  });
}
