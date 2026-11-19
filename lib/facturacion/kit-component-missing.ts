// Checks for «Add component (amount unchanged)» on an issued kit line
// (components/facturacion/add-kit-component.tsx): pick one optional and give a reason.

export type KitComponentField = "component" | "reason";
export type KitComponentProblem = "reasonTooShort";

/** The reason must have at least this many characters after trim (unchanged from before the form kit). */
export const KIT_COMPONENT_REASON_MIN = 3;

/** Empty required fields, in on-screen order (component list, then reason). */
export function kitComponentMissing(s: { componentId: string; reason: string }): KitComponentField[] {
  const out: KitComponentField[] = [];
  if (!s.componentId) out.push("component");
  if (s.reason.trim() === "") out.push("reason");
  return out;
}

/** A typed reason that is still too short (filled but not acceptable), or null. */
export function kitComponentInvalid(s: { reason: string }): KitComponentProblem | null {
  const n = s.reason.trim().length;
  return n > 0 && n < KIT_COMPONENT_REASON_MIN ? "reasonTooShort" : null;
}
