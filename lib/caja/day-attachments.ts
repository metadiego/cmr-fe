import { listarCuadres, listCashAttachments, type CashReconciliationAttachmentListed } from "@/lib/api/caja";

// Settlements escaneado del cuadre TOTAL del día (owner, 14-nov-2026): esa pantalla no tiene un solo
// reconciliationId propio — mezcla los adjuntos de TODOS los cuadres del día (las dos divisiones,
// todos los cajeros) en una sola lista, más nueva primero. Un cuadre sin adjuntos no cuenta como error
// (se ignora en silencio): es lo normal, no una falla.
export async function getDayAttachments(fecha: string, centroId?: string | null): Promise<CashReconciliationAttachmentListed[]> {
  const cuadres = await listarCuadres({ fecha });
  const lists = await Promise.all(cuadres.map((c) => listCashAttachments(c.id, centroId).catch(() => [])));
  return lists.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
