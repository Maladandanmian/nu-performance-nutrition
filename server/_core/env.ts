export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  adminEmails: process.env.ADMIN_EMAILS ?? "",
  // Email configuration
  emailHost: process.env.EMAIL_HOST ?? "",
  emailPort: process.env.EMAIL_PORT ?? "",
  emailUser: process.env.EMAIL_USER ?? "",
  emailPassword: process.env.EMAIL_PASSWORD ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "",
  appUrl: process.env.VITE_APP_URL ?? "",
};

// Parse comma-separated admin emails into an array
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const adminEmailList = ENV.adminEmails
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(e => e.length > 0);
  return adminEmailList.includes(email.toLowerCase());
}
