"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import {
  getFactura,
  getCatalogoFacturacion,
  getFormasPago,
  agregarItem,
  actualizarItem,
  eliminarItem,
  setDescuentoGlobal,
  setExento,
  descartarFactura,
  cambiarPacienteFactura,
  editarCabeceraFactura,
  getItemOpcionales,
  setItemOpcionales,
  type ItemOpcional,
  buscarPaciente,
  emitirFactura,
  type FacturaConItems,
  type FacturaItem,
  type Producto,
  type FormaPago,
  type PacienteBusqueda,
  type EditarCabeceraPayload,
} from "@/lib/api/facturas";
import { listMedicos, listMedios, type MedicoOpcion, type MedioFacturacion } from "@/lib/api/facturacion-config";
import { listTiposPrecio, listImpuestos, listCatalogoPrecios, type TipoPrecio, type Impuesto } from "@/lib/api/precios";
import { listColumnasFacturacion, type ColumnaFacturacion } from "@/lib/api/facturacion-config";
import { useResource } from "@/hooks/use-resource";
import { getPaciente, type Paciente } from "@/lib/api/pacientes";
import { toastError } from "@/lib/api/errors";
import { buildRecibo } from "@/lib/factura/build-recibo";
import { ReciboTermico } from "@/components/facturacion/recibo-termico";
import { PagosFactura } from "@/components/facturacion/pagos-factura";
import { HugeiconsIcon } from "@hugeicons/react";
import { PrinterIcon } from "@hugeicons/core-free-icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const n = (v: unknown) => Number(v ?? 0);
const money = (v: unknown) => `$${n(v).toFixed(2)}`;

