import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./_core/env";

const SESSION_PREFIX = "plug_google_";
const encoder = new TextEncoder();

type GoogleSessionPayload = {
  userId: number;
  email: string | null;
};

function sessionSecret() {
  if (!ENV.cookieSecret) throw new Error("A chave de sessão do aplicativo não está configurada.");
  return encoder.encode(ENV.cookieSecret);
}

export async function createGoogleSession(payload: GoogleSessionPayload): Promise<string> {
  const token = await new SignJWT({ email: payload.email, sessionType: "google" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(payload.userId))
    .setIssuedAt()
    .setExpirationTime("10d")
    .sign(sessionSecret());
  return `${SESSION_PREFIX}${token}`;
}

export async function readGoogleSession(value: string | undefined): Promise<GoogleSessionPayload | null> {
  if (!value?.startsWith(SESSION_PREFIX)) return null;
  try {
    const token = value.slice(SESSION_PREFIX.length);
    const { payload } = await jwtVerify(token, sessionSecret());
    if (payload.sessionType !== "google" || !payload.sub) return null;
    const userId = Number(payload.sub);
    if (!Number.isInteger(userId) || userId <= 0) return null;
    return { userId, email: typeof payload.email === "string" ? payload.email : null };
  } catch {
    return null;
  }
}
