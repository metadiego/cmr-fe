import { apiFetch } from "./client";

// Escanear al cuadre (BE PR #586, handoff .personal/handoff-escanear-al-cuadre.md): los settlements
// firmados se escanean desde la app y quedan como adjuntos del cuadre, sin pasar por el teléfono. El
// trabajo es asíncrono — el hub lo toma y sube el PDF — así que esta pantalla solo pide el escaneo y
// consulta su estado cada 2s (pending → scanning → done | failed). Ya en inglés en v1 y v2: no hay
// claves nuevas que traducir en el envoltorio.
function qs(centerId?: string | null): string {
  return centerId ? `?centerIds=${encodeURIComponent(centerId)}` : "";
}

export type CashScanSource = "adf" | "platen";
export type CashScanColorMode = "BlackAndWhite1" | "Grayscale8" | "RGB24";
export type CashScanResolution = 150 | 200 | 300 | 400 | 600;
export type CashScanStatus = "pending" | "scanning" | "done" | "failed";

export interface CashScanRequest {
  scannerId: string;
  source?: CashScanSource;
  duplex?: boolean;
  colorMode?: CashScanColorMode;
  resolution?: CashScanResolution;
}

export interface CashScanJob {
  id: string;
  status: CashScanStatus;
  lastError: string | null;
  attachmentId: string | null;
  scannerId: string;
  createdAt: string;
}

export function startCashScan(id: string, payload: CashScanRequest, centerId?: string | null): Promise<CashScanJob> {
  return apiFetch<CashScanJob>(`/cash/reconciliations/${id}/scans${qs(centerId)}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getCashScans(id: string, centerId?: string | null): Promise<CashScanJob[]> {
  return apiFetch<CashScanJob[]>(`/cash/reconciliations/${id}/scans${qs(centerId)}`);
}