export default function FacturacionPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const id = String(params.id);
  const centro = search.get("centro") ?? undefined;
  const [descartando, setDescartando] = React.useState(false);
  const [cambiarOpen, setCambiarOpen] = React.useState(false);
  const [cabeceraOpen, setCabeceraOpen] = React.useState(false);

  const t = useTranslations("facturacion");
  const tRoot = useTranslations();

  const [factura, setFactura] = React.useState<FacturaConItems | null>(null);
  const [paciente, setPaciente] = React.useState<Paciente | null>(null);
  const [catalogo, setCatalogo] = React.useState<Producto[]>([]);
  const [formas, setFormas] = React.useState<FormaPago[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  const refetch = React.useCallback(() => {
    return getFactura(id, centro)
      .then(setFactura)
      .catch((err) => toastError(err, tRoot));
  }, [id, centro, tRoot]);

  React.useEffect(() => {
    let active = true;
    // La factura primero: si es de CONSULTA (tiene citaId) el catálogo se pide con contexto=consulta
    // (solo Consulta/Seguimiento); una factura de venta pide el catálogo completo.
    getFactura(id, centro)
      .then((f) =>
        Promise.all([
          Promise.resolve(f),
          getCatalogoFacturacion(centro, f.citaId ? "consulta" : undefined),
          getFormasPago(centro),
        ]),
      )
      .then(([f, c, fp]) => {
        if (!active) return;
        setFactura(f);
        setCatalogo(c);
        setFormas(fp);
        if (f.pacienteId) {
          getPaciente(String(f.pacienteId), centro).then((p) => active && setPaciente(p)).catch(() => {});
        }
      })
      .catch((err) => toastError(err, tRoot))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id, centro, tRoot]);

  const run = React.useCallback(
    async (fn: () => Promise<unknown>) => {
      setBusy(true);
      try {
        await fn();
        await refetch();
      } catch (err) {
        toastError(err, tRoot);
      } finally {
        setBusy(false);
      }
    },
    [refetch, tRoot],
  );

  async function descartar() {
    if (typeof window !== "undefined" && !window.confirm(t("descartarConfirm"))) return;
    setDescartando(true);
    try {
      await descartarFactura(id, centro);
      router.push(centro ? `/facturacion?centro=${centro}` : "/facturacion");
    } catch (err) {
      toastError(err, tRoot);
      setDescartando(false);
    }
  }

  // Corregir el paciente del borrador SIN descartar (PUT /facturas/:id/paciente). Refresca factura + paciente.
  async function cambiarPaciente(nuevo: PacienteBusqueda) {
    try {
      await cambiarPacienteFactura(id, nuevo.id, centro);
      setCambiarOpen(false);
      await refetch();
      getPaciente(nuevo.id, centro).then((p) => setPaciente(p)).catch(() => {});
    } catch (err) {
      toastError(err, tRoot);
    }
  }

  if (loading) return <p className="mx-auto max-w-7xl px-6 py-16 text-center text-sm text-muted-foreground">{tRoot("common.loading")}</p>;
  if (!factura) return <p className="mx-auto max-w-7xl px-6 py-16 text-center text-sm text-muted-foreground">{t("notFound")}</p>;

  const estado = String(factura.estado ?? "");
  // Tipo por la propia factura: con cita = CONSULTA, sin cita = GENERAL (productos/servicios).
  // El encabezado y el "Volver" deben reflejarlo (no mezclar: una venta general NO dice "Facturar consulta").
  const esGeneral = !factura.citaId;
  const backHref = esGeneral ? "/facturacion" : "/tablero/atencion";
  const nombre = paciente ? [paciente.nombres, paciente.apellidos].filter(Boolean).join(" ") : "";
  const record = paciente?.record ?? "";
  // El recibo se arma 100% de la proyección enriquecida del BE (empresa/pagos/
  // emisor/medico/numeroDisplay/paciente) — sin fallbacks del FE.
  // El precio de cada componente del "Incluye:" viene resuelto en contenido[].precio (BE).
  // Solo mapeamos diasTratamiento del catálogo (kit → "Protocolo de N visitas").
  const diasCatalogo: Record<string, number> = {};
  catalogo.forEach((p) => {
    const dt = (p as { diasTratamiento?: number | null }).diasTratamiento;
    if (dt != null) diasCatalogo[p.id] = dt;
  });
  // Mapa formaPagoId → clave (del catálogo) para traducir las formas de pago en el recibo.
  const clavePorFormaId: Record<string, string> = {};
  formas.forEach((f) => { if (f.clave) clavePorFormaId[f.id] = f.clave; });
  const recibo = buildRecibo(factura, diasCatalogo, clavePorFormaId);

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <Link href={backHref} className="text-sm text-muted-foreground hover:text-foreground">← {t("back")}</Link>

      {/* Cabecera */}
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border bg-gradient-to-br from-primary/10 to-transparent px-5 py-4">
        <div className="min-w-0 flex-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-primary/80">{esGeneral ? t("titleGeneral") : t("title")}</span>
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-semibold tracking-tight">{nombre || t("patient")}</h1>
            {/* Corregir paciente sin descartar (solo borrador de venta general; consulta va ligada a la cita). */}
            {esGeneral && estado === "borrador" && (
              <button
                type="button"
                onClick={() => setCambiarOpen(true)}
                className="no-print shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {t("cambiarPaciente")}
              </button>
            )}
          </div>
          {paciente?.docId && <p className="text-xs text-muted-foreground">ID {paciente.docId}</p>}
        </div>
        <div className="flex items-center gap-2">
          {record && (
            <span className="rounded-lg bg-background/70 px-2.5 py-1 font-mono text-sm font-semibold tabular-nums ring-1 ring-border">#{record}</span>
          )}
          {factura.numero != null && (
            <span className="rounded-md bg-background/70 px-2.5 py-1 font-mono text-sm font-semibold tabular-nums ring-1 ring-border">
              {factura.serie ? `${factura.serie}-` : "F"}{String(factura.numero)}
            </span>
          )}
          <EstadoBadge estado={estado} />
          {esGeneral && estado === "borrador" && (
            <Button variant="outline" size="sm" className="no-print" onClick={() => setCabeceraOpen(true)}>
              {t("editarCabecera")}
            </Button>
          )}
          {esGeneral && estado === "borrador" && (
            <Button variant="outline" size="sm" className="no-print text-destructive hover:text-destructive" disabled={descartando} onClick={descartar}>
              {t("descartar")}
            </Button>
          )}
          <Button variant="outline" size="sm" className="no-print" onClick={() => window.print()}>
            <HugeiconsIcon icon={PrinterIcon} className="size-4" />
            {tRoot("receipt.print")}
          </Button>
        </div>
      </div>

      <CambiarPacienteDialog
        open={cambiarOpen}
        onOpenChange={setCambiarOpen}
        centro={centro}
        actualId={paciente ? String((paciente as { id?: string }).id ?? "") : ""}
        onPick={cambiarPaciente}
      />

      <CabeceraDialog
        key={`cab-${cabeceraOpen}`}
        open={cabeceraOpen}
        onOpenChange={setCabeceraOpen}
        centro={centro}
        factura={factura}
        onSaved={async () => {
          setCabeceraOpen(false);
          await refetch();
        }}
      />

      {/* Editor keyeado por updatedAt → tras guardar, remonta con los valores del servidor. */}
      <Editor
        key={String(factura.updatedAt ?? factura.id)}
        factura={factura}
        id={id}
        centro={centro}
        catalogo={catalogo}
        formas={formas}
        busy={busy}
        run={run}
      />

      {/* Vista previa del recibo térmico 80mm (el print CSS lo aísla al imprimir). */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between no-print">
          <h2 className="text-sm font-semibold text-muted-foreground">{tRoot("receipt.previewTitle")}</h2>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <HugeiconsIcon icon={PrinterIcon} className="size-4" />
            {tRoot("receipt.print")}
          </Button>
        </div>
        <div className="flex justify-center rounded-xl border bg-muted/30 p-6">
          <div className="shadow-lg ring-1 ring-border">
            <ReciboTermico recibo={recibo} />
          </div>
        </div>
      </section>
    </div>
  );
}

