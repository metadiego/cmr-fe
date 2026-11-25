import type { FrontdeskColumna } from "../api/frontdesk.ts";
import type { Opcion } from "../api/tablero.ts";
import { noPackageToAttendOf } from "../api/no-package-gate.ts";

type ColsRenderItem = { kind: "col"; col: FrontdeskColumna } | { kind: "flujo" };
// Mirrors components/tablero/flujo-atencion.tsx's PackageGateCtx (kept untyped here to avoid a
// lib→component import; FilaSesion builds the real typed object from this plain shape).
type PackageGate = {
  patientId: string;
  service: string | null;
  packagesWithoutBalance: string[];
  productOptions: Opcion[];
  onCompleted: () => void;
};

// The row's own dose/product options (optionsSource "productos_grupo"): what the exceptional-
// availability form offers to pick from — never a second fetch for the list the DOSIS cell already has.
export function doseOptionsOf(colsRender: readonly ColsRenderItem[], optionsByCol: Record<string, Opcion[]>): Opcion[] {
  const doseCol = colsRender.find(
    (it) => it.kind === "col" && (it.col.render as { optionsSource?: string } | null)?.optionsSource === "productos_grupo",
  );
  return doseCol && doseCol.kind === "col" ? (optionsByCol[doseCol.col.clave] ?? []) : [];
}

// Everything FilaSesion's `run()` catch needs to open the NO_PACKAGE_TO_ATTEND dialog (cmr-be #693,
// handoff .personal/handoff-asistir-exige-sesiones.md), or null when the error is not that gate.
export function packageGateFrom(
  err: unknown,
  colsRender: readonly ColsRenderItem[],
  optionsByCol: Record<string, Opcion[]>,
  patientId: string,
  onCompleted: () => void,
): PackageGate | null {
  const sinPaquete = noPackageToAttendOf(err);
  if (!sinPaquete) return null;
  return {
    patientId,
    service: sinPaquete.service,
    packagesWithoutBalance: sinPaquete.packagesWithoutBalance,
    productOptions: doseOptionsOf(colsRender, optionsByCol),
    onCompleted,
  };
}
