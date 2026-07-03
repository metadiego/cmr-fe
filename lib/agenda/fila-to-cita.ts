import type { CentroDia, CitaFila, Franja, TipoFranja } from "@/lib/api/agenda-dia";
import type { Cita, EstadoCita } from "@/lib/api/citas";

// Build a Cita-shaped object from a projected day-view/AP row so CitaActions
// (transitions / reschedule / history) can operate straight from the sheet.
// The row lacks some fields; block context supplies center/tipo/fecha/hora.
export function filaToCita(
  fila: CitaFila,
  centro: CentroDia,
  franja: Franja,
  tipo: TipoFranja,
  fecha: string,
): Cita {
  return {
    id: fila.id,
    estado: (fila.estado ?? fila["estado"] ?? "programada") as EstadoCita,
    clinicId: centro.clinicId,
    tipoCitaId: tipo.tipoCitaId,
    fecha,
    hora: franja.hora,
    medicoId: (fila["medicoId"] as string) ?? null,
  } as Cita;
}
