// Package lines (laser, PEMF…): a group whose multiplier column COUNTS VISITS bills
// packages × areas × days × price (BE cantidad-efectiva). The desk sees «2 áreas × 6 días = 12» as a
// locked quantity and sends quantity = packages (usually 1) — never the 12 again (owner, 05-nov-2026).

type Col = { slug: string; role: string; countsSessions?: boolean | null };

export function isPackageLine(multipliers: Col[]): boolean {
  return multipliers.some((c) => c.role === "multiplicador" && !!c.countsSessions);
}

// Units shown in the locked quantity: the product of every multiplier value. Any empty → 0 (not ready).
export function packageUnits(multipliers: Col[], valueOf: (slug: string) => string): number {
  const ms = multipliers.filter((c) => c.role === "multiplicador");
  if (ms.length === 0) return 0;
  return ms.reduce((acc, c) => acc * (Number(valueOf(c.slug)) || 0), 1);
}
