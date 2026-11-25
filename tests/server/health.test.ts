import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { ServerHandler } from "../../src/handlers/server/server-handler";

const PORT = 3999;
const BASE_URL = `http://localhost:${PORT}`;

describe("ServerHandler /health", () => {
  let server: ServerHandler;

  beforeEach(() => {
    server = new ServerHandler(PORT);
  });

  afterEach(async () => {
    await server.stop();
  });

  test("risponde 200 con status OK su /health", async () => {
    await server.start();

    const response = await fetch(`${BASE_URL}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "OK" });
  });

  test("non espone altre route oltre /health", async () => {
    await server.start();

    const response = await fetch(`${BASE_URL}/route-inesistente`);

    expect(response.status).toBe(404);
  });
});
