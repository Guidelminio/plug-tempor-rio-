import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { authSessions, type User } from "../drizzle/schema";
import { getDb } from "./db";

const SESSION_PREFIX = "plug_local_";
const SESSION_DAYS = 45;

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionExpiryDate() {
  return new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
}

export async function createLocalSession(user: User, deviceName?: string) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const rawToken = `${SESSION_PREFIX}${randomBytes(32).toString("base64url")}`;
  await db.insert(authSessions).values({
    userId: user.id,
    tokenHash: tokenHash(rawToken),
    deviceName: deviceName?.trim().slice(0, 160) || null,
    expiresAt: sessionExpiryDate(),
  });
  return rawToken;
}

export async function readLocalSession(token: string | undefined): Promise<{ userId: number } | null> {
  if (!token?.startsWith(SESSION_PREFIX)) return null;
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const rows = await db.select().from(authSessions).where(and(
    eq(authSessions.tokenHash, tokenHash(token)),
    isNull(authSessions.revokedAt),
    gt(authSessions.expiresAt, new Date()),
  )).limit(1);
  const session = rows[0];
  if (!session) return null;
  await db.update(authSessions).set({ lastUsedAt: new Date() }).where(eq(authSessions.id, session.id));
  return { userId: session.userId };
}

export async function revokeLocalSession(token: string | undefined) {
  if (!token?.startsWith(SESSION_PREFIX)) return;
  const db = await getDb();
  if (!db) return;
  await db.update(authSessions).set({ revokedAt: new Date() }).where(eq(authSessions.tokenHash, tokenHash(token)));
}

export async function revokeAllUserSessions(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  await db.update(authSessions).set({ revokedAt: new Date() }).where(and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)));
}
