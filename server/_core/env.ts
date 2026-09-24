export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  attendanceEmailFrom: process.env.ATTENDANCE_EMAIL_FROM ?? "",
  attendanceAlertToEmail: process.env.ATTENDANCE_ALERT_TO_EMAIL ?? "",
  attendanceAppUrl: process.env.ATTENDANCE_APP_URL ?? "",
  /** One-time protected bootstrap values for the first local administrator. */
  initialAdminEmail: process.env.INITIAL_ADMIN_EMAIL ?? "",
  initialAdminPassword: process.env.INITIAL_ADMIN_PASSWORD ?? "",
  /** Apps Script Web App endpoint and shared HMAC secret. Both stay on the server. */
  appsScriptSyncUrl: process.env.APPS_SCRIPT_SYNC_URL ?? "",
  appsScriptSyncSecret: process.env.APPS_SCRIPT_SYNC_SECRET ?? "",
  allowedOrigins: process.env.ALLOWED_ORIGINS ?? "",
};
