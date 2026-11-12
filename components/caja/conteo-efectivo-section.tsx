"use client";

import { money } from "@/lib/caja/totales";

export type ConteoEfectivoLinea = { key: string; quantity: number; value: number; amount: number };
export type ConteoEfectivoPanel = {
  title: string;
  subtitle?: string;
  lines: ConteoEfectivoLinea[];
  total: number | null; // null = sin conteo todavía
};

// Uno o dos paneles de "Conteo de efectivo" (cantidad · valor · monto, mayor a menor) en el Pie del
// cuadre: uno solo = conteo único/consolidado (como siempre); dos = Consulta + General en modo
// `split` (BE #566, handoff .personal/handoff-cuadre-uno-o-dos-conteos.md). Extraído de
// cuadre-detalle.tsx (techo de 600 líneas, eslint.config.mjs) — mismo markup, solo repetible.
export function ConteoEfectivoSection({
  panels,
  labels,
}: {
  panels: ConteoEfectivoPanel[];
  labels: { colCantidad: string; colValor: string; colMonto: string; conteoTotal: string; sinConteo: string };
}) {
  return (
    <>
      {panels.map((p, i) => (
        <section
          key={i}
          className="overflow-hidden rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]"
        >
          <h3 className="flex items-center justify-between border-b px-4 py-2.5 text-sm font-semibold">
            <span>{p.title}</span>
            {p.subtitle && <span className="text-xs font-normal text-muted-foreground">{p.subtitle}</span>}
          </h3>
          {p.total == null ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">{labels.sinConteo}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2 text-right font-semibold">{labels.colCantidad}</th>
                    <th className="px-4 py-2 text-right font-semibold">{labels.colValor}</th>
                    <th className="px-4 py-2 text-right font-semibold">{labels.colMonto}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {p.lines.length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-3 text-center text-muted-foreground">{labels.sinConteo}</td></tr>
                  )}
                  {[...p.lines].sort((a, b) => b.value - a.value).map((l) => (
                    <tr key={l.key}>
                      <td className="px-4 py-2 text-right tabular-nums">{l.quantity}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{money(l.value)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{money(l.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2">
                    <td className="px-4 py-2 text-right text-xs uppercase tracking-wide text-muted-foreground" colSpan={2}>{labels.conteoTotal}</td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums">{money(p.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      ))}
    </>
  );
}
