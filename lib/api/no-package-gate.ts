import { ApiError } from "./types.ts"

// Único punto que reconoce el 422 NO_PACKAGE_TO_ATTEND (cmr-be #693, handoff
// .personal/handoff-asistir-exige-sesiones.md): asistir pide sesiones disponibles del paquete, y si no
// las hay, no se guarda nada (la fila sigue en_terapia). Igual que datosFaltantesDe (ehr-gate.ts), vive
// en su propio archivo puro para no arrastrar `apiFetch`/env en un test fuera de Next.
export type NoPackageToAttend = {
  service: string | null;
  packagesWithoutBalance: string[];
};

export function noPackageToAttendOf(err: unknown): NoPackageToAttend | null {
  if (!(err instanceof ApiError) || err.code !== "NO_PACKAGE_TO_ATTEND") return null;
  return {
    service: (err.data?.service as string | undefined) ?? null,
    packagesWithoutBalance: (err.data?.packagesWithoutBalance as string[] | undefined) ?? [],
  };
}
