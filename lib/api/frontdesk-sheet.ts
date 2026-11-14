import { apiFetch } from "./client";

// Hoja de la visita (BE PR #598): qué paquetes consume (láser: MLS + HILT juntos, el principal
// primero según `primaryPackageRule` del servicio) y las ÁREAS propuestas para APLICADAS.
// GET /frontdesk/sessions/:id/sheet, permiso frontdesk.read. `areasSource` dice de dónde sale
// `areas`: "session" (ya tecleado en esta visita) · "package" (multiplicadores del paquete) ·
// "last_visit" (lo último tecleado, legado incluido) · null (no se sabe: dejar vacío, nunca un 1).
// Extraído de lib/api/frontdesk.ts (ceiling). Handoff docs/specs/laser-sesion-del-dia-y-areas-handoff-be.md.
export type SessionSheetPackage = {
  packageId: string;
  productId: string;
  productName: string | null; // NO en el mapa — dejado en español/null en legado sin meta
  sku: string | null;
  number: number;
  total: number;
  xy: string;
  primary: boolean;
};
export type SessionSheet = {
  sessionId: string;
  serviceId: string;
  display: string;
  packages: SessionSheetPackage[];
  areas: number | null;
  areasSource: "session" | "package" | "last_visit" | null;
};
export function getSessionSheet(sessionId: string, centroId?: string): Promise<SessionSheet> {
  return apiFetch<SessionSheet>(`/frontdesk/sessions/${sessionId}/sheet`, {}, centroId);
}
