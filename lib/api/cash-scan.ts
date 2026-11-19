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
export type CashScanKind = "preview" | "final";

// En 1/300 de pulgada desde la esquina superior izquierda del cristal (BE PR #591, handoff
// docs/specs/escaneo-preview-y-area-handoff-be.md). Toda la hoja carta son 2550×3300 — esos dos
// números son los que convierten un recorte hecho sobre la imagen de preview a esta unidad: no hace
// falta leer el tamaño real de la imagen, el recorte se mide en proporción al elemento <img> que el
// usuario ve (ver cuadre-scan-crop.tsx).
export interface CashScanRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}
export const CASH_SCAN_PAGE_UNITS = { width: 2550, height: 3300 } as const;
export const CASH_SCAN_MIN_REGION = 295;

export interface CashScanRequest {
  scannerId: string;
  source?: CashScanSource;
  duplex?: boolean;
  colorMode?: CashScanColorMode;
  resolution?: CashScanResolution;
  region?: CashScanRegion;
}
export interface CashScanPreviewRequest {
  scannerId: string;
  source?: CashScanSource;
  colorMode?: CashScanColorMode;
}

export interface CashScanJob {
  id: string;
  status: CashScanStatus;
  kind: CashScanKind;
  region: CashScanRegion | null;
  lastError: string | null;
  attachmentId: string | null;
  scannerId: string;
  createdAt: string;
  // Solo en un job de preview ya `done` (BE #591) — JPEG firmado, caduca en 10 min.
  previewUrl?: string | null;
}

export function startCashScan(id: string, payload: CashScanRequest, centerId?: string | null): Promise<CashScanJob> {
  return apiFetch<CashScanJob>(`/cash/reconciliations/${id}/scans${qs(centerId)}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// No crea adjunto — solo deja ver la imagen para recortar antes del escaneo final.
export function previewCashScan(id: string, payload: CashScanPreviewRequest, centerId?: string | null): Promise<CashScanJob> {
  return apiFetch<CashScanJob>(`/cash/reconciliations/${id}/scans/preview${qs(centerId)}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getCashScans(id: string, centerId?: string | null): Promise<CashScanJob[]> {
  return apiFetch<CashScanJob[]>(`/cash/reconciliations/${id}/scans${qs(centerId)}`);
}
