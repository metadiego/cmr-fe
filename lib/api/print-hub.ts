import type { components } from "./schema";
import { apiFetch } from "./client";
import { ApiError } from "./types";

// Backup print hub configuration of a center (BE module print-hub): the center's hubs (ordered URLs)
// and its LIST of receipt printers (e.g. «Reception», «Billing»). Admin side needs
// print-hub.read/update/delete IN that center; printing reads GET /me/print-hub, which needs no admin
// permission. Handoff docs/specs/print-hub-several-printers-handoff-be.md.

export type PrintHub = components["schemas"]["PrintHubResponseDto"];
export type CenterPrinter = components["schemas"]["PrinterResponseDto"];
export type CreatePrinterPayload = components["schemas"]["CreatePrinterDto"];
export type UpdatePrinterPayload = components["schemas"]["UpdatePrinterDto"];
export type PrintHubForPrinting = components["schemas"]["MyPrintHubResponseDto"];
export type PrinterForPrinting = components["schemas"]["PrinterForPrintingDto"];

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
