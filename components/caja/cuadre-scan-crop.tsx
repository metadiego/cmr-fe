"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { CASH_SCAN_MIN_REGION, CASH_SCAN_PAGE_UNITS, type CashScanRegion } from "@/lib/api/cash-scan";
import { Button } from "@/components/ui/button";

type Drag = { startX: number; startY: number; x: number; y: number; w: number; h: number };

// Recorte sobre la vista previa (BE PR #591, handoff docs/specs/escaneo-preview-y-area-handoff-be.md):
// arrastrar un rectángulo sobre la imagen de 150dpi y convertirlo a 1/300" para el escaneo final. La
// conversión usa el tamaño RENDERIZADO del <img> (getBoundingClientRect), no sus píxeles naturales —
// la proporción es la misma, así que no hace falta leer el ancho/alto real de la imagen.
export function CuadreScanCrop({
  previewUrl,
  busy,
  onConfirm,
  onRetake,
  onCancel,
}: {
  previewUrl: string;
  busy: boolean;
  onConfirm: (region: CashScanRegion | null) => void;
  onRetake: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("caja.attachments");
  const imgRef = React.useRef<HTMLImageElement>(null);
  // Congela el rect del <img> al empezar a arrastrar: si algo mueve el diálogo a mitad de arrastre
  // (el diálogo de Radix se recentra solo ante CUALQUIER cambio de alto, como el texto de abajo
  // apareciendo), volver a leer getBoundingClientRect() en cada pointermove haría que la selección
  // "saltara" — el bug real que reportó el dueño ("se mueve", no se puede fijar el área).
  const dragRectRef = React.useRef<DOMRect | null>(null);
  const [drag, setDrag] = React.useState<Drag | null>(null);
  const [imgW, setImgW] = React.useState(0);
  const [imgH, setImgH] = React.useState(0);
  const hasSelection = !!drag && drag.w >= 4 && drag.h >= 4;
  const region =
    hasSelection && imgW && imgH
      ? {
          x: Math.round((drag.x * CASH_SCAN_PAGE_UNITS.width) / imgW),
          y: Math.round((drag.y * CASH_SCAN_PAGE_UNITS.height) / imgH),
          width: Math.max(CASH_SCAN_MIN_REGION, Math.round((drag.w * CASH_SCAN_PAGE_UNITS.width) / imgW)),
          height: Math.max(CASH_SCAN_MIN_REGION, Math.round((drag.h * CASH_SCAN_PAGE_UNITS.height) / imgH)),
        }
      : null;

  function pointerDown(e: React.PointerEvent) {
    if (busy) return;
    const rect = imgRef.current!.getBoundingClientRect();
    dragRectRef.current = rect;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setDrag({ startX: x, startY: y, x, y, w: 0, h: 0 });
    (e.target as Element).setPointerCapture(e.pointerId);
  }
  function pointerMove(e: React.PointerEvent) {
    // e.buttons === 0 = el botón ya se soltó. `setPointerCapture` en un mouse NO se libera solo al
    // soltar el botón (a diferencia de la captura implícita de siempre) — sin este freno, mover el
    // mouse hacia «Escanear esta área» DESPUÉS de soltar seguía llegando aquí como si se siguiera
    // arrastrando, y la selección «se movía» justo al ir a confirmarla (lo que reportó el dueño).
    if (!drag || busy || !dragRectRef.current || e.buttons === 0) return;
    const rect = dragRectRef.current;
    const cx = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
    const cy = Math.min(Math.max(e.clientY - rect.top, 0), rect.height);
    const x = Math.min(drag.startX, cx);
    const y = Math.min(drag.startY, cy);
    setDrag({ ...drag, x, y, w: Math.abs(cx - drag.startX), h: Math.abs(cy - drag.startY) });
  }
  function pointerUp(e: React.PointerEvent) {
    if ((e.target as Element).hasPointerCapture?.(e.pointerId)) (e.target as Element).releasePointerCapture(e.pointerId);
  }

  function confirmSelection() {
    onConfirm(region);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t("cropHelp")}</p>
      <div
        className="relative inline-block touch-none select-none"
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada efímera (10 min); no vale la pena el remote-pattern de next/image para esto. */}
        <img
          ref={imgRef}
          src={previewUrl}
          alt=""
          className="block max-h-[60vh] max-w-full rounded-md border"
          draggable={false}
          onLoad={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setImgW(r.width);
            setImgH(r.height);
          }}
        />
        {drag && (drag.w > 2 || drag.h > 2) && (
          <div className="pointer-events-none absolute border-2 border-primary bg-primary/10" style={{ left: drag.x, top: drag.y, width: drag.w, height: drag.h }} />
        )}
      </div>
      {/* Siempre montado, nunca condicional: aparecer/desaparecer cambiaría el alto del diálogo y lo
          recentraría a mitad de arrastre (la causa real del bug). */}
      <p className="min-h-4 font-mono text-xs text-muted-foreground">
        {region ? t("cropRegionDebug", { x: region.x, y: region.y, width: region.width, height: region.height }) : " "}
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>{t("scanCancel")}</Button>
        <Button type="button" variant="outline" onClick={onRetake} disabled={busy}>{t("cropRetake")}</Button>
        <Button type="button" variant="outline" onClick={() => onConfirm(null)} disabled={busy}>{t("cropFullPage")}</Button>
        <Button type="button" onClick={confirmSelection} disabled={busy || !hasSelection}>{t("cropUseSelection")}</Button>
      </div>
    </div>
  );
}