function Editor({
  factura,
  id,
  centro,
  catalogo,
  formas,
  busy,
  run,
}: {
  factura: FacturaConItems;
  id: string;
  centro?: string;
  catalogo: Producto[];
  formas: FormaPago[];
  busy: boolean;
  run: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const t = useTranslations("facturacion");
  const serverItems = React.useMemo(() => factura.items ?? [], [factura.items]);
  const estado = String(factura.estado ?? "");
  const esBorrador = estado === "borrador";
  // General = sin cita (productos/servicios). Consulta = con cita (ya funciona perfecto → no se
  // toca). Las features del POS general (IVU por ítem, exento, hook de sesiones) SOLO aplican a
  // general; el editor de consulta queda idéntico a antes. Comparten motor, separadas al facturar.
  const esGeneral = !factura.citaId;

  // Lista de precios de la factura (se fija al crear). El server resuelve cada precio por esta
  // lista (fallback a efectivo). Solo la mostramos; no la recalculamos en el cliente.
  const listasRes = useResource<TipoPrecio[]>(() => listTiposPrecio(), []);
  const listaNombre =
    listasRes.state.kind === "ok"
      ? (listasRes.state.data.find((l) => l.id === (factura as { tipoPrecioId?: string }).tipoPrecioId)?.nombre ?? null)
      : null;
  // IVU activo: el BE calcula el impuesto SOLO si el ítem lleva impuestoId → lo mandamos cuando
  // la línea es gravada (el cajero decide con el toggle IVU). Sin él, gravado no hace nada.
  const impuestosRes = useResource<Impuesto[]>(() => listImpuestos(), []);
  const ivuId =
    impuestosRes.state.kind === "ok"
      ? (impuestosRes.state.data.find((i) => i.esDefault && i.activo)?.id ??
         impuestosRes.state.data.find((i) => i.activo)?.id ?? null)
      : null;

  // Ediciones locales (cantidad/precio) por item → cálculo INSTANTÁNEO al teclear;
  // se persiste al salir del campo. Sembrado del servidor (el padre remonta al guardar).
  type Edit = { cantidad: number; precioUnitario: number };
  const [edits, setEdits] = React.useState<Record<string, Edit>>(() =>
    Object.fromEntries(serverItems.map((it) => [it.id, { cantidad: n(it.cantidad) || 1, precioUnitario: n(it.precioUnitario) }])),
  );

  const lineTotal = (it: FacturaItem) => {
    const e = edits[it.id] ?? { cantidad: n(it.cantidad), precioUnitario: n(it.precioUnitario) };
    return e.cantidad * e.precioUnitario;
  };
  // Totales EN VIVO (cliente): subtotal = Σ líneas; descuento global desde tipo/valor;
  // impuesto del servidor (0 en consulta). total = subtotal − descuento + impuesto.
  const subtotal = serverItems.reduce((s, it) => s + lineTotal(it), 0);
  const dtipo = String(factura.descuentoGlobalTipo ?? "");
  const dval = n(factura.descuentoGlobalValor);
  const descuento = dtipo === "porcentaje" ? (subtotal * dval) / 100 : dtipo === "monto" ? dval : n(factura.descuento);
  const impuesto = n(factura.impuesto);
  // Desglose de impuestos del BE (impuestos[] con nombre/tasa/monto). Data-driven: N renglones,
  // sin hardcodear "11.5%". El total NO se recomputa aquí. Vacío → una sola línea (o exento).
  const impuestosDesglose = ((factura as { impuestos?: { nombre?: string; tasa?: number; monto?: number }[] }).impuestos ?? [])
    .filter((im) => n(im.monto) > 0);
  const total = Math.max(0, subtotal - descuento + impuesto);
  const saldo = total - n(factura.montoAbonado);

  function setEdit(itemId: string, p: Partial<Edit>) {
    setEdits((m) => ({ ...m, [itemId]: { ...(m[itemId] ?? { cantidad: 1, precioUnitario: 0 }), ...p } }));
  }
  function persist(it: FacturaItem) {
    const e = edits[it.id];
    if (!e) return;
    if (e.cantidad !== n(it.cantidad) || e.precioUnitario !== n(it.precioUnitario)) {
      run(() => actualizarItem(id, it.id, { cantidad: e.cantidad, precioUnitario: e.precioUnitario }, centro));
    }
  }
  // Toggle IVU por línea. WORKAROUND: PUT items no acepta `gravado` (UpdateItemDto no lo
  // tiene) → borramos y re-agregamos con el gravado invertido. Ver mini-handoff BE
  // (pos-item-gravado-y-descartar-borrador). Cuando BE lo agregue al PUT, será un PUT directo.
  function toggleGravado(it: FacturaItem) {
    const nuevoGravado = !it.gravado;
    run(async () => {
      await eliminarItem(id, it.id, centro);
      await agregarItem(
        id,
        {
          productoId: it.productoId,
          descripcion: it.descripcion,
          cantidad: n(it.cantidad),
          precioUnitario: n(it.precioUnitario),
          gravado: nuevoGravado,
          // IVU solo si queda gravado (el BE necesita impuestoId para calcularlo).
          ...(nuevoGravado && ivuId ? { impuestoId: ivuId } : {}),
        },
        centro,
      );
    });
  }

  // Hook de doble-descarga (a la ENTREGA): al emitir, si hay ítems modoDescarga=a_la_entrega
  // el POS avisa "N sesiones por entregar" (hoy null hasta cargar láser/suero; sin enlace
  // porque el tablero de frontdesk aún no existe en el FE).
  const sesionesPorEntregar = serverItems
    .filter((it) => String(it.modoDescarga) === "a_la_entrega")
    .reduce((s, it) => s + (n(it.sesiones) || 0), 0);

  // Kits con opcionales: la línea de un producto compuesto ofrece incluir/excluir componentes.
  const prodById = React.useMemo(() => {
    const m = new Map<string, Producto>();
    catalogo.forEach((p) => m.set(p.id, p));
    return m;
  }, [catalogo]);
  const esKit = (it: FacturaItem) => prodById.get(String(it.productoId))?.tipo === "compuesto";
  const [opcItemId, setOpcItemId] = React.useState<string | null>(null);

  // Multiplicadores (láser: áreas×días). Data-driven desde meta.multiplicadores; sin asumir cuáles ni cuántos.
  // Cantidad EFECTIVA = base × Π(multiplicadores). El label de cada clave sale de fac.col.<clave> (i18n).
  const tRootEd = useTranslations();
  const multsDe = (it: FacturaItem): Record<string, number> | null => {
    const m = (it.meta as { multiplicadores?: Record<string, number> } | null | undefined)?.multiplicadores;
    return m && Object.keys(m).length ? m : null;
  };
  const cantEfectiva = (it: FacturaItem): number => {
    const m = multsDe(it);
    const base = n(it.cantidad) || 1;
    return m ? Object.values(m).reduce((p, v) => p * (Number(v) || 1), base) : base;
  };
  const multTexto = (m: Record<string, number>): string =>
    Object.entries(m)
      .map(([k, v]) => `${v} ${tRootEd.has(`fac.col.${k}`) ? tRootEd(`fac.col.${k}`) : k}`)
      .join(" × ");

  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_20rem]">
      {/* Líneas */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">{t("items")}</h2>
          {esGeneral && listaNombre && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              {t("listaLabel", { lista: listaNombre })}
            </span>
          )}
        </div>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-semibold">{t("concept")}</th>
                <th className="w-20 px-3 py-2 text-right font-semibold">{t("qty")}</th>
                <th className="w-28 px-3 py-2 text-right font-semibold">{t("price")}</th>
                {esGeneral && <th className="w-20 px-3 py-2 text-center font-semibold">{t("ivu")}</th>}
                <th className="w-28 px-3 py-2 text-right font-semibold">{t("lineTotal")}</th>
                {esBorrador && <th className="w-10 px-3 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y">
              {serverItems.length === 0 && (
                <tr><td colSpan={4 + (esGeneral ? 1 : 0) + (esBorrador ? 1 : 0)} className="px-3 py-6 text-center text-muted-foreground">{t("noItems")}</td></tr>
              )}
              {serverItems.map((it) => {
                const e = edits[it.id] ?? { cantidad: n(it.cantidad), precioUnitario: n(it.precioUnitario) };
                return (
                  <tr key={it.id}>
                    <td className="px-3 py-2">
                      <span>{it.descripcion ?? "—"}</span>
                      {esBorrador && esKit(it) && (
                        <button
                          type="button"
                          onClick={() => setOpcItemId(it.id)}
                          className="ml-2 rounded-md border px-1.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10"
                        >
                          {t("opcionales")}
                        </button>
                      )}
                      {/* Desglose de multiplicadores (láser: días × áreas) — data-driven */}
                      {multsDe(it) && (
                        <span className="block text-[11px] text-muted-foreground">({multTexto(multsDe(it)!)})</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {/* Cantidad EFECTIVA (base × multiplicadores) read-only cuando hay multiplicadores. */}
                      {multsDe(it) ? (
                        <span className="tabular-nums font-medium" title={t("cantEfectivaHint")}>{cantEfectiva(it)}</span>
                      ) : esBorrador ? (
                        <Input
                          value={String(e.cantidad)}
                          onChange={(ev) => setEdit(it.id, { cantidad: Math.max(1, Math.floor(Number(ev.target.value) || 0)) })}
                          onBlur={() => persist(it)}
                          className="h-7 w-16 text-right tabular-nums" inputMode="numeric" disabled={busy}
                        />
                      ) : <span className="tabular-nums">{n(it.cantidad)}</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {esBorrador ? (
                        <Input
                          value={String(e.precioUnitario)}
                          onChange={(ev) => setEdit(it.id, { precioUnitario: Math.max(0, Number(ev.target.value) || 0) })}
                          onBlur={() => persist(it)}
                          className="h-7 w-24 text-right tabular-nums" inputMode="decimal" disabled={busy}
                        />
                      ) : <span className="tabular-nums">{money(it.precioUnitario)}</span>}
                    </td>
                    {esGeneral && (
                      <td className="px-3 py-2 text-center">
                        {esBorrador ? (
                          <button
                            type="button"
                            onClick={() => toggleGravado(it)}
                            disabled={busy}
                            className={
                              "rounded-full px-2 py-0.5 text-[11px] font-medium disabled:opacity-40 " +
                              (it.gravado
                                ? "bg-sky-500/15 text-sky-600 dark:text-sky-400"
                                : "bg-muted text-muted-foreground")
                            }
                            title={t("ivuToggleHint")}
                          >
                            {it.gravado ? t("ivuGravado") : t("ivuExento")}
                          </button>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">
                            {it.gravado ? t("ivuGravado") : t("ivuExento")}
                          </span>
                        )}
                      </td>
                    )}
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{money(lineTotal(it))}</td>
                    {esBorrador && (
                      <td className="px-3 py-2 text-right">
                        <button type="button" onClick={() => run(() => eliminarItem(id, it.id, centro))} disabled={busy} aria-label={t("remove")} className="text-destructive hover:opacity-70 disabled:opacity-40">×</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {esBorrador && (
          <AddItem
            catalogo={catalogo}
            showIvu={esGeneral}
            ivuId={ivuId}
            tipoPrecioId={(factura as { tipoPrecioId?: string }).tipoPrecioId ?? null}
            tenant={(factura as { clinicId?: string }).clinicId ?? centro ?? null}
            disabled={busy}
            onAdd={(p) => run(() => agregarItem(id, p, centro))}
          />
        )}
      </section>

      {/* Resumen + acciones */}
      <aside className="space-y-4">
        <div className="space-y-2 rounded-xl border p-4">
          <Row label={t("subtotal")} value={money(subtotal)} />
          <Row label={t("discount")} value={`- ${money(descuento)}`} />
          {impuestosDesglose.length > 0
            ? impuestosDesglose.map((im, i) => (
                <Row key={i} label={(im.nombre || t("tax")) + (im.tasa != null ? ` (${im.tasa}%)` : "")} value={money(im.monto)} />
              ))
            : <Row label={t("tax")} value={money(impuesto)} />}
          <div className="border-t pt-2"><Row label={t("total")} value={money(total)} strong /></div>
        </div>

        {esBorrador && (
          <DescuentoGlobal disabled={busy} onApply={(tipo, valor) => run(() => setDescuentoGlobal(id, { tipo, valor } as never, centro))} applyLabel={t("applyDiscount")} />
        )}

        {esBorrador && esGeneral && (
          <label className="flex items-center justify-between rounded-xl border px-4 py-3">
            <span className="text-sm">{t("exentoLabel")}</span>
            <input
              type="checkbox"
              className="size-4"
              checked={!!(factura as { exento?: boolean }).exento}
              disabled={busy}
              onChange={(e) => run(() => setExento(id, { exento: e.target.checked }, centro))}
            />
          </label>
        )}

        {!esBorrador && esGeneral && sesionesPorEntregar > 0 && (
          <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 px-4 py-3 text-sm text-sky-700 dark:text-sky-400">
            {t("sesionesPorEntregar", { n: sesionesPorEntregar })}
          </div>
        )}

        {esBorrador ? (
          <Button className="w-full" disabled={busy || serverItems.length === 0} onClick={() => run(() => emitirFactura(id, centro))}>
            {t("emit")}
          </Button>
        ) : (
          <PagosFactura pagos={factura.pagos ?? []} formas={formas} id={id} centro={centro} busy={busy} run={run} saldo={saldo} montoAbonado={n(factura.montoAbonado)} />
        )}
      </aside>

      {opcItemId && (
        <OpcionalesDialog
          key={opcItemId}
          open={!!opcItemId}
          facturaId={id}
          itemId={opcItemId}
          centro={centro}
          onOpenChange={(o) => !o && setOpcItemId(null)}
          onSaved={() => { setOpcItemId(null); run(() => Promise.resolve()); }}
        />
      )}
    </div>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const tone =
    estado === "borrador" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
    : estado === "anulada" ? "bg-destructive/15 text-destructive"
    : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
  const label = estado ? estado.charAt(0).toUpperCase() + estado.slice(1) : "—";
  return <span className={"rounded-full px-2.5 py-1 text-xs font-semibold " + tone}>{label}</span>;
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={strong ? "text-sm font-semibold" : "text-sm text-muted-foreground"}>{label}</span>
      <span className={"tabular-nums " + (strong ? "text-base font-bold" : "text-sm")}>{value}</span>
    </div>
  );
}

function Lbl({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</span>;
}

// Modal de OPCIONALES de un kit: incluir/excluir componentes por línea. El BE re-precifica (base +
// Σ incluidos) y recomputa totales; el FE solo manda la selección. Sin seedeo por effect: usamos
// un overlay de cambios sobre lo que trae el GET (eff = override ?? incluido).
function OpcionalesDialog({
  open,
  onOpenChange,
  facturaId,
  itemId,
  centro,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  facturaId: string;
  itemId: string;
  centro?: string;
  onSaved: () => void;
}) {
  const t = useTranslations("facturacion");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const res = useResource<ItemOpcional[]>(() => getItemOpcionales(facturaId, itemId, centro), [facturaId, itemId, centro]);
  const opcionales = res.state.kind === "ok" ? res.state.data : [];
  const [ov, setOv] = React.useState<Record<string, boolean>>({});
  const [saving, setSaving] = React.useState(false);
  const eff = (o: ItemOpcional) => ov[o.componenteId] ?? o.incluido;
  const extra = opcionales.filter(eff).reduce((s, o) => s + (o.precioIncremental ?? 0), 0);

  async function guardar() {
    setSaving(true);
    try {
      const incluidos = opcionales.filter(eff).map((o) => o.componenteId);
      await setItemOpcionales(facturaId, itemId, incluidos, centro);
      onSaved();
    } catch (err) {
      toastError(err, tRoot);
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("opcionalesTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {res.state.kind === "loading" && <p className="py-6 text-center text-sm text-muted-foreground">{tc("loading")}</p>}
          {res.state.kind === "ok" && opcionales.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("opcionalesEmpty")}</p>
          )}
          {opcionales.map((o) => (
            <label key={o.componenteId} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                <input type="checkbox" checked={eff(o)} onChange={() => setOv((m) => ({ ...m, [o.componenteId]: !eff(o) }))} />
                <span className="font-medium">{o.nombre}</span>
                {o.cantidad > 1 && <span className="text-xs text-muted-foreground">×{o.cantidad}</span>}
              </span>
              <span className="tabular-nums text-muted-foreground">+{money(o.precioIncremental)}</span>
            </label>
          ))}
        </div>
        {opcionales.length > 0 && (
          <div className="flex items-center justify-between border-t pt-3 text-sm">
            <span className="text-muted-foreground">{t("opcionalesExtra")}</span>
            <span className="font-semibold tabular-nums">+{money(extra)}</span>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>{tc("cancel")}</Button>
          <Button size="sm" onClick={guardar} disabled={saving || res.state.kind !== "ok"}>{tc("save")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Diálogo para CORREGIR el paciente de un borrador sin descartar. Reusa el finder (buscarPaciente,
// nombre/record/doc, debounce ≥2 chars). Al elegir → PUT /facturas/:id/paciente en el padre.
function CambiarPacienteDialog({
  open,
  onOpenChange,
  centro,
  actualId,
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  centro?: string;
  actualId?: string;
  onPick: (p: PacienteBusqueda) => void;
}) {
  const t = useTranslations("facturacion");
  const tRoot = useTranslations();
  const [q, setQ] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  React.useEffect(() => {
    const h = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(h);
  }, [q]);
  const term = debounced.trim();
  const res = useResource<PacienteBusqueda[]>(
    () => (term.length >= 2 ? buscarPaciente(term, centro) : Promise.resolve([])),
    [term, centro],
  );
  const shown = term.length >= 2 && res.state.kind === "ok" ? res.state.data : [];
  const loading = res.state.kind === "loading" && term.length >= 2;
  const nombre = (p: PacienteBusqueda) => `${p.nombres ?? ""} ${p.apellidos ?? ""}`.trim() || t("patient");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("cambiarPacienteTitle")}</DialogTitle>
        </DialogHeader>
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPatientPlaceholder")} />
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {term.length < 2 && <p className="py-6 text-center text-sm text-muted-foreground">{t("searchHint")}</p>}
          {loading && <p className="py-6 text-center text-sm text-muted-foreground">{tRoot("common.loading")}</p>}
          {term.length >= 2 && !loading && shown.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">{tRoot("common.noResults")}</p>
          )}
          {shown.map((p) => {
            const esActual = String(p.id) === String(actualId ?? "");
            return (
              <button
                key={p.id}
                type="button"
                disabled={esActual}
                onClick={() => onPick(p)}
                className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-50"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{nombre(p)}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {p.record ? `#${p.record}` : ""} {p.docId ? `· ID ${p.docId}` : ""}
                  </span>
                </span>
                {esActual && <span className="shrink-0 text-xs text-muted-foreground">{t("pacienteActual")}</span>}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Editar la CABECERA de un borrador sin descartar (médico / referido / tercero) → PUT /facturas/:id/cabecera.
// Reusa los mismos catálogos que el alta (listMedicos/listMedios). El paciente se cambia aparte (tiene buscador).
const NONE = "__none__";
function CabeceraDialog({
  open,
  onOpenChange,
  centro,
  factura,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  centro?: string;
  factura: FacturaConItems;
  onSaved: () => void | Promise<void>;
}) {
  const t = useTranslations("facturacion");
  const tRoot = useTranslations();
  const f = factura as unknown as {
    medicoId?: string | null; medioId?: string | null;
    facturarANombre?: string | null; facturarADocId?: string | null; facturarATipo?: string | null;
  };
  const medicosRes = useResource<MedicoOpcion[]>(() => listMedicos(centro), [centro]);
  const mediosRes = useResource<MedioFacturacion[]>(() => listMedios(centro), [centro]);
  const medicos = medicosRes.state.kind === "ok" ? medicosRes.state.data : [];
  const medios = mediosRes.state.kind === "ok" ? mediosRes.state.data : [];

  // Sembrado con los valores actuales de la factura (el padre remonta por `key` al abrir → initializer fresco).
  const [medicoId, setMedicoId] = React.useState<string>(f.medicoId ?? NONE);
  const [medioId, setMedioId] = React.useState<string>(f.medioId ?? NONE);
  const [terceroNombre, setTerceroNombre] = React.useState(f.facturarANombre ?? "");
  const [terceroDoc, setTerceroDoc] = React.useState(f.facturarADocId ?? "");
  const [terceroTipo, setTerceroTipo] = React.useState<"persona" | "empresa">(f.facturarATipo === "empresa" ? "empresa" : "persona");
  const [saving, setSaving] = React.useState(false);

  async function guardar() {
    setSaving(true);
    const nombre = terceroNombre.trim();
    // ausente = no aplica; aquí somos autoritativos: null = limpiar cuando el campo va vacío.
    const payload: EditarCabeceraPayload = {
      medicoId: medicoId === NONE ? null : medicoId,
      medioId: medioId === NONE ? null : medioId,
      facturarANombre: nombre || null,
      facturarADocId: nombre ? (terceroDoc.trim() || null) : null,
      facturarATipo: nombre ? terceroTipo : null,
    };
    try {
      await editarCabeceraFactura(String(factura.id), payload, centro);
      await onSaved();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("editarCabeceraTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <label className="flex flex-col gap-1">
            <Lbl>{t("medico")}</Lbl>
            <Select value={medicoId} onValueChange={setMedicoId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("sinMedico")}</SelectItem>
                {medicos.map((m) => <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1">
            <Lbl>{t("referido")}</Lbl>
            <Select value={medioId} onValueChange={setMedioId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("sinReferido")}</SelectItem>
                {medios.map((m) => <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>
          <div className="space-y-2 rounded-lg border p-3">
            <Lbl>{t("tercero")}</Lbl>
            <Input value={terceroNombre} onChange={(e) => setTerceroNombre(e.target.value)} placeholder={t("terceroNombre")} />
            {terceroNombre.trim() && (
              <div className="flex gap-2">
                <Input value={terceroDoc} onChange={(e) => setTerceroDoc(e.target.value)} placeholder={t("terceroDoc")} className="flex-1" />
                <Select value={terceroTipo} onValueChange={(v) => setTerceroTipo(v as "persona" | "empresa")}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="persona">{t("terceroPersona")}</SelectItem>
                    <SelectItem value="empresa">{t("terceroEmpresa")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>{tRoot("common.cancel")}</Button>
            <Button size="sm" onClick={guardar} disabled={saving}>{tRoot("common.save")}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddItem({ catalogo, showIvu, ivuId, tipoPrecioId, tenant, disabled, onAdd }: { catalogo: Producto[]; showIvu?: boolean; ivuId?: string | null; tipoPrecioId?: string | null; tenant?: string | null; disabled?: boolean; onAdd: (p: { productoId: string; descripcion: string; cantidad: number; precioUnitario?: number; gravado?: boolean; impuestoId?: string; meta?: Record<string, number> }) => void }) {
  const t = useTranslations("facturacion");
  const tRoot = useTranslations();
  const [prodId, setProdId] = React.useState("");
  const [cant, setCant] = React.useState("1");
  const [precio, setPrecio] = React.useState(""); // override manual (vacío = precio de la lista de la factura)
  const [gravadoOverride, setGravadoOverride] = React.useState<boolean | null>(null); // null = default del producto
  const [metaVals, setMetaVals] = React.useState<Record<string, string>>({}); // valores de columnas multiplicador/informativo
  const prod = catalogo.find((p) => p.id === prodId);

  // IVU (§2): el default nace del producto (gravado), NO fijo en ON. El cajero puede sobreescribir.
  const gravadoEff = gravadoOverride ?? !!(prod as { gravado?: boolean } | undefined)?.gravado;

  // Columnas dinámicas por producto: días/áreas/sesiones/dosis. multiplicador→total, informativo→muestra.
  const colsRes = useResource<ColumnaFacturacion[]>(
    () => (prodId ? listColumnasFacturacion(prodId, tenant ?? undefined) : Promise.resolve([])),
    [prodId, tenant],
  );
  const capturables = (colsRes.state.kind === "ok" ? colsRes.state.data : []).filter(
    (c) => c.rol === "multiplicador" || c.rol === "informativo",
  );

  // Autocálculo Dosis→Cantidad (potes/frascos): al cambiar la Dosis, Cantidad = ceil(dosis×días/unidadesPorEnvase).
  // unidadesPorEnvase (de NTPRODUCTOS.CapsulasXUni) y diasTratamiento vienen del catálogo (BE, en prod);
  // si faltan → cantidad manual, sin autocálculo.
  const capsUnit = prod?.unidadesPorEnvase ?? null;
  const diasTrat = prod?.diasTratamiento ?? 30; // fallback si el producto no tiene el dato
  const dosisClave = capturables.find((c) => /dosis/i.test(c.clave))?.clave ?? null;
  const sugeridoClave = capturables.find((c) => /sugerid/i.test(c.clave))?.clave ?? null;

  function onMetaChange(clave: string, value: string) {
    const dosis = Number(value);
    const sugerida =
      clave === dosisClave && capsUnit && capsUnit > 0 && diasTrat > 0 && dosis > 0
        ? Math.ceil((dosis * diasTrat) / capsUnit)
        : null;
    setMetaVals((m) => {
      const next = { ...m, [clave]: value };
      if (sugerida != null && sugeridoClave) next[sugeridoClave] = String(sugerida);
      return next;
    });
    if (sugerida != null) setCant(String(sugerida)); // pre-llena Cantidad, queda editable
  }

  // PREVIEW DEL PRECIO (por lista de la factura, centro de la factura; fallback efectivo).
  const precioRes = useResource<number | null>(
    () => {
      const p = catalogo.find((x) => x.id === prodId);
      if (!p) return Promise.resolve(null);
      const q = p.sku ?? p.nombre;
      const opts = tipoPrecioId ? { tipoPrecioId, q, limit: 50 } : { q, limit: 50 };
      return listCatalogoPrecios(opts, tenant ?? undefined).then(async (res) => {
        let row = res.items.find((r) => r.productoId === p.id) ?? null;
        if (!row || row.precio == null) {
          const eff = await listCatalogoPrecios({ q, limit: 50 }, tenant ?? undefined);
          row = eff.items.find((r) => r.productoId === p.id) ?? row;
        }
        return row?.precio ?? null;
      });
    },
    [prodId, tipoPrecioId, tenant],
  );
  const buscando = precioRes.state.kind === "loading" && !!prodId;
  const precioLista = precioRes.state.kind === "ok" ? precioRes.state.data : null;
  const precioMostrado = precio !== "" ? precio : precioLista != null ? String(precioLista) : "";
  const canAdd = !!prodId && !disabled && !buscando;

  function pick(v: string) {
    setProdId(v);
    setGravadoOverride(null); // vuelve al default del nuevo producto
    setMetaVals({});
    setPrecio("");
  }

  function add() {
    if (!prod) return;
    const g = showIvu ? gravadoEff : !!(prod as { gravado?: boolean }).gravado;
    const precioOverride = precio.trim() === "" ? undefined : Math.max(0, Number(precio) || 0);
    // meta = valores de las columnas multiplicador/informativo (por su clave). El server calcula el total.
    const meta: Record<string, number> = {};
    capturables.forEach((c) => {
      const raw = metaVals[c.clave];
      if (raw != null && raw.trim() !== "" && !Number.isNaN(Number(raw))) meta[c.clave] = Number(raw);
    });
    onAdd({
      productoId: prod.id,
      descripcion: prod.nombre,
      cantidad: Math.max(1, Math.floor(Number(cant) || 1)),
      ...(precioOverride !== undefined ? { precioUnitario: precioOverride } : {}),
      gravado: g,
      ...(g && ivuId ? { impuestoId: ivuId } : {}),
      ...(Object.keys(meta).length ? { meta } : {}),
    });
    setProdId(""); setCant("1"); setPrecio(""); setGravadoOverride(null); setMetaVals({});
  }

  return (
    <div className="grid grid-cols-2 items-end gap-3 rounded-xl border border-dashed p-3 md:flex md:flex-wrap">
      <label className="col-span-2 flex min-w-0 flex-1 flex-col gap-1">
        <Lbl>{t("addItem")}</Lbl>
        <Select value={prodId} onValueChange={pick}>
          <SelectTrigger className="w-full"><SelectValue placeholder={t("selectProduct")} /></SelectTrigger>
          <SelectContent>{catalogo.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
        </Select>
      </label>
      <label className="flex w-20 flex-col gap-1">
        <Lbl>{t("qty")}</Lbl>
        <Input value={cant} onChange={(e) => setCant(e.target.value)} className="h-9 text-right tabular-nums" inputMode="numeric" />
      </label>
      {/* Columnas dinámicas del producto (días/áreas/sesiones/dosis) */}
      {capturables.map((c) => (
        <label key={c.clave} className="flex w-24 flex-col gap-1">
          <Lbl>{tRoot(c.labelKey)}</Lbl>
          <Input
            value={metaVals[c.clave] ?? ""}
            onChange={(e) => onMetaChange(c.clave, e.target.value)}
            readOnly={c.clave === sugeridoClave}
            className={"h-9 text-right tabular-nums " + (c.rol === "informativo" ? "opacity-80 " : "") + (c.clave === sugeridoClave ? "bg-muted" : "")}
            inputMode="decimal"
            placeholder={c.rol === "multiplicador" ? "×" : ""}
          />
        </label>
      ))}
      <label className="flex w-28 flex-col gap-1">
        <Lbl>{t("price")}</Lbl>
        <Input value={precioMostrado} onChange={(e) => setPrecio(e.target.value)} placeholder={buscando ? "…" : t("priceAuto")} title={t("priceAutoHint")} className="h-9 text-right tabular-nums" inputMode="decimal" />
      </label>
      {showIvu && (
        <label className="flex flex-col gap-1">
          <Lbl>{t("ivu")}</Lbl>
          <button
            type="button"
            onClick={() => setGravadoOverride(!gravadoEff)}
            className={"h-9 rounded-md border px-3 text-[11px] font-medium " + (gravadoEff ? "bg-sky-500/15 text-sky-600 dark:text-sky-400" : "text-muted-foreground")}
            title={t("ivuToggleHint")}
          >
            {gravadoEff ? t("ivuGravado") : t("ivuExento")}
          </button>
        </label>
      )}
      <Button type="button" size="sm" className="col-span-2 h-9 md:col-span-1" disabled={!canAdd} onClick={add}>
        {t("add")}
      </Button>
    </div>
  );
}

function DescuentoGlobal({ disabled, onApply, applyLabel }: { disabled?: boolean; onApply: (tipo: string, valor: number) => void; applyLabel: string }) {
  const t = useTranslations("facturacion");
  const [tipo, setTipo] = React.useState("porcentaje");
  const [valor, setValor] = React.useState("");
  return (
    <div className="space-y-2 rounded-xl border p-4">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("globalDiscount")}</span>
      <div className="flex items-center gap-2">
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="porcentaje">%</SelectItem>
            <SelectItem value="monto">$</SelectItem>
          </SelectContent>
        </Select>
        <Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0" className="h-9 flex-1 text-right tabular-nums" inputMode="decimal" />
        <Button type="button" variant="outline" size="sm" disabled={disabled || valor === ""} onClick={() => onApply(tipo, Math.max(0, Number(valor) || 0))}>{applyLabel}</Button>
      </div>
    </div>
  );
}

