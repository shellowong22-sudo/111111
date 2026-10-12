import dotenv from "dotenv";

dotenv.config({
  path: process.env.STANDALONE_ENV_FILE ?? "standalone/.env.standalone",
  override: true,
});

const baseRequired = [
  "DATABASE_URL",
  "JWT_SECRET",
  "LLM_BASE_URL",
  "LLM_API_KEY",
  "LLM_MODEL",
  "REDIS_URL",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "SCHEDULER_SECRET",
];
const optional = ["S3_ENDPOINT", "WEBHOOK_URL", "DATA_API_ENDPOINTS_JSON", "VITE_GOOGLE_MAPS_API_KEY"];
const authMode = process.env.AUTH_MODE ?? "local";
const authRequired = authMode === "oidc"
  ? ["OIDC_ISSUER_URL", "OIDC_CLIENT_ID", "OIDC_CLIENT_SECRET"]
  : ["LOCAL_ADMIN_OPEN_ID", "LOCAL_ADMIN_PASSWORD"];
const isUnset = (value) => !value || value.startsWith("replace-") || value.includes("change-me");
const requiredMissing = [...baseRequired, ...authRequired].filter((key) => isUnset(process.env[key]));
const optionalMissing = optional.filter((key) => isUnset(process.env[key]));

console.log(JSON.stringify({
  authMode,
  requiredMissing,
  optionalMissing,
  ready: requiredMissing.length === 0,
}, null, 2));

if (requiredMissing.length) process.exitCode = 1;
