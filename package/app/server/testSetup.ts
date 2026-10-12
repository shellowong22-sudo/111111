/**
 * Local integration-test defaults.
 *
 * The application deliberately has no implicit production database URL.  The
 * Vitest process, however, needs a deterministic local database when a caller
 * runs the suite without exporting DATABASE_URL.  Keep this scoped to tests:
 * it is never imported by the server entrypoint and never changes runtime
 * configuration for development or production.
 */
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "mysql://root@127.0.0.1:3307/finance_hub";
}
