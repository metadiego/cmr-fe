// What the API keys screen says about each key, decided in one place (and tested) instead of in
// the table. A key is a machine's or a script's password: «never used» + full access is the risk
// the screen exists to surface (cmr-be docs/specs/api-keys-admin.md).

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scope: "clinic" | "admin";
  clinicId: string | null;
  permissions: string[];
  expiresAt: string | null;
  revokedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

export type KeyStatus = "active" | "neverUsed" | "expired" | "revoked";

export function keyStatus(key: ApiKey, now: Date = new Date()): KeyStatus {
  if (key.revokedAt) return "revoked";
  if (key.expiresAt && new Date(key.expiresAt) <= now) return "expired";
  return key.lastUsedAt ? "active" : "neverUsed";
}

export const isLive = (key: ApiKey, now: Date = new Date()): boolean => {
  const s = keyStatus(key, now);
  return s === "active" || s === "neverUsed";
};

export const isFullAccess = (key: ApiKey): boolean => key.permissions.includes("*");

export function summarize(keys: ApiKey[], now: Date = new Date()) {
  const live = keys.filter((k) => isLive(k, now));
  const unused = live.filter((k) => keyStatus(k, now) === "neverUsed");
  return {
    live: live.length,
    fullAccess: live.filter(isFullAccess).length,
    neverUsed: unused.length,
    neverUsedFullAccess: unused.filter(isFullAccess).length,
  };
}

// Riskiest first: never used with full access, then the other never used, then the live ones, then
// expired and revoked. Within a band, by name.
function rank(key: ApiKey, now: Date): number {
  const s = keyStatus(key, now);
  if (s === "neverUsed") return isFullAccess(key) ? 0 : 1;
  if (s === "active") return 2;
  return s === "expired" ? 3 : 4;
}

export function sortKeys(keys: ApiKey[], now: Date = new Date()): ApiKey[] {
  return [...keys].sort((a, b) => rank(a, now) - rank(b, now) || a.name.localeCompare(b.name));
}
