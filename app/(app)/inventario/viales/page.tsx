"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import {
  getReporteViales,
  listAlmacenes,
  listProductos,
  type Almacen,
  type Producto,
  type ReporteViales,
} from "@/lib/api/inventario";
import { useResource } from "@/hooks/use-resource";
import { useCentroGate } from "@/hooks/use-centro-gate";
import {
  agruparPorDia,
  nivelDelFrasco,
  textoDeCapacidad,
} from "@/lib/inventario/viales";
import { Frasco, PilaDeFrascos } from "@/components/inventario/frasco";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// SEGUIMIENTO DE VIALES. Lo importante no es la tabla: es el DIBUJO. Se ve el frasco abierto medio lleno
// y los cerrados contados, y eso se entiende sin leer. Debajo, cada dosis dice de qué vial salió.
// Sirve para CUALQUIER producto que se dosifique en vial (Tirzepatide, NANO DPM, BPC-157): la lista sale
// del BE, no de una constante. See docs/specs/pantalla-de-viales.md

/** Un producto se dosifica en vial cuando tiene contenido por envase y descarga por dosis. */
function esDeVial(p: Producto): boolean {
  const contenido = Number(p.contenido ?? 0);
  return contenido > 0 && p.esInventariable !== false;
}

export default function VialesPage() {
  const t = useTranslations("inventarioViales");
  const tc = useTranslations("common");
  const gate = useCentroGate();
  const centro = gate.centro || gate.centros[0]?.id || "";
  const tenant = centro || undefined;

  const [productoId, setProductoId] = React.useState("");
  const [almacenId, setAlmacenId] = React.useState("");
  const [desde, setDesde] = React.useState("");
  const [hasta, setHasta] = React.useState("");

  const productosRes = useResource<Producto[]>(
    () => (tenant ? listProductos({}) : Promise.resolve([])),
    [tenant],
  );
  const productos = React.useMemo(
    () =>
      productosRes.state.kind === "ok"
        ? productosRes.state.data.filter(esDeVial)
        : [],
    [productosRes.state],
  );

  const almacenesRes = useResource<Almacen[]>(
    () => (tenant ? listAlmacenes(tenant) : Promise.resolve([])),
    [tenant],
  );
  const almacenes = almacenesRes.state.kind === "ok" ? almacenesRes.state.data : [];

  const reporteRes = useResource<ReporteViales | null>(
    () =>
      productoId
        ? getReporteViales(
            {
              productoId,
              ...(almacenId ? { almacenId } : {}),
              ...(desde ? { desde } : {}),
              ...(hasta ? { hasta } : {}),
            },
            tenant,
          )
        : Promise.resolve(null),
    [productoId, almacenId, desde, hasta, tenant],
  );

  const reporte =
    reporteRes.state.kind === "ok" ? reporteRes.state.data : null;
  const producto = productos.find((p) => p.id === productoId);
  const unidad =
    (producto as { unidadContenidoNombre?: string } | undefined)
      ?.unidadContenidoNombre ?? null;
  const dias = React.useMemo(
    () => agruparPorDia(reporte?.consumos ?? []),
    [reporte],
  );

  return (
    <div className="w-full px-6 py-6">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">{t("titulo")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitulo")}</p>
      </header>

      {/* Filtros: el producto manda; el resto acota. */}
      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border bg-card/40 p-4">
        <div className="min-w-64 flex-1 space-y-1.5">
          <Label htmlFor="v-producto">{t("producto")}</Label>
          <Select value={productoId} onValueChange={setProductoId}>
            <SelectTrigger id="v-producto">
              <SelectValue placeholder={t("productoPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {productos.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-52 space-y-1.5">
          <Label htmlFor="v-almacen">{t("almacen")}</Label>
          <Select
            value={almacenId || "__todos"}
            onValueChange={(v) => setAlmacenId(v === "__todos" ? "" : v)}
          >
            <SelectTrigger id="v-almacen">
              <SelectValue placeholder={t("almacenTodos")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__todos">{t("almacenTodos")}</SelectItem>
              {almacenes.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="v-desde">{t("desde")}</Label>
          <Input
            id="v-desde"
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="v-hasta">{t("hasta")}</Label>
          <Input
            id="v-hasta"
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
          />
        </div>
      </div>

      {!productoId && (
        <p className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
          {t("elijeProducto")}
        </p>
      )}

      {productoId && reporteRes.state.kind === "loading" && (
        <p className="text-sm text-muted-foreground">{tc("loading")}</p>
      )}

      {productoId && reporteRes.state.kind === "fail" && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {reporteRes.state.message}
        </p>
      )}

      {reporte && (
        <>
          {/* INVENTARIO VISUAL: lo que se entiende sin leer. */}
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <section className="rounded-xl border bg-card/60 p-5">
              <h2 className="mb-4 text-sm font-medium">{t("enInventario")}</h2>
              <div className="flex items-center gap-5">
                <PilaDeFrascos cantidad={reporte.cerrados} />
                <div>
                  <p className="font-mono text-3xl font-semibold">
                    {reporte.cerrados}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("vialesDisponibles")}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-xl border bg-card/60 p-5 md:col-span-2">
              <h2 className="mb-4 text-sm font-medium">{t("vialActivo")}</h2>
              {reporte.activo ? (
                <div className="flex items-center gap-6">
                  <Frasco
                    nivel={nivelDelFrasco(reporte.activo)}
                    etiqueta={`${Math.round(reporte.activo.porcentaje)}%`}
                  />
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {t("vialNumero", { n: reporte.activo.numero ?? "—" })}
                    </p>
                    <p className="font-mono text-2xl font-semibold">
                      {textoDeCapacidad(
                        {
                          remanente: reporte.activo.remanente,
                          capacidad: reporte.activo.capacidad,
                        },
                        unidad,
                      )}
                    </p>
                    {reporte.activo.remanente < 0 && (
                      <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-400">
                        {t("remanenteNegativo")}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("sinVialActivo")}</p>
              )}
            </section>
          </div>

          {/* DETALLE: de qué vial salió cada dosis. */}
          <section className="rounded-xl border">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-sm font-medium">{t("consumos")}</h2>
              <span className="text-xs text-muted-foreground">
                {t("nConsumos", { n: reporte.consumos.length })}
              </span>
            </div>
            {dias.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                {t("sinConsumos")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2 font-semibold">{t("col.fecha")}</th>
                      <th className="px-4 py-2 font-semibold">{t("col.paciente")}</th>
                      <th className="px-4 py-2 text-right font-semibold">{t("col.dosis")}</th>
                      <th className="px-4 py-2 text-right font-semibold">{t("col.vial")}</th>
                    </tr>
                  </thead>
                  {dias.map((d) => (
                    <tbody key={d.dia} className="divide-y border-t">
                      <tr className="bg-muted/20">
                        <td className="px-4 py-1.5 text-xs font-medium" colSpan={3}>
                          {d.dia}
                        </td>
                        <td className="px-4 py-1.5 text-right text-xs font-medium">
                          {d.total}
                        </td>
                      </tr>
                      {d.items.map((c, i) => (
                        <tr key={`${c.vialId}-${i}`} className="hover:bg-muted/30">
                          <td className="px-4 py-2 text-muted-foreground">
                            {new Date(c.fecha).toLocaleTimeString(undefined, {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="px-4 py-2">
                            {c.paciente ? (
                              <>
                                {/* Nada aislado: la dosis enlaza a la FICHA del paciente que la consumió
                                    (pacienteId ya viene del reporte). Si no hay id, texto plano. */}
                                {c.pacienteId ? (
                                  <Link
                                    href={`/clientes/${c.pacienteId}`}
                                    className="font-medium text-primary hover:underline"
                                  >
                                    {c.paciente}
                                  </Link>
                                ) : (
                                  <span>{c.paciente}</span>
                                )}
                                {c.record && (
                                  <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                                    {c.record}
                                  </span>
                                )}
                              </>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-2 text-right font-mono">
                            {String(c.cantidad)}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {c.vialNumero != null ? (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                                #{String(c.vialNumero)}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {t("sinNumero")}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  ))}
                </table>
              </div>
            )}
          </section>

          {/* HISTÓRICO: secundario, que no compita con lo que importa. */}
          {reporte.historicos.length > 0 && (
            <details className="mt-4 rounded-xl border px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium">
                {t("historicos", { n: reporte.historicos.length })}
              </summary>
              <ul className="mt-3 flex flex-wrap gap-2">
                {reporte.historicos.map((h) => (
                  <li
                    key={h.id}
                    className="rounded-full border px-3 py-1 text-xs text-muted-foreground"
                  >
                    #{h.numero ?? "—"} · {t(`estado.${h.estado}` as never)}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}
