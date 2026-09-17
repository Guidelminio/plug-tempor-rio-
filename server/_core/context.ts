import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { getUserById } from "../db";
import { readGoogleSession } from "../google-session";
import { readLocalSession } from "../local-session";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

function requestToken(req: CreateExpressContextOptions["req"]) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7).trim();
  return req.cookies?.app_session_id as string | undefined;
}

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let user: User | null = null;
  const token = requestToken(opts.req);

  try {
    const localSession = await readLocalSession(token);
    if (localSession) user = (await getUserById(localSession.userId)) ?? null;

    if (!user) {
      const googleSession = await readGoogleSession(token);
      if (googleSession) user = (await getUserById(googleSession.userId)) ?? null;
    }

    if (!user) user = await sdk.authenticateRequest(opts.req);
    if (user && !user.active) user = null;
  } catch {
    user = null;
  }

  return { req: opts.req, res: opts.res, user };
}
