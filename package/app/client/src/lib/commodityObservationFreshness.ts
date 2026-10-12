/** Historical observations remain in the table but cannot be presented as current market cards. */
export function isCommodityCurrentObservation(date: string, now = Date.now()) {
  const day = /^\d{4}-\d{2}-\d{2}/.exec(date)?.[0];
  if (!day) return false;
  const observed = Date.parse(`${day}T00:00:00Z`);
  const age = now - observed;
  return Number.isFinite(observed) && age >= -86_400_000 && age <= 45 * 86_400_000;
}
