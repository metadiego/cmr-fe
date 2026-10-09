import * as React from "react";

// Small presentational pieces shared by the formats in formatos-modal.tsx (split out to keep that
// file under the line ceiling).

// Logo del membrete, compartido por los tres formatos (campos, rejilla, láser HILT/MLS). Data-driven:
// `logoUrl` del centro (membrete.logoUrl); si viene null (caso de hoy), el asset por defecto del legacy.
// Altura FIJA (nunca ancho 100%) para no mover el layout; en rejillas apretadas se pasa 32px (el reporte
// manda, el logo cede). `maxHeight` inline pisa el `img{max-height}` del CSS de impresión. Decorativo (alt
// vacío) y eager porque se imprime. Contrato: HANDOFF-logo-en-formatos.
export function LogoFormato({ logoUrl, size = 42, className }: { logoUrl?: string | null; size?: number; className?: string }) {
  const src = logoUrl || "/img/logo_cmr.png";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="eager"
      style={{ height: size, maxHeight: size, width: "auto" }}
      className={"object-contain " + (className ?? "")}
    />
  );
}

export const HORA_CLS = /* dashed fill-in line; .formato-hora in PRINT_CSS strips the button on paper */ "formato-hora h-7 w-auto rounded-none border-0 border-b border-dashed bg-transparent px-1 shadow-none hover:bg-transparent";

export function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 font-medium">{label}:</span>
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}
