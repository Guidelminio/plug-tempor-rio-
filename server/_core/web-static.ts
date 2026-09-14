import type { Express } from "express";
import express from "express";
import { existsSync } from "fs";
import { join, resolve } from "path";

/**
 * Serves the exported Expo web application after API routes have been registered.
 * API paths remain owned by Express/tRPC; all other unknown paths fall back to
 * Expo's index.html so Expo Router can resolve navigation client-side.
 */
export function registerWebStaticFiles(
  app: Express,
  outputDirectory = resolve(process.cwd(), "dist-web"),
): boolean {
  const indexFile = join(outputDirectory, "index.html");

  if (!existsSync(indexFile)) {
    console.warn(`[web] Static export not found at ${indexFile}; API-only mode enabled.`);
    return false;
  }

  app.use(express.static(outputDirectory, { index: "index.html" }));

  app.get("*", (req, res, next) => {
    if (req.path === "/api" || req.path.startsWith("/api/")) {
      next();
      return;
    }
    res.sendFile(indexFile);
  });

  return true;
}
