"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

// Tooltip INTELIGENTE (hover + focus), sin dependencias. Se dibuja en un portal con posición fija
// (no lo recorta ningún ancestro con overflow) y decide solo su ubicación: prefiere arriba, pero si
// no cabe se voltea abajo, y se desplaza horizontalmente para no salirse de la vista. Misma API que
// antes (content + children): patrón single-line + ellipsis + tooltip de tablas enterprise.
export function Tooltip({
  content,
  children,
  className,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLSpanElement>(null);
  const tipRef = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);

  const reposition = React.useCallback(() => {
    const trigger = triggerRef.current;
    const tip = tipRef.current;
    if (!trigger || !tip) return;
    const r = trigger.getBoundingClientRect();
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 6;
    const margin = 8;
    const spaceAbove = r.top;
    const spaceBelow = vh - r.bottom;
    // Arriba si cabe; si no, abajo si cabe; si en ninguno, al lado con más espacio.
    let top: number;
    if (spaceAbove >= th + gap) top = r.top - th - gap;
    else if (spaceBelow >= th + gap) top = r.bottom + gap;
    else top = spaceAbove >= spaceBelow ? margin : vh - th - margin;
    // Centrado horizontal, recortado a la vista.
    let left = r.left + r.width / 2 - tw / 2;
    left = Math.min(Math.max(margin, left), Math.max(margin, vw - tw - margin));
    setPos({ top, left });
  }, []);

  // Reposiciona al abrir (dos pasadas: primero renderiza oculto para medir) y ante scroll/resize.
  React.useLayoutEffect(() => {
    if (!open) return;
    reposition();
    const onMove = () => reposition();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, content, reposition]);

  function show() {
    setPos(null);
    setOpen(true);
  }
  function hide() {
    setOpen(false);
  }

  return (
    <span
      ref={triggerRef}
      className={cn("relative inline-flex", className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      tabIndex={0}
    >
      {children}
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={tipRef}
              role="tooltip"
              style={{
                position: "fixed",
                top: pos ? pos.top : -9999,
                left: pos ? pos.left : -9999,
                opacity: pos ? 1 : 0,
              }}
              className="pointer-events-none z-[100] max-w-[min(20rem,calc(100vw-1rem))] break-words whitespace-normal rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md"
            >
              {content}
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}
