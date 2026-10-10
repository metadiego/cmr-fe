import * as React from "react";
import type { FormatoPie } from "@/lib/api/formatos";

// Small presentational pieces shared by the formats in formatos-modal.tsx/formato-generico.tsx
// (split out to keep those files under the line ceiling).

// CSS autocontenido para la ventana de impresión (el documento NO hereda Tailwind ahí). Un formato
// es un PAPEL: no puede depender de estilos externos ni de que el otro lado tenga el diccionario.
const PRINT_CSS = `
*{box-sizing:border-box}
@page{size:letter;margin:9mm}
html,body{height:100%}
body{font-family:system-ui,-apple-system,Arial,sans-serif;color:#000;background:#fff;margin:0;font-size:11px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.no-print{display:none!important}
/* El documento LLENA la hoja (no amontonado arriba): columna flex de altura completa; la zona marcada
   .formato-grow (p. ej. OBSERVACIONES, o un espaciador) crece para empujar firmas/pie al fondo. */
.formato-doc{display:flex;flex-direction:column;min-height:100vh}
.formato-grow{flex:1 1 auto}
/* Campos (layout "campos"): aireados, una línea por campo con buen espacio. */
.formato-campos{display:flex;flex-direction:column;gap:16px;font-size:13px;margin-top:16px}
.formato-campos .campo{display:flex;gap:8px}
h2{font-size:15px;margin:0}
table{width:100%;border-collapse:collapse;font-size:9.5px;margin-top:3px}
th,td{border:1px solid #999;padding:1.5px 5px;text-align:left;vertical-align:top;line-height:1.2}
img{max-width:100%;max-height:38px;object-fit:contain}
.text-center{text-align:center}.text-right{text-align:right}
.font-bold{font-weight:700}.font-semibold{font-weight:600}.font-medium{font-weight:500}
.uppercase{text-transform:uppercase}.tracking-wide{letter-spacing:.04em}
.text-lg{font-size:15px}.text-base{font-size:13px}.text-sm{font-size:12px}.text-xs{font-size:10px}
.flex{display:flex}.items-end{align-items:flex-end}.items-start{align-items:flex-start}
.justify-between{justify-content:space-between}.gap-3{gap:10px}.gap-4{gap:12px}
.border-b{border-bottom:1px solid #000}.pb-2{padding-bottom:4px}.pb-3{padding-bottom:5px}.pt-2{padding-top:3px}.pt-3{padding-top:4px}
.mt-1{margin-top:3px}.mt-2{margin-top:5px}.mt-3{margin-top:6px}.mb-1{margin-bottom:2px}.mb-2{margin-bottom:4px}
.ml-2{margin-left:8px}.ml-3{margin-left:12px}
.tabular-nums{font-variant-numeric:tabular-nums}
.bg-neutral-100{background:#f2f2f2}.text-neutral-500{color:#666}
.space-y-2>*+*{margin-top:5px}.space-y-3>*+*{margin-top:6px}.space-y-4>*+*{margin-top:8px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
/* Cada región/tabla no se parte entre páginas si cabe */
section, .region { break-inside: avoid; }
/* Hora entrada/salida (TimePicker): only the time text on a dashed line, no button chrome. */ .formato-hora{border:0;border-bottom:1px dashed #000;background:none;font:inherit;color:inherit;padding:0 2px} .formato-hora svg{display:none}
/* Formatos GENÉRICOS (rejillas en blanco para llenar a mano): filas ALTAS y aireadas, que llenen la hoja
   (no amontonadas arriba). No aplica a las tablas densas de láser (HILT/MLS). */
.formato-grid td { height: 46px; padding: 8px 8px; vertical-align: top; }
.formato-grid th { padding: 5px 8px; }
`;

// Imprime un elemento en una VENTANA propia (evita el recorte del Dialog/Radix que dejaba la hoja en
// blanco). Clona el nodo, convierte cualquier <canvas> (firma) en <img> para que sí salga impreso.
// `extraCss` goes after the base sheet (e.g. the landscape, margin-less pages of layout "paginas").
export function imprimirFormato(el: HTMLElement | null, titulo: string, extraCss = "") {
  if (!el || typeof window === "undefined") return;
  const clone = el.cloneNode(true) as HTMLElement;
  const canvasOrig = el.querySelectorAll("canvas");
  const canvasClone = clone.querySelectorAll("canvas");
  canvasOrig.forEach((c, i) => {
    try {
      const img = document.createElement("img");
      img.src = (c as HTMLCanvasElement).toDataURL("image/png");
      canvasClone[i]?.replaceWith(img);
    } catch { /* canvas vacío/tainted: se omite */ }
  });
  const w = window.open("", "_blank", "width=900,height=1100");
  if (!w) return; // bloqueado por popup: el usuario debe permitir ventanas emergentes
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${titulo}</title><style>${PRINT_CSS}${extraCss}</style></head><body>${clone.innerHTML}</body></html>`);
  w.document.close();
  w.focus();
  const go = () => { w.print(); };
  // Espera a que carguen imágenes (logo/firma) antes de imprimir.
  if (w.document.images.length) setTimeout(go, 400); else setTimeout(go, 150);
}

// "f-b/" = "format by": iniciales de quien imprimió + fecha/hora (p. ej. "f-b/ LA - 2026-10-09 21:47").
// Todas las iniciales del nombre registrado (no solo 2 fijas) — dos personas distintas pueden compartir
// las mismas 2 iniciales, así que se toma una por cada palabra del nombre completo. Pedido del dueño,
// 09-oct-2026, comparando el pie contra los PDF de referencia (mostraban "LA", el FE mostraba el nombre
// completo resuelto por el BE, p. ej. "Master").
function iniciales(nombre: string): string {
  return nombre.trim().split(/\s+/).map((palabra) => palabra[0] ?? "").join("").toUpperCase();
}

// Pie del legacy, compartido por TODOS los formatos (genérico + láser HILT/MLS): pequeño, a la izquierda,
// al final de la hoja. Formato `{prefijo}{iniciales(usuario)||login} - {fechaHora}`. Se PREFIERE `usuario`
// porque el BE resuelve el nombre real del perfil; `login` (authUserId, un uuid) es el respaldo y NO se le
// sacan iniciales (no tendría sentido).
export function PieFormato({ pie }: { pie?: FormatoPie }) {
  if (!pie) return null;
  const quien = pie.user ? iniciales(pie.user) : (pie.login || "");
  const txt = `${pie.prefix ?? ""}${quien}${pie.fechaHora ? ` - ${pie.fechaHora}` : ""}`;
  if (!txt.trim()) return null;
  return <div className="mt-4 text-left text-[10px] text-neutral-500">{txt}</div>;
}

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
