import { OAuth2Client } from "google-auth-library";
import { GOOGLE_WEB_CLIENT_ID } from "../shared/google-config";

const googleClient = new OAuth2Client();

export type GoogleIdentity = {
  subject: string;
  email: string;
  name: string | null;
};

export async function verifyGoogleIdentityToken(idToken: string): Promise<GoogleIdentity> {
  const audience = process.env.GOOGLE_WEB_CLIENT_ID ?? process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? GOOGLE_WEB_CLIENT_ID;
  if (!audience) {
    throw new Error("A autenticação Google ainda não foi configurada no servidor.");
  }

  const ticket = await googleClient.verifyIdToken({ idToken, audience });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email || !payload.email_verified) {
    throw new Error("A conta Google não possui um e-mail verificado.");
  }

  return {
    subject: payload.sub,
    email: payload.email.trim().toLowerCase(),
    name: payload.name?.trim() || null,
  };
}
