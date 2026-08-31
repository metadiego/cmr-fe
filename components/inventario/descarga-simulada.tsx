"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert01Icon, PackageIcon } from "@hugeicons/core-free-icons";

import {
  getDescargaSimulada,
  listComponentes,
  type DescargaSimulada,
  type DescargaLinea,
  type DescargaModo,
} from "@/lib/api/inventario";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

// "¿Qué se descuenta si facturo esto?" — el árbol YA EXPANDIDO (kits anidados abiertos, cantidades
// multiplicadas) que usa la MISMA función que la descarga real. Pinta los avisos en el sitio: en ROJO el
// DUPLICADO (un producto que llega por dos caminos → se descontaría de más, el fallo del −197), y ciclo/
// profundidad (config rota). Contrato: HANDOFF-producto-kit-anidado / getDescargaSimulada.
export function DescargaSimuladaPanel({ productoId }: { productoId: string }) {
  const t = useTranslations("inventario.descarga");
  // Opcionales del kit (para el "regular" vs "full"). incluirOpcionales = ids de las filas opcionales.
  const [opcionalIds, setOpcionalIds] = React.useState<string[] | null>(null);
  const [incluirOpc, setIncluirOpc] = React.useState(true);
  const [gen, setGen] = React.useState(0); // bump para recalcular (botón)
  // Estado atado a la petición por CLAVE: evita setState síncrono en el efecto (solo se setea en el async).
  const [res, setRes] = React.useState<{ key: string; data?: DescargaSimulada; error?: boolean } | null>(null);

  // Los ids de los opcionales (una vez).
  React.useEffect(() => {
    let vivo = true;
    listComponentes(productoId)
      .then((cs) => { if (vivo) setOpcionalIds(cs.filter((c) => c.opcional).map((c) => c.id)); })
      .catch(() => { if (vivo) setOpcionalIds([]); });
    return () => { vivo = false; };
  }, [productoId]);

  const incluir = incluirOpc ? (opcionalIds ?? []) : [];
  const key = `${productoId}|${incluirOpc}|${gen}|${incluir.join(",")}`;
  React.useEffect(() => {
    if (opcionalIds == null) return; // esperar a saber si hay opcionales
    let vivo = true;
    getDescargaSimulada(productoId, 1, incluir)
      .then((d) => { if (vivo) setRes({ key, data: d }); })
      .catch(() => { if (vivo) setRes({ key, error: true }); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productoId, opcionalIds, incluirOpc, gen, key]);

  const listo = !!res && res.key === key;
  const cargando = opcionalIds == null || !listo;
  const error = listo && !!res?.error;
  const data = res?.data ?? null; // conserva el último resultado mientras recalcula
  const correr = () => setGen((g) => g + 1);
  const tieneOpcionales = (opcionalIds?.length ?? 0) > 0;
  const nombrePorId = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const l of data?.lineas ?? []) m.set(l.productoId, l.nombre ?? l.sku ?? l.productoId);
    return m;
  }, [data]);

  return (
    <div className="rounded-xl border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <HugeiconsIcon icon={PackageIcon} className="size-4" />
          {t("titulo")}
        </div>
        <div className="flex items-center gap-3">
          {tieneOpcionales && (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={incluirOpc} onCheckedChange={setIncluirOpc} />
              {t("incluirOpcionales")}
            </label>
          )}
          <Button variant="outline" size="sm" onClick={correr} disabled={cargando}>
            {cargando ? t("calculando") : t("recalcular")}
          </Button>
        </div>
      </div>

      <div className="p-4">
        {cargando && !data && <p className="text-sm text-muted-foreground">{t("calculando")}</p>}
        {error && <p className="text-sm text-destructive">{t("error")}</p>}
        {data && (
          <div className="space-y-4">
            {/* Avisos en ROJO, primero (son el punto). */}
            {data.avisos.length > 0 && (
              <div className="space-y-1.5">
                {data.avisos.map((a, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    <HugeiconsIcon icon={Alert01Icon} className="mt-0.5 size-4 shrink-0" />
                    <span>
                      {a.tipo === "duplicado"
                        ? t("aviso.duplicado", {
                            nombre: (a.productoId && nombrePorId.get(a.productoId)) || t("esteProducto"),
                            veces: a.veces ?? 2,
                          })
                        : a.tipo === "ciclo"
                          ? t("aviso.ciclo")
                          : t("aviso.profundidad")}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Líneas que SÍ descuentan (árbol expandido). */}
            {data.lineas.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("sinLineas")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="py-1.5 pr-3 font-semibold">{t("col.producto")}</th>
                      <th className="px-3 py-1.5 text-right font-semibold">{t("col.cantidad")}</th>
                      <th className="px-3 py-1.5 font-semibold">{t("col.sale")}</th>
                      <th className="px-3 py-1.5 text-right font-semibold">{t("col.costo")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.lineas.map((l, i) => (
                      <LineaRow key={`${l.productoId}-${i}`} linea={l} t={t} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Estimados: se reportan pero NO descuentan → aparte y en gris. */}
            {data.estimados.length > 0 && (
              <div className="rounded-lg border border-dashed bg-muted/20 p-3">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("estimadosTitulo")}</div>
                <ul className="space-y-0.5 text-sm text-muted-foreground">
                  {data.estimados.map((e, i) => (
                    <li key={i}>{e.nombre ?? e.sku ?? "—"}{e.cantidad != null ? ` × ${e.cantidad}` : ""}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function LineaRow({ linea, t }: { linea: DescargaLinea; t: (k: string, v?: Record<string, string | number>) => string }) {
  // Profundidad del anidamiento = largo del camino más corto − 1 (la raíz es 0). Sangría visual.
  const depth = Math.max(0, Math.min(...linea.rutas.map((r) => r.length)) - 1);
  const duplicado = linea.rutas.length > 1;
  return (
    <tr className="align-top">
      <td className="py-1.5 pr-3">
        <div style={{ paddingLeft: depth * 16 }} className="flex flex-wrap items-center gap-x-2">
          {depth > 0 && <span className="text-muted-foreground">└─</span>}
          <span className="font-medium">{linea.nombre ?? linea.sku ?? linea.productoId}</span>
          {linea.nombreTecnico && <span className="text-xs text-muted-foreground">· {linea.nombreTecnico}</span>}
          {duplicado && (
            <span className="rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
              {t("duplicadoBadge", { veces: linea.rutas.length })}
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-1.5 text-right tabular-nums">× {linea.cantidad}</td>
      <td className="px-3 py-1.5"><ModoChip modo={linea.modoDescarga} t={t} /></td>
      <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
        {linea.costoReferencia != null ? money.format(linea.costoReferencia) : "—"}
      </td>
    </tr>
  );
}

function ModoChip({ modo, t }: { modo: DescargaModo; t: (k: string) => string }) {
  const cls =
    modo === "a_la_entrega"
      ? "bg-warning text-warning-foreground"
      : modo === "no_descarga"
        ? "bg-muted text-muted-foreground"
        : "bg-success text-success-foreground";
  return <span className={"rounded-full px-2 py-0.5 text-[11px] font-medium " + cls}>{t(`modo.${modo}`)}</span>;
}
