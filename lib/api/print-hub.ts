import { apiFetch } from "./client";
import { ApiError } from "./types";
import type { PrintHubConfig } from "@/lib/print/hub-target";

// Backup print hub configuration, one per center (BE module print-hub). Admin side needs
// print-hub.read/update/delete; printing reads GET /me/print-hub, which needs no admin permission.

export interface PrintHub extends PrintHubConfig {
  clinicId?: string;
}

// One center's configuration, or null when it has none (BE answers 404 printHub.notFound).
export async function getPrintHub(centerId: string): Promise<PrintHub | null> {
  try {
    return await apiFetch<PrintHub>(`/print-hubs/${centerId}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export function setPrintHub(
  centerId: string,
  config: { enabled: boolean; hubUrls: string[]; protocol: string; printerHost?: string; printerPort?: number; printerQueue?: string },
): Promise<PrintHub> {
  return apiFetch<PrintHub>(`/print-hubs/${centerId}`, { method: "PUT", body: JSON.stringify(config) });
}

export function deletePrintHub(centerId: string): Promise<unknown> {
  return apiFetch<unknown>(`/print-hubs/${centerId}`, { method: "DELETE" });
}

// What the person printing needs, for the center that owns the invoice (X-Tenant-ID). A center with
// nothing configured answers enabled:false, not an error.
export function getPrintHubForPrinting(centerId: string): Promise<PrintHubConfig> {
  return apiFetch<PrintHubConfig>("/me/print-hub", { headers: { "X-Tenant-ID": centerId } });
}
