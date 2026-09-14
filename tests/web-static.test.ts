import express from "express";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, describe, expect, it } from "vitest";
import { registerWebStaticFiles } from "../server/_core/web-static";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("published web shell", () => {
  it("serves the Expo entry point at root and application routes without intercepting API routes", async () => {
    const directory = await mkdtemp(join(tmpdir(), "plug-presenca-web-"));
    temporaryDirectories.push(directory);
    await writeFile(join(directory, "index.html"), "<main>Plug Presença</main>");

    const app = express();
    app.get("/api/health", (_request, response) => response.json({ ok: true }));
    expect(registerWebStaticFiles(app, directory)).toBe(true);

    const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
      const started = app.listen(0, () => resolve(started));
    });

    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Servidor de teste sem porta TCP");
      const baseUrl = `http://127.0.0.1:${address.port}`;

      const root = await fetch(`${baseUrl}/`);
      expect(root.status).toBe(200);
      expect(await root.text()).toContain("Plug Presença");

      const route = await fetch(`${baseUrl}/chamada/turma-1`);
      expect(route.status).toBe(200);
      expect(await route.text()).toContain("Plug Presença");

      const health = await fetch(`${baseUrl}/api/health`);
      expect(health.status).toBe(200);
      expect(await health.json()).toEqual({ ok: true });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  });
});
