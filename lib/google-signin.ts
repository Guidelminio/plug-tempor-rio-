import { Platform } from "react-native";
import { GOOGLE_WEB_CLIENT_ID } from "@/shared/google-config";

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? GOOGLE_WEB_CLIENT_ID;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";

export const isGoogleSignInConfigured = Boolean(webClientId);

type NativeGoogleModule = {
  configure: (options: { webClientId: string; iosClientId?: string; offlineAccess?: boolean }) => void;
  hasPlayServices: (options?: { showPlayServicesUpdateDialog?: boolean }) => Promise<void>;
  signIn: () => Promise<{ type?: string; data?: { idToken?: string | null } }>;
};

function nativeGoogleSignin(): NativeGoogleModule {
  if (Platform.OS === "web") {
    throw new Error("O login Google nativo deve ser aberto pelo aplicativo Android ou iOS.");
  }
  // Loaded only on native platforms so the web preview remains available.
  return require("@react-native-google-signin/google-signin").GoogleSignin as NativeGoogleModule;
}

export async function signInWithGoogleNative(): Promise<string> {
  if (!isGoogleSignInConfigured) {
    throw new Error("O login Google ainda não foi configurado para este aplicativo.");
  }
  const GoogleSignin = nativeGoogleSignin();
  GoogleSignin.configure({ webClientId, iosClientId: iosClientId || undefined, offlineAccess: false });
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const result = await GoogleSignin.signIn();
  if (result.type === "cancelled") throw new Error("Login Google cancelado.");
  const idToken = result.data?.idToken;
  if (!idToken) throw new Error("O Google não retornou um token de identidade válido.");
  return idToken;
}
