"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { ScanIcon } from "@hugeicons/core-free-icons";

import {
  getCashScans,
  previewCashScan,
  startCashScan,
  type CashScanColorMode,
  type CashScanJob,
  type CashScanRegion,
  type CashScanRequest,
  type CashScanSource,
} from "@/lib/api/cash-scan";
import { listScanners, type PrintHubScanner } from "@/lib/api/print-hub";
import { toastError } from "@/lib/api/errors";
import { useCan } from "@/hooks/use-can";
import { CuadreScanCrop } from "@/components/caja/cuadre-scan-crop";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const POLL_MS = 2000;
const EXPIRE_MS = 10 * 60 * 1000; // el hub descarta un trabajo no tomado a los 10 min (handoff)
const LAST_SCANNER_KEY = (centroId: string) => `cuadre-scan-last-scanner:${centroId}`;

type Options = { source: CashScanSource; duplex: boolean; colorMode: CashScanColorMode; resolution: 150 | 200 | 300 | 400 | 600 };
const DEFAULT_OPTIONS: Options = { source: "adf", duplex: false, colorMode: "Grayscale8", resolution: 300 };

// Botón «Escanear» junto a «Adjuntar» en el cuadre (BE PR #586, #591; handoffs
// .personal/handoff-escanear-al-cuadre.md y docs/specs/escaneo-preview-y-area-handoff-be.md): pide el
// escaneo al hub y consulta su estado hasta que termine (o caduque) — al terminar, avisa al padre
// (onScanned) para que recargue los adjuntos. Solo se muestra con permiso `caja.scan` y al menos un
// escáner activo en el centro. Con «Recortar antes de escanear» activado, primero pide un PREVIEW
// (150dpi, nunca se guarda como adjunto) y deja arrastrar el área a conservar sobre esa imagen
// (CuadreScanCrop) antes de pedir el escaneo final — `job` representa SIEMPRE el trabajo activo,
// preview o final, distinguido por `job.kind`.
export function CuadreScanButton({ reconciliationId, centroId, onScanned }: { reconciliationId: string; centroId?: string | null; onScanned: () => void }) {
  const t = useTranslations("caja.attachments");
  const tRoot = useTranslations();
  const { can } = useCan();
  const [scanners, setScanners] = React.useState<PrintHubScanner[] | null>(null);
  const [open, setOpen] = React.useState(false);
  const [scannerId, setScannerId] = React.useState("");
  const [seenScannersKey, setSeenScannersKey] = React.useState<string | null>(null);
  const [options, setOptions] = React.useState<Options>(DEFAULT_OPTIONS);
  const [cropEnabled, setCropEnabled] = React.useState(false);
  const [advanced, setAdvanced] = React.useState(false);
  const [starting, setStarting] = React.useState(false);
  const [job, setJob] = React.useState<CashScanJob | null>(null);
  const [expired, setExpired] = React.useState(false);
  const [pendingRegion, setPendingRegion] = React.useState<CashScanRegion | null>(null);
  const startedAtRef = React.useRef(0);

  const allowed = can("caja.scan");

  React.useEffect(() => {
    if (!allowed || !centroId) return;
    let active = true;
    listScanners(centroId)
      .then((list) => active && setScanners(list.filter((s) => s.active)))
      .catch(() => active && setScanners([]));
    return () => {
      active = false;
    };
  }, [allowed, centroId]);

  // El primer escáner llega async (fetch en un effect) — se adapta en el propio render, nunca
  // durante el SSR, porque `scanners` sigue en null hasta que ese fetch resuelve en el cliente.
  const scannersKey = scanners ? scanners.map((s) => s.id).join(",") : null;
  if (scannersKey !== null && scannersKey !== seenScannersKey) {
    setSeenScannersKey(scannersKey);
    const saved = centroId ? window.localStorage.getItem(LAST_SCANNER_KEY(centroId)) : null;
    setScannerId(saved && scanners!.some((s) => s.id === saved) ? saved : (scanners![0]?.id ?? ""));
  }

  // Mientras haya un trabajo pending/scanning (preview o final), consulta cada 2s; se detiene solo al
  // llegar a done/failed o al caducar a los 10 min sin que el hub lo tomara.
  React.useEffect(() => {
    if (!job || job.status === "done" || job.status === "failed" || expired) return;
    const id = setInterval(() => {
      if (Date.now() - startedAtRef.current > EXPIRE_MS) {
        setExpired(true);
        return;
      }
      getCashScans(reconciliationId, centroId)
        .then((jobs) => {
          const found = jobs.find((j) => j.id === job.id);
          if (found) setJob(found);
        })
        .catch(() => {});
    }, POLL_MS);
    return () => clearInterval(id);
  }, [job, expired, reconciliationId, centroId]);

  React.useEffect(() => {
    if (job?.status === "done" && job.kind === "final") {
      toast.success(t("scanDone"));
      onScanned();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo dispara al llegar a "done", no en cada render de onScanned
  }, [job?.status === "done", job?.kind]);

  if (!allowed || !scanners || scanners.length === 0) return null;

  async function runPreview() {
    if (!scannerId) return;
    setStarting(true);
    try {
      const started = await previewCashScan(reconciliationId, { scannerId, source: options.source, colorMode: options.colorMode }, centroId);
      if (centroId) window.localStorage.setItem(LAST_SCANNER_KEY(centroId), scannerId);
      startedAtRef.current = Date.now();
      setExpired(false);
      setJob(started);
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setStarting(false);
    }
  }

  async function runFinal(region: CashScanRegion | null) {
    if (!scannerId) return;
    setStarting(true);
    setPendingRegion(region);
    try {
      const body: CashScanRequest = {
        scannerId,
        source: options.source,
        duplex: options.source === "adf" ? options.duplex : undefined,
        colorMode: options.colorMode,
        resolution: options.resolution,
        region: region ?? undefined,
      };
      const started = await startCashScan(reconciliationId, body, centroId);
      if (centroId) window.localStorage.setItem(LAST_SCANNER_KEY(centroId), scannerId);
      startedAtRef.current = Date.now();
      setExpired(false);
      setJob(started);
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setStarting(false);
    }
  }

  function launch() {
    if (cropEnabled) void runPreview();
    else void runFinal(null);
  }
  function retry() {
    if (job?.kind === "preview") void runPreview();
    else void runFinal(pendingRegion);
  }

  const showCrop = job?.kind === "preview" && job.status === "done" && !!job.previewUrl && !expired;
  const statusLabel =
    expired ? t("scanExpired") : job?.status === "scanning" ? t("scanning") : job?.status === "pending" ? t("scanWaiting") : job?.status === "failed" ? (job.lastError ?? t("scanFailed")) : null;
  const canRetry = expired || job?.status === "failed";
  const busy = !!job && !expired && (job.status === "pending" || job.status === "scanning");

  return (
    <>
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setOpen(true)}>
        <HugeiconsIcon icon={ScanIcon} className="size-4" />
        {t("scan")}
      </Button>

      <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <DialogContent className={showCrop ? "sm:max-w-xl" : undefined}>
          <DialogHeader>
            <DialogTitle>{t("scanDialogTitle")}</DialogTitle>
          </DialogHeader>

          {showCrop ? (
            <CuadreScanCrop
              previewUrl={job.previewUrl!}
              busy={starting}
              onConfirm={(region) => void runFinal(region)}
              onRetake={() => void runPreview()}
              onCancel={() => setOpen(false)}
            />
          ) : (
            <>
              <div className="space-y-4">
                {scanners.length > 1 && (
                  <div className="space-y-1.5">
                    <Label>{t("scanScanner")}</Label>
                    <Select value={scannerId} onValueChange={setScannerId} disabled={busy}>
                      <SelectTrigger size="sm" className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {scanners.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={cropEnabled} onCheckedChange={setCropEnabled} disabled={busy} />
                  {t("cropToggle")}
                </label>

                <Collapsible open={advanced} onOpenChange={setAdvanced}>
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-0">{t("scanOptions")}</Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-2">
                    <div className="space-y-1.5">
                      <Label>{t("scanSource")}</Label>
                      <Select value={options.source} onValueChange={(v) => setOptions((o) => ({ ...o, source: v as CashScanSource }))} disabled={busy}>
                        <SelectTrigger size="sm" className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="adf">{t("scanSourceAdf")}</SelectItem>
                          <SelectItem value="platen">{t("scanSourcePlaten")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {options.source === "adf" && (
                      <label className="flex items-center gap-2 text-sm">
                        <Switch checked={options.duplex} onCheckedChange={(v) => setOptions((o) => ({ ...o, duplex: v }))} disabled={busy} />
                        {t("scanDuplex")}
                      </label>
                    )}
                    <div className="space-y-1.5">
                      <Label>{t("scanColorMode")}</Label>
                      <Select value={options.colorMode} onValueChange={(v) => setOptions((o) => ({ ...o, colorMode: v as CashScanColorMode }))} disabled={busy}>
                        <SelectTrigger size="sm" className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BlackAndWhite1">{t("scanColorBw")}</SelectItem>
                          <SelectItem value="Grayscale8">{t("scanColorGray")}</SelectItem>
                          <SelectItem value="RGB24">{t("scanColorRgb")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t("scanResolution")}</Label>
                      <Select value={String(options.resolution)} onValueChange={(v) => setOptions((o) => ({ ...o, resolution: Number(v) as Options["resolution"] }))} disabled={busy}>
                        <SelectTrigger size="sm" className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[150, 200, 300, 400, 600].map((r) => <SelectItem key={r} value={String(r)}>{r} dpi</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {statusLabel && (
                  <p className={canRetry ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{statusLabel}</p>
                )}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>{t("scanCancel")}</Button>
                <Button type="button" onClick={canRetry ? retry : launch} disabled={starting || busy || !scannerId}>
                  {busy ? statusLabel : canRetry ? t("scanRetry") : cropEnabled ? t("cropPreviewStart") : t("scanStart")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
