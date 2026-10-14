import { afterEach, describe, expect, test } from "bun:test";
import { registerCommandMocks } from "../helpers/shared-mocks";

// Mock condivisi tra file: vedi shared-mocks (evita contaminazioni nel registry).
registerCommandMocks();

// Import dinamico: i mock devono essere registrati prima del modulo testato.
const { ServerHandler } = await import("../../src/handlers/server/server-handler");

const BASE_URL = "http://localhost:3999";

describe("ServerHandler /health", () => {
  afterEach(async () => {
    // Chiude sempre il server, anche se il test fallisce.
    await ServerHandler.getInstance().stop();
  });

  test("risponde 200 con status OK su /health", async () => {
    await ServerHandler.getInstance().start();

    const response = await fetch(`${BASE_URL}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "OK" });
  });

  test("non espone altre route oltre /health", async () => {
    await ServerHandler.getInstance().start();

    const response = await fetch(`${BASE_URL}/route-inesistente`);

    expect(response.status).toBe(404);
  });
});
