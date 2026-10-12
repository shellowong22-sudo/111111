const DEVELOPMENT_JWT_SECRET = 'local-development-jwt-secret-change-me-32-chars';
const DEVELOPMENT_ADMIN_PASSWORD = 'local-admin-change-me';

/** Local desktop preview is an explicit deployment mode, never a production default. */
export function resolveRuntimeSecurity(values: Record<string, string | undefined>) {
  const isProduction = values.NODE_ENV === 'production';
  const localPreview = values.LOCAL_PREVIEW === 'true';
  const authMode = values.AUTH_MODE ?? (values.OIDC_ISSUER_URL ? 'oidc' : 'local');
  const appOrigin = values.APP_ORIGIN ?? 'http://localhost:3000';
  const bindHost = localPreview ? '127.0.0.1' : (values.BIND_HOST ?? '0.0.0.0');
  const allowDevelopmentDefaults = !isProduction || localPreview;
  const cookieSecret = values.JWT_SECRET ?? (allowDevelopmentDefaults ? DEVELOPMENT_JWT_SECRET : '');
  const localAdminPassword = values.LOCAL_ADMIN_PASSWORD ?? (allowDevelopmentDefaults ? DEVELOPMENT_ADMIN_PASSWORD : '');
  const problems: string[] = [];

  if (localPreview) {
    let origin: URL | null = null;
    try { origin = new URL(appOrigin); } catch { /* reported below */ }
    if (!origin || origin.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(origin.hostname)
      || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
      problems.push('LOCAL_PREVIEW requires an http://localhost or http://127.0.0.1 APP_ORIGIN');
    }
    if (values.BIND_HOST && values.BIND_HOST !== '127.0.0.1') problems.push('LOCAL_PREVIEW BIND_HOST must be 127.0.0.1');
  }

  if (isProduction && !localPreview) {
    if (cookieSecret.length < 32 || cookieSecret === DEVELOPMENT_JWT_SECRET) problems.push('private JWT_SECRET (32+ characters; no development default)');
    if (authMode === 'local' && (!localAdminPassword || localAdminPassword === DEVELOPMENT_ADMIN_PASSWORD)) problems.push('private LOCAL_ADMIN_PASSWORD (no development default)');
    if (values.SCHEDULER_SECRET === 'finance-hub-local-scheduler-v1-4173') problems.push('private SCHEDULER_SECRET (no preview default)');
  }
  if (problems.length) throw new Error(`Runtime security configuration invalid: ${problems.join('; ')}`);
  return { isProduction, localPreview, authMode, appOrigin, bindHost, cookieSecret, localAdminPassword };
}
