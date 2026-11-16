// Checks for the protocol-change form (components/clientes/cambio-protocolo-form.tsx): at least one
// pending package to replace, at least one usable new line (product + sessions >= 1) and a reason.

export type ProtocolChangeLine = { productoId: string; sesiones: string };
export type ProtocolChangeField = "origin" | "product" | "sessions" | "reason";

/** A new line that is sent: a product and at least one session. Lines that are not are left out. */
export function isUsableLine(l: ProtocolChangeLine): boolean {
  return !!l.productoId && Number(l.sesiones) >= 1;
}

/** Missing inputs, in on-screen order. */
export function protocolChangeMissing(s: {
  originCount: number;
  lines: readonly ProtocolChangeLine[];
  reason: string;
}): ProtocolChangeField[] {
  const out: ProtocolChangeField[] = [];
  if (s.originCount === 0) out.push("origin");
  if (!s.lines.some(isUsableLine)) {
    const withProduct = s.lines.filter((l) => l.productoId);
    if (withProduct.length === 0) out.push("product");
    else if (!withProduct.some((l) => l.sesiones.trim())) out.push("sessions");
  }
  if (!s.reason.trim()) out.push("reason");
  return out;
}

/** "sessionsAtLeastOne" when no line is usable only because its sessions are filled but below 1. */
export function protocolChangeInvalid(lines: readonly ProtocolChangeLine[]): "sessionsAtLeastOne" | null {
  if (lines.some(isUsableLine)) return null;
  return lines.some((l) => l.productoId && l.sesiones.trim()) ? "sessionsAtLeastOne" : null;
}
