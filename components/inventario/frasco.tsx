"use client";

import * as React from "react";

// EL FRASCO. Es la mitad del valor de la pantalla: un vial dibujado con su nivel real se entiende sin
// leer, y el personal lo compara de un vistazo con lo que tiene en la nevera. SVG puro — sin imágenes,
// sin librerías — para que funcione igual en claro y oscuro y se imprima bien.
// See docs/specs/pantalla-de-viales.md

export function Frasco({
  nivel,
  etiqueta,
  className,
}: {
  /** 0–100. Lo da el BE ya acotado. */
  nivel: number;
  etiqueta?: string;
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, nivel));
  // El cuerpo del vial va de y=22 a y=76 (54 de alto): el líquido crece desde abajo.
  const alto = (54 * pct) / 100;
  const y = 76 - alto;
  return (
    <div className={`flex flex-col items-center gap-1 ${className ?? ""}`}>
      <svg width="56" height="86" viewBox="0 0 56 86" aria-hidden="true">
        {/* tapa */}
        <rect x="20" y="2" width="16" height="8" rx="2" className="fill-muted-foreground/60" />
        <rect x="23" y="10" width="10" height="6" className="fill-muted-foreground/40" />
        {/* cuerpo */}
        <rect
          x="12"
          y="16"
          width="32"
          height="64"
          rx="6"
          className="fill-muted/40 stroke-border"
          strokeWidth="1.5"
        />
        {/* líquido */}
        {pct > 0 && (
          <rect
            x="13.5"
            y={y}
            width="29"
            height={alto}
            rx="4"
            className="fill-primary/70"
          />
        )}
        {/* brillo */}
        <rect x="17" y="22" width="3" height="40" rx="1.5" className="fill-background/50" />
      </svg>
      {etiqueta && (
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
          {etiqueta}
        </span>
      )}
    </div>
  );
}

// Los frascos CERRADOS: una pila con su cuenta. No se dibujan trece frascos — se dibuja la pila y el
// número, que es como lo cuenta quien abre la nevera.
export function PilaDeFrascos({ cantidad }: { cantidad: number }) {
  return (
    <div className="relative flex items-end">
      {[0, 1, 2].map((i) => (
        <svg
          key={i}
          width="34"
          height="70"
          viewBox="0 0 34 70"
          aria-hidden="true"
          className={i > 0 ? "-ml-3" : ""}
          style={{ opacity: 1 - i * 0.18 }}
        >
          <rect x="11" y="2" width="12" height="6" rx="2" className="fill-muted-foreground/50" />
          <rect
            x="5"
            y="10"
            width="24"
            height="54"
            rx="5"
            className="fill-muted/60 stroke-border"
            strokeWidth="1.5"
          />
        </svg>
      ))}
      <span className="absolute -right-2 -top-1 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
        {cantidad}
      </span>
    </div>
  );
}
