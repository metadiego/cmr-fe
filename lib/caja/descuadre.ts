// A cash difference that does not balance: «falta» (short, negative) or «sobra» (over, positive), with
// the absolute amount to print. Under a cent counts as balanced (float noise from sums of cents).
// Owner, 21-nov-2026: everything that does not balance is boxed in red, cashier by cashier, and the
// consolidated count says who made it (handoff docs/specs/cuadre-aviso-conteo-consolidado.md).

export type Descuadre = { kind: "short" | "over"; amount: number };

export function descuadreOf(difference: number | null | undefined): Descuadre | null {
  const d = Number(difference);
  if (difference == null || !Number.isFinite(d) || Math.abs(d) < 0.005) return null;
  return { kind: d < 0 ? "short" : "over", amount: Math.abs(d) };
}

/** A cashier is boxed when the BE says it does not balance, or (BE flag missing) its difference is not zero. */
export function cashierUnbalanced(c: { balanced?: boolean | null; difference?: number | null }): boolean {
  return c.balanced === false || (c.balanced == null && descuadreOf(c.difference) != null);
}

/** The consolidated count overrides the cashiers only when it carries a non-zero difference. */
export function overrideDiffers(o: { difference?: number | null } | null | undefined): boolean {
  return !!o && descuadreOf(o.difference) != null;
}
