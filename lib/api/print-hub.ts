import type { components } from "./schema";
import { apiFetch } from "./client";
import { ApiError } from "./types";

// Backup print hub configuration of a center (BE module print-hub): the center's hubs (ordered URLs)
// and its LIST of receipt printers (e.g. «Reception», «Billing»). Admin side needs
// print-hub.read/update/delete IN that center; printing reads GET /me/print-hub, which needs no admin
// permission. Handoff docs/specs/print-hub-several-printers-handoff-be.md.

// `commandSet` (BE PR #513, impresoras Star Line Mode — EN REVISIÓN a esta fecha): cada impresora trae
// cómo habla ("escpos", el default, o "star_line" para una Star que no se puede pasar a ESC/POS). Se
// declara A MANO porque el schema generado todavía no lo trae (mismo patrón que
// `frontdeskStartsOnConsultation` en lib/api/personal.ts) — quitar este tipo y usar el campo real en
// cuanto `npm run gen:api` lo traiga. Handoff .personal/handoff-impresoras-star.md.
import type { PrintCommandSet } from "@/lib/print/hub";
type ConCommandSet<T> = T & { commandSet?: PrintCommandSet };

export type CenterPrinter = ConCommandSet<components["schemas"]["PrinterResponseDto"]>;
export type CreatePrinterPayload = ConCommandSet<components["schemas"]["CreatePrinterDto"]>;
export type UpdatePrinterPayload = ConCommandSet<components["schemas"]["UpdatePrinterDto"]>;
export type PrinterForPrinting = ConCommandSet<components["schemas"]["PrinterForPrintingDto"]>;
// `printers` overridden below: the schema's own array entry type does not know about `commandSet` yet.
export type PrintHub = Omit<components["schemas"]["PrintHubResponseDto"], "printers"> & { printers: CenterPrinter[] };
export type PrintHubForPrinting = Omit<components["schemas"]["MyPrintHubResponseDto"], "printers"> & { printers: PrinterForPrinting[] };

// One center's configuration, or null when it has none (BE answers 404 PRINT_HUB_NOT_CONFIGURED).
export async function getPrintHub(centerId: string): Promise<PrintHub | null> {
  try {
    return await apiFetch<PrintHub>(`/print-hubs/${centerId}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

// The center's hubs. `protocol` is still required by the DTO (transition field of the first printer).
export function setPrintHub(centerId: string, config: { enabled: boolean; hubUrls: string[]; protocol: "ipp" | "smb" }): Promise<PrintHub> {
  return apiFetch<PrintHub>(`/print-hubs/${centerId}`, { method: "PUT", body: JSON.stringify(config) });
}

export function deletePrintHub(centerId: string): Promise<unknown> {
  return apiFetch<unknown>(`/print-hubs/${centerId}`, { method: "DELETE" });
}

export function createPrinter(centerId: string, payload: CreatePrinterPayload): Promise<CenterPrinter> {
  return apiFetch<CenterPrinter>(`/print-hubs/${centerId}/printers`, { method: "POST", body: JSON.stringify(payload) });
}

export function updatePrinter(centerId: string, id: string, payload: UpdatePrinterPayload): Promise<CenterPrinter> {
  return apiFetch<CenterPrinter>(`/print-hubs/${centerId}/printers/${id}`, { method: "PUT", body: JSON.stringify(payload) });
}

export function deletePrinter(centerId: string, id: string): Promise<unknown> {
  return apiFetch<unknown>(`/print-hubs/${centerId}/printers/${id}`, { method: "DELETE" });
}

// What the person printing needs, for the center that owns the invoice (X-Tenant-ID): its hubs and
// its active printers. A center with nothing configured answers enabled:false, not an error.
export function getPrintHubForPrinting(centerId: string): Promise<PrintHubForPrinting> {
  return apiFetch<PrintHubForPrinting>("/me/print-hub", { headers: { "X-Tenant-ID": centerId } });
}
