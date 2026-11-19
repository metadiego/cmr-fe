// Editing the multipliers (areas × days) of a line already on a draft invoice (BE #572). The PUT merges
// `meta` over the line's, so only the keys that CHANGED are sent. A multiplier is a whole number ≥ 1 —
// the same rule the BE enforces (facturacion.error.multiplicador_invalido); checking it here keeps a
// typo from becoming a round-trip, the BE stays the authority.

export type MultiplierPatch =
  | { kind: "none" }
  | { kind: "invalid"; field: string }
  | { kind: "patch"; meta: Record<string, number> };

export function multiplierPatch(current: Record<string, number>, typed: Record<string, string>): MultiplierPatch {
  const meta: Record<string, number> = {};
  for (const [key, raw] of Object.entries(typed)) {
    if (!(key in current)) continue;
    const text = raw.trim();
    const value = Number(text);
    if (text === "" || !Number.isInteger(value) || value < 1) return { kind: "invalid", field: key };
    if (value !== Number(current[key])) meta[key] = value;
  }
  return Object.keys(meta).length ? { kind: "patch", meta } : { kind: "none" };
}
