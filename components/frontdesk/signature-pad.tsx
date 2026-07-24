"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

// Pad de firma en canvas (mouse + touch). Onchange devuelve el dataURL PNG (o "" al limpiar).
// Sin librerías externas. Print-friendly: el trazo queda dibujado en el canvas.
export function SignaturePad({
  onChange,
  height = 120,
  className = "",
}: {
  onChange?: (dataUrl: string) => void;
  height?: number;
  className?: string;
}) {
  const t = useTranslations("frontdesk");
  const ref = React.useRef<HTMLCanvasElement | null>(null);
  const drawing = React.useRef(false);
  const [vacio, setVacio] = React.useState(true);

  const ctx = () => ref.current?.getContext("2d") ?? null;
  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = ref.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = ctx();
    if (!c) return;
    drawing.current = true;
    const p = pos(e);
    c.beginPath();
    c.moveTo(p.x, p.y);
    ref.current!.setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const c = ctx();
    if (!c) return;
    const p = pos(e);
    c.lineTo(p.x, p.y);
    c.strokeStyle = "#111";
    c.lineWidth = 2;
    c.lineCap = "round";
    c.stroke();
    if (vacio) setVacio(false);
  }
  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    onChange?.(ref.current?.toDataURL("image/png") ?? "");
  }
  function limpiar() {
    const c = ctx();
    if (!c || !ref.current) return;
    c.clearRect(0, 0, ref.current.width, ref.current.height);
    setVacio(true);
    onChange?.("");
  }

  return (
    <div className={className}>
      <canvas
        ref={ref}
        height={height}
        width={520}
        className="w-full touch-none rounded-md border bg-white"
        style={{ height }}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <div className="mt-1 flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{t("firmaPaciente")}</span>
        {!vacio && (
          <button type="button" onClick={limpiar} className="text-[11px] text-muted-foreground underline hover:text-foreground print:hidden">
            {t("firmaLimpiar")}
          </button>
        )}
      </div>
    </div>
  );
}
