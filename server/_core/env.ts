export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  /** Resend send-only key; this value remains on the server and is never sent to Expo. */
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  /** Verified sender, e.g. Plug Presença <presenca@escola.org>. */
  attendanceEmailFrom: process.env.ATTENDANCE_EMAIL_FROM ?? "",
  /** Administrative email that receives failures from automatic teacher reminders. */
  attendanceAlertToEmail: process.env.ATTENDANCE_ALERT_TO_EMAIL ?? "",
  /** Public app or web portal URL included in teacher email reminders. */
  attendanceAppUrl: process.env.ATTENDANCE_APP_URL ?? "",
};
