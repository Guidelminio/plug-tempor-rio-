import type { NextFunction, Request, Response } from "express";

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://plugpresenca-7giuvcqj.manus.space",
];

export function allowedOriginsFromEnvironment(value = process.env.ALLOWED_ORIGINS): Set<string> {
  const configured = (value ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
  return new Set(configured.length ? configured : DEFAULT_ALLOWED_ORIGINS);
}

export function isOriginAllowed(origin: string | undefined, allowed = allowedOriginsFromEnvironment()): boolean {
  return !origin || allowed.has(origin.replace(/\/$/, ""));
}

export function applyCors(allowed = allowedOriginsFromEnvironment()) {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin && allowed.has(origin.replace(/\/$/, ""))) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Vary", "Origin");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");

    if (req.method === "OPTIONS") {
      if (origin && !isOriginAllowed(origin, allowed)) {
        res.sendStatus(403);
        return;
      }
      res.sendStatus(204);
      return;
    }
    next();
  };
}
