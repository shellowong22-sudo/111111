import { resolveRuntimeSecurity } from './runtimeSecurity';

const runtimeSecurity = resolveRuntimeSecurity(process.env);
const localPreviewDatabaseUrl = "mysql://root@127.0.0.1:3307/finance_hub";
const configuredDatabaseUrl = process.env.DATABASE_URL?.trim();

export const ENV = {
  appId: "finance-hub-standalone",
  // Defaults are accepted only in development or explicit loopback preview.
  cookieSecret: runtimeSecurity.cookieSecret,
  // The desktop preview is intentionally backed by the local persistent MySQL
  // instance when the watchdog has not exported DATABASE_URL to the child
  // process.  This fallback is strictly loopback-only; production deployments
  // still require an explicit DATABASE_URL.
  databaseUrl: configuredDatabaseUrl || (runtimeSecurity.localPreview ? localPreviewDatabaseUrl : ""),
  ownerOpenId: process.env.LOCAL_ADMIN_OPEN_ID ?? "standalone_admin",
  isProduction: runtimeSecurity.isProduction,
  localPreview: runtimeSecurity.localPreview,
  bindHost: runtimeSecurity.bindHost,
  standaloneMode: process.env.STANDALONE_MODE === "true" || process.env.NODE_ENV !== "production",
  llmBaseUrl: process.env.LLM_BASE_URL ?? "",
  llmApiKey: process.env.LLM_API_KEY ?? "",
  llmModel: process.env.LLM_MODEL ?? "",
  freeLlmApiBaseUrl: process.env.FREELLMAPI_BASE_URL ?? "",
  freeLlmApiKey: process.env.FREELLMAPI_API_KEY ?? "",
  freeLlmApiModel: process.env.FREELLMAPI_MODEL ?? "auto",
  omniRouteBaseUrl: process.env.OMNIROUTE_BASE_URL ?? "",
  omniRouteApiKey: process.env.OMNIROUTE_API_KEY ?? "",
  omniRouteModel: process.env.OMNIROUTE_MODEL ?? "auto",
  s3Endpoint: process.env.S3_ENDPOINT ?? "",
  s3Region: process.env.S3_REGION ?? "us-east-1",
  s3Bucket: process.env.S3_BUCKET ?? "",
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  s3ForcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  webhookUrl: process.env.WEBHOOK_URL ?? "",
  oidcIssuerUrl: process.env.OIDC_ISSUER_URL ?? "",
  oidcClientId: process.env.OIDC_CLIENT_ID ?? "",
  oidcClientSecret: process.env.OIDC_CLIENT_SECRET ?? "",
  // If no OIDC issuer is configured, use the built-in local administrator flow.
  authMode: runtimeSecurity.authMode,
  localAdminOpenId: process.env.LOCAL_ADMIN_OPEN_ID ?? "standalone_admin",
  localAdminName: process.env.LOCAL_ADMIN_NAME ?? "Standalone Admin",
  localAdminEmail: process.env.LOCAL_ADMIN_EMAIL ?? "",
  localAdminPassword: runtimeSecurity.localAdminPassword,
  dataApiEndpointsJson: process.env.DATA_API_ENDPOINTS_JSON ?? "{}",
  dataApiApiKey: process.env.DATA_API_API_KEY ?? "",
  appOrigin: runtimeSecurity.appOrigin,
  schedulerSecret: process.env.SCHEDULER_SECRET ?? "",
  schedulerTimeoutMs: Number(process.env.SCHEDULER_TIMEOUT_MS ?? "120000"),
};
