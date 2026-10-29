"use client";

import * as React from "react";
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
  setEnvio,
  setExento,
  descartarFactura,
  cambiarPacienteFactura,
  editarCabeceraFactura,
  getItemOpcionales,
  setItemOpcionales,
  personalizarKit,
  type ItemOpcional,
  buscarPaciente,
  imprimirFactura,
  type FacturaConItems,
  type FacturaItem,
  type Producto,
  type FormaPago,
  type PacienteBusqueda,
  type EditarCabeceraPayload,
} from "@/lib/api/facturas";
import { listComponentes, listProductos, type ProductoComponente, type Producto as ProductoInv } from "@/lib/api/inventario";
import { ProductoPicker } from "@/components/inventario/producto-picker";
import { listTiposPrecio, listImpuestos, type TipoPrecio, type Impuesto } from "@/lib/api/precios";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { getPaciente, type Paciente } from "@/lib/api/pacientes";
import { getProfiles, type Perfil } from "@/lib/api/profiles";
import { PatientTodaySummaryButton } from "@/components/facturacion/resumen-paciente-panel";
import { toastError } from "@/lib/api/errors";
import { buildRecibo } from "@/lib/factura/build-recibo";
import { ReceiptPrintDialog } from "@/components/facturacion/receipt-print-dialog";
import { ShellCrumb } from "@/components/shell-crumb";
import { InvoiceHeaderDialog as CabeceraDialog } from "@/components/facturacion/invoice-header-dialog";
import { RegenerarDisponibilidadDialog } from "@/components/facturacion/regenerar-disponibilidad-dialog";
import { ReopenInvoiceButton, InvoiceReopenings } from "@/components/facturacion/invoice-reopen";
import { IssueButton } from "@/components/facturacion/issue-button";
import { AddItem } from "@/components/facturacion/invoice-add-item";
import { Lbl } from "@/components/facturacion/field-label";
import { AddSalesPackage, PackageEvidence, PackageSavingsRow } from "@/components/facturacion/sales-package-parts";
import { sellSalesPackage } from "@/lib/api/sales-packages";
import { isPackageLine } from "@/lib/factura/sales-package";
import { buildReceiptText } from "@/lib/print/receipt-labels";
import { RECEIPT_LOGO_MAX_HEIGHT_MM, receiptToEscPos } from "@/lib/print/receipt-escpos";
import { loadLogoRaster } from "@/lib/print/load-logo";
import { ReciboTermico } from "@/components/facturacion/recibo-termico";
import { EDITOR_GRID, INVOICE_PAGE_FILL, CardSection, ReceiptPreviewCard } from "@/components/facturacion/receipt-preview-card";
import { PagosFactura } from "@/components/facturacion/pagos-factura";
import { HugeiconsIcon } from "@hugeicons/react";
import { PrinterIcon, MoreHorizontalIcon, Cancel01Icon } from "@hugeicons/core-free-icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Card, CardHeader, CardTitle, CardAction, CardContent, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DataTable, TableEmpty } from "@/components/ui/data-table";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ControlSkeleton } from "@/components/kit/skeletons";
import { InvoiceDetailSkeleton, DialogRowsSkeleton } from "@/components/facturacion/invoice-detail-skeleton";

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
  const [regenOpen, setRegenOpen] = React.useState(false);
  const [usuarioOpen, setUsuarioOpen] = React.useState(false);
  // Nº de presupuesto que asigna el BE al imprimir un borrador con saldo (se reusa al reimprimir).
  const [presupuestoNum, setPresupuestoNum] = React.useState<string | null>(null);
  const { can } = useCan();

  const t = useTranslations("facturacion");
  const tRoot = useTranslations();
  const tReceipt = useTranslations("receipt");

  const [factura, setFactura] = React.useState<FacturaConItems | null>(null);
  const [paciente, setPaciente] = React.useState<Paciente | null>(null);
  const [catalogo, setCatalogo] = React.useState<Producto[]>([]);
  const [formas, setFormas] = React.useState<FormaPago[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  // Receipt viewer + print, in a modal so the user never leaves billing: see ReceiptPrintDialog.
  const [reciboOpen, setReciboOpen] = React.useState(false);
  const invoiceCenter = centro ?? (factura as { clinicId?: string } | null)?.clinicId ?? undefined;

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
          getCatalogoFacturacion(centro, f.appointmentId ? "consulta" : undefined),
          getFormasPago(centro),
        ]),
      )
      .then(([f, c, fp]) => {
        if (!active) return;
        setFactura(f);
        setCatalogo(c);
        setFormas(fp);
        if (f.patientId) {
          getPaciente(String(f.patientId), centro).then((p) => active && setPaciente(p)).catch(() => {});
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
      router.push(centro ? `/billing/invoices?centro=${centro}` : "/billing/invoices");
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

  // Imprimir PASA POR EL SERVIDOR: un borrador saldado se emite (número/fecha definitivos, entra al
  // cuadre) antes de imprimir; uno sin cobrar imprime igual pero avisa que no quedó emitido. Refrescamos
  // la factura con lo que devuelve el BE y, tras pintar el recibo definitivo, mandamos a imprimir.
  // Handoff HANDOFF-vitales-en-atencion-e-imprimir-emite.
  // Abre el VISOR del recibo en un modal (no se sale de facturación): el iframe es solo para VER.
  function imprimir() {
    setReciboOpen(true);
  }

  // ESC/POS bytes of this receipt for the backup print button (it marks the invoice printed first,
  // like the normal path). Which hub/printer and whether they are up is the button's business.
  async function buildBackupReceiptBytes(): Promise<Uint8Array> {
    const r = await imprimirFactura(id, centro);
    setFactura(r.invoice);
    const reciboFinal = buildRecibo(r.invoice, diasCatalogo, clavePorFormaId, r.quoteNumber ?? presupuestoNum);
    const logo = await loadLogoRaster(reciboFinal.logoUrl ?? "/img/logo_cmr.png", RECEIPT_LOGO_MAX_HEIGHT_MM);
    return receiptToEscPos(reciboFinal, buildReceiptText(tReceipt, tRoot), logo);
  }

  if (loading) return <InvoiceDetailSkeleton />;
  if (!factura) return <PageContainer><p className="py-16 text-center text-sm text-muted-foreground">{t("notFound")}</p></PageContainer>;

  const estado = String(factura.status ?? "");
  // Tipo por la propia factura: con cita = CONSULTA, sin cita = GENERAL (productos/servicios).
  // El encabezado y el "Volver" deben reflejarlo (no mezclar: una venta general NO dice "Facturar consulta").
  const esGeneral = !factura.appointmentId;
  const nombre = paciente ? (paciente.displayName || [paciente.firstName, paciente.lastName].filter(Boolean).join(" ")) : "";
  const record = paciente?.medicalRecordNumber ?? "";
  // El recibo se arma 100% de la proyección enriquecida del BE (empresa/pagos/
  // emisor/medico/numeroDisplay/paciente) — sin fallbacks del FE.
  // El precio de cada componente del "Incluye:" viene resuelto en contenido[].precio (BE).
  // Solo mapeamos diasTratamiento del catálogo (kit → "Protocolo de N visitas").
  const diasCatalogo: Record<string, number> = {};
  catalogo.forEach((p) => {
    const dt = (p as { treatmentDays?: number | null }).treatmentDays;
    if (dt != null) diasCatalogo[p.id] = dt;
  });
  // Mapa formaPagoId → clave (del catálogo) para traducir las formas de pago en el recibo.
  const clavePorFormaId: Record<string, string> = {};
  formas.forEach((f) => { if (f.slug) clavePorFormaId[f.id] = f.slug; });
  const recibo = buildRecibo(factura, diasCatalogo, clavePorFormaId, presupuestoNum);
  // Un borrador con saldo pendiente es un PRESUPUESTO (no se emite al imprimir). Rige el rótulo del botón.
  const esPresupuesto = estado === "borrador" && n(factura.total) - n(factura.paidAmount) > 0.005;
  const numeroFactura = factura.number != null ? `${factura.series ? `${factura.series}-` : "F"}${factura.number}` : null;

  return (
    <PageContainer className={INVOICE_PAGE_FILL}>
      {/* Top bar: "Facturación general › Nueva venta" while it is a draft being made, "› Factura F-123" after. */}
      <ShellCrumb label={estado === "borrador" ? tRoot("facturacionList.nuevaVenta") : [tReceipt("invoice"), numeroFactura].filter(Boolean).join(" ")} />

      {/* Cabecera */}
      <PageHeader
        title={nombre || t("patient")}
        description={
          <>
            {paciente?.documentId && <p className="text-xs text-muted-foreground">ID {paciente.documentId}</p>}
            {/* Usuario responsable (de él salen las estadísticas de quién vende). Corregible con permiso;
                el BE decide si escribe en creadoPor (borrador) o quién cobró (emitida). Handoff usuario-de-la-factura. */}
            <UsuarioResponsable
              factura={factura}
              puedeEditar={can("factura.update")}
              onCorregir={() => setUsuarioOpen(true)}
              label={t("atendidoPor")}
              integracionLabel={t("integracion")}
              sinUsuarioLabel={t("sinUsuario")}
              corregirLabel={t("corregirUsuario")}
            />
          </>
        }
        actions={
          <>
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
            {record && (
              <span className="rounded-lg bg-background/70 px-2.5 py-1 font-mono text-sm font-semibold tabular-nums ring-1 ring-border">#{record}</span>
            )}
            {numeroFactura && <span className="rounded-md bg-background/70 px-2.5 py-1 font-mono text-sm font-semibold tabular-nums ring-1 ring-border">{numeroFactura}</span>}
            <EstadoBadge estado={estado} />
            {/* Nº de presupuesto (tras imprimir un borrador con saldo): el mostrador lo cita por teléfono. */}
            {presupuestoNum && (
              <Badge variant="warning" className="font-mono tabular-nums">
                {t("presupuestoNum", { num: presupuestoNum })}
              </Badge>
            )}
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
            {/* «Lo que suma el paciente hoy» (all of the patient's invoices today, summed by the BE) in a side
                sheet. Needs a center: the URL's, else the invoice's own (admin/master without one → 400). */}
            {factura.patientId && (
              <PatientTodaySummaryButton pacienteId={String(factura.patientId)} facturaActualId={id} centro={centro ?? (factura as { clinicId?: string }).clinicId ?? undefined} />
            )}
            <Button variant="outline" size="sm" className="no-print" onClick={imprimir}>
              <HugeiconsIcon icon={PrinterIcon} className="size-4" />
              {esPresupuesto ? t("imprimirPresupuesto") : tRoot("receipt.print")}
            </Button>
            {/* Reopen to correct (back to draft, same number): the BE says whether it can. */}
            {estado === "emitida" && can("factura.reopen") && <ReopenInvoiceButton invoiceId={id} centerId={invoiceCenter} onReopened={() => refetch()} />}
            {/* Acciones avanzadas (peligrosas), escondidas en "…". Regenerar disponibilidad solo en facturas
                EMITIDAS y con permiso factura.reparar (admin/gerente): no se enseña una puerta que no se abre. */}
            {estado === "emitida" && can("factura.reparar") && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="no-print size-9" aria-label={t("acciones")}>
                    <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setRegenOpen(true); }}>
                    {t("regen.accion")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        }
      />

      <ReceiptPrintDialog
        open={reciboOpen}
        onOpenChange={setReciboOpen}
        invoiceId={id}
        centerId={invoiceCenter}
        printLabel={esPresupuesto ? t("imprimirPresupuesto") : tRoot("receipt.print")}
        buildBackupBytes={buildBackupReceiptBytes}
      />

      <RegenerarDisponibilidadDialog
        open={regenOpen}
        onOpenChange={setRegenOpen}
        facturaId={id}
        centro={centro}
        onDone={refetch}
      />

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

      <UsuarioDialog
        key={`usr-${usuarioOpen}`}
        open={usuarioOpen}
        onOpenChange={setUsuarioOpen}
        centro={centro}
        factura={factura}
        onSaved={async () => {
          setUsuarioOpen(false);
          await refetch();
        }}
      />

      {/* Editor keyeado por updatedAt → tras guardar, remonta con los valores del servidor. */}
      <Editor
        key={String(factura.updatedAt ?? factura.id)}
        factura={factura} id={id} centro={centro} catalogo={catalogo} formas={formas} busy={busy} run={run}
        receipt={
          // Thermal receipt preview (print CSS isolates it when printing).
          <ReceiptPreviewCard>
            <ReciboTermico recibo={recibo} />
          </ReceiptPreviewCard>
        }
      />

      <InvoiceReopenings invoiceId={id} centerId={invoiceCenter} invoice={factura} />
    </PageContainer>
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
  receipt,
}: {
  factura: FacturaConItems;
  id: string;
  centro?: string;
  catalogo: Producto[];
  formas: FormaPago[];
  busy: boolean;
  run: (fn: () => Promise<unknown>) => Promise<void>;
  receipt: React.ReactNode;
}) {
  const t = useTranslations("facturacion");
  const { can } = useCan();
  const puedeUpdate = can("factura.update");
  const serverItems = React.useMemo(() => factura.items ?? [], [factura.items]);
  const estado = String(factura.status ?? "");
  const esBorrador = estado === "borrador";
  // General = sin cita (productos/servicios). Consulta = con cita (ya funciona perfecto → no se
  // toca). Las features del POS general (IVU por ítem, exento, hook de sesiones) SOLO aplican a
  // general; el editor de consulta queda idéntico a antes. Comparten motor, separadas al facturar.
  const esGeneral = !factura.appointmentId;

  // Lista de precios de la factura (se fija al crear). El server resuelve cada precio por esta
  // lista (fallback a efectivo). Solo la mostramos; no la recalculamos en el cliente.
  const listasRes = useResource<TipoPrecio[]>(() => listTiposPrecio(), []);
  const listaNombre =
    listasRes.state.kind === "ok"
      ? (listasRes.state.data.find((l) => l.id === (factura as { priceTypeId?: string }).priceTypeId)?.name ?? null)
      : null;
  // Impuestos APLICABLES: solo los que NO son componentes de desglose (parentId null) y están activos.
  // NO hay "impuesto por defecto" (regla del dueño): el FE NO autoselecciona ni manda impuestoId al crear
  // una línea — el servidor resuelve el impuesto correcto por la cascada precio→presentación→producto (y
  // así no se pierde el Municipal). Estos aplicables solo pueblan el selector de CORRECCIÓN de una línea.
  // Handoff HANDOFF-ivu-compuesto-y-corregir-impuesto-de-linea.
  const impuestosRes = useResource<Impuesto[]>(() => listImpuestos(), []);
  const impuestosAplicables = React.useMemo(
    () => (impuestosRes.state.kind === "ok" ? impuestosRes.state.data.filter((i) => !i.parentId && i.active) : []),
    [impuestosRes.state],
  );

  // Ediciones locales (cantidad/precio) por item → cálculo INSTANTÁNEO al teclear;
  // se persiste al salir del campo. Sembrado del servidor (el padre remonta al guardar).
  type Edit = { quantity: number; unitPrice: number };
  const [edits, setEdits] = React.useState<Record<string, Edit>>(() =>
    Object.fromEntries(serverItems.map((it) => [it.id, { quantity: n(it.quantity) || 1, unitPrice: n(it.unitPrice) }])),
  );

  // Importe de LÍNEA = el del BE (`item.total`, ya incluye la cantidad EFECTIVA × precio con sus
  // multiplicadores). Regla dura: el recibo/detalle NUNCA recalcula; lo mostrado === lo cobrado.
  // Solo durante una edición ACTIVA en borrador mostramos un preview que respeta el multiplicador
  // (efectiva/base) para que "24 × 70" lea coherente; al salir del campo el BE recomputa el total real.
  const lineTotal = (it: FacturaItem) => {
    const e = edits[it.id];
    const editing = e && (e.quantity !== n(it.quantity) || e.unitPrice !== n(it.unitPrice));
    if (!editing) return n(it.total);
    const base = n(it.quantity) || 1;
    const mult = base ? cantEfectiva(it) / base : 1;
    return e.quantity * mult * e.unitPrice;
  };
  // Totales de CABECERA = los del BE (subtotal/descuento/impuesto/total). No se recalculan en el cliente.
  const subtotal = n(factura.subtotal) || serverItems.reduce((s, it) => s + n(it.total), 0);
  const descuento = n(factura.discount);
  const impuesto = n(factura.tax);
  // Desglose de impuestos del BE (impuestos[] con nombre/tasa/monto). Data-driven: N renglones,
  // sin hardcodear "11.5%". El total NO se recomputa aquí. Vacío → una sola línea (o exento).
  // IVU en dos renglones (Estatal 10.5% + Municipal 1%) tal cual los proyecta el BE. NO se filtra por
  // monto>0: un municipal en 0,00 de una línea gravada debe verse (su ausencia se lee como error).
  // Exento → lista vacía (no ceros). Handoff HANDOFF-ivu-estatal-y-municipal.
  const impuestosDesglose = (factura as { taxes?: { name?: string; rate?: number; amount?: number }[] }).taxes ?? [];
  const total = n(factura.total) || Math.max(0, subtotal - descuento + impuesto);
  const saldo = total - n(factura.paidAmount);

  function setEdit(itemId: string, p: Partial<Edit>) {
    setEdits((m) => ({ ...m, [itemId]: { ...(m[itemId] ?? { quantity: 1, unitPrice: 0 }), ...p } }));
  }
  function persist(it: FacturaItem) {
    const e = edits[it.id];
    if (!e) return;
    if (e.quantity !== n(it.quantity) || e.unitPrice !== n(it.unitPrice)) {
      run(() => actualizarItem(id, it.id, { quantity: e.quantity, unitPrice: e.unitPrice }, centro));
    }
  }
  // Toggle IVU por línea. WORKAROUND: PUT items no acepta `gravado` (UpdateItemDto no lo
  // tiene) → borramos y re-agregamos con el gravado invertido. Ver mini-handoff BE
  // (pos-item-gravado-y-descartar-borrador). Cuando BE lo agregue al PUT, será un PUT directo.
  // NO se manda impuestoId: al quedar gravada, el servidor resuelve el impuesto correcto por la cascada
  // del precio (así no se pierde el Municipal). Handoff HANDOFF-ivu-compuesto-y-corregir-impuesto-de-linea.
  function toggleGravado(it: FacturaItem) {
    const nuevoGravado = !it.taxable;
    run(async () => {
      await eliminarItem(id, it.id, centro);
      await agregarItem(
        id,
        {
          productId: it.productId,
          description: it.description,
          quantity: n(it.quantity),
          unitPrice: n(it.unitPrice),
          taxable: nuevoGravado,
        },
        centro,
      );
    });
  }

  // Hook de doble-descarga (a la ENTREGA): al emitir, si hay ítems modoDescarga=a_la_entrega
  // el POS avisa "N sesiones por entregar" (hoy null hasta cargar láser/suero; sin enlace
  // porque el tablero de frontdesk aún no existe en el FE).
  const sesionesPorEntregar = serverItems
    .filter((it) => String(it.deductionMode) === "a_la_entrega")
    .reduce((s, it) => s + (n(it.sessions) || 0), 0);

  // Kits con opcionales: la línea de un producto compuesto ofrece incluir/excluir componentes.
  const prodById = React.useMemo(() => {
    const m = new Map<string, Producto>();
    catalogo.forEach((p) => m.set(p.id, p));
    return m;
  }, [catalogo]);
  const esKit = (it: FacturaItem) => prodById.get(String(it.productId))?.type === "compuesto";
  const [opcItemId, setOpcItemId] = React.useState<string | null>(null);
  // Personalizar el kit de una línea (quitar/cambiar cantidad/agregar componentes) → lo que entra a frontdesk.
  const [kitItem, setKitItem] = React.useState<FacturaItem | null>(null);
  // Corregir el impuesto de una línea (incluso emitida): abre el diálogo de corrección.
  const [impuestoItem, setImpuestoItem] = React.useState<FacturaItem | null>(null);
  // Impuestos de UNA línea, discriminados (Estatal/Municipal…), tal cual los proyecta el BE.
  const impuestosDeLinea = (it: FacturaItem) =>
    (it as { taxes?: { slug?: string; name?: string; rate?: number; amount?: number }[] }).taxes ?? [];

  // Multiplicadores (láser: áreas×días). Data-driven desde meta.multiplicadores; sin asumir cuáles ni cuántos.
  // Cantidad EFECTIVA = base × Π(multiplicadores). El label de cada clave sale de fac.col.<clave> (i18n).
  const tRootEd = useTranslations();
  const multsDe = (it: FacturaItem): Record<string, number> | null => {
    const m = (it.meta as { multiplicadores?: Record<string, number> } | null | undefined)?.multiplicadores;
    return m && Object.keys(m).length ? m : null;
  };
  const cantEfectiva = (it: FacturaItem): number => {
    const m = multsDe(it);
    const base = n(it.quantity) || 1;
    return m ? Object.values(m).reduce((p, v) => p * (Number(v) || 1), base) : base;
  };
  const multTexto = (m: Record<string, number>): string =>
    Object.entries(m)
      .map(([k, v]) => `${v} ${tRootEd.has(`fac.col.${k}`) ? tRootEd(`fac.col.${k}`) : k}`)
      .join(" × ");

  return (
    <div className={EDITOR_GRID}>
      {/* Lines: one card — the add-line row sits above the table, "add package" in the header. */}
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {t("items")}
            {esGeneral && listaNombre && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                {t("listaLabel", { lista: listaNombre })}
              </span>
            )}
          </CardTitle>
          {esBorrador && esGeneral && <CardAction><AddSalesPackage centro={centro} disabled={busy} onPick={(pkg) => run(() => sellSalesPackage(id, pkg.id, centro))} /></CardAction>}
        </CardHeader>
        <CardContent className="flex-1 space-y-4">
          {esBorrador && (
            <AddItem
              catalogo={catalogo}
              showIvu={esGeneral}
              tipoPrecioId={(factura as { priceTypeId?: string }).priceTypeId ?? null}
              tenant={(factura as { clinicId?: string }).clinicId ?? centro ?? null}
              disabled={busy}
              onAdd={(p) => run(() => agregarItem(id, p, centro))}
            />
          )}
          <DataTable>
            <TableHeader>
              <TableRow>
                <TableHead>{t("concept")}</TableHead>
                <TableHead className="w-20 text-right">{t("qty")}</TableHead>
                <TableHead className="w-28 text-right">{t("price")}</TableHead>
                {esGeneral && <TableHead className="w-20 text-center">{t("ivu")}</TableHead>}
                <TableHead className="w-28 text-right">{t("lineTotal")}</TableHead>
                {esBorrador && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {serverItems.length === 0 && (
                <TableEmpty colSpan={4 + (esGeneral ? 1 : 0) + (esBorrador ? 1 : 0)}>{t("noItems")}</TableEmpty>
              )}
              {serverItems.map((it) => {
                const e = edits[it.id] ?? { quantity: n(it.quantity), unitPrice: n(it.unitPrice) };
                return ( // border-l-* nunca compiló aquí (0 reglas en el CSS cargado): inline style
                  <TableRow key={it.id} className="bg-primary/10" style={{ borderLeft: "3px solid var(--primary)" }}>
                    <TableCell>
                      <span>{it.description ?? "—"}</span>
                      <PackageEvidence item={it} locked={esBorrador} />
                      {esBorrador && esKit(it) && (
                        <button
                          type="button"
                          onClick={() => setOpcItemId(it.id)}
                          className="ml-2 rounded-md border px-1.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10"
                        >
                          {t("opcionales")}
                        </button>
                      )}
                      {esBorrador && esKit(it) && (
                        <button
                          type="button"
                          onClick={() => setKitItem(it)}
                          className="ml-2 rounded-md border px-1.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10"
                        >
                          {t("kit.abrir")}
                        </button>
                      )}
                      {/* Desglose de multiplicadores (láser: días × áreas) — data-driven */}
                      {multsDe(it) && (
                        <span className="block text-[11px] text-muted-foreground">({multTexto(multsDe(it)!)})</span>
                      )}
                      {/* Impuestos de la línea DISCRIMINADOS (Estatal + Municipal + los que haya). N renglones,
                          data-driven: recorre el array del BE, no cablea dos. Handoff IVU compuesto. */}
                      {impuestosDeLinea(it).length > 0 && (
                        <span className="block text-[11px] text-muted-foreground">
                          {impuestosDeLinea(it).map((im, i) => (
                            <span key={i}>
                              {i > 0 ? " · " : ""}
                              {(im.name || "") + (im.rate != null ? ` ${im.rate}%` : "")}: {money(im.amount)}
                            </span>
                          ))}
                        </span>
                      )}
                      {/* Corregir el impuesto de una línea EMITIDA (recomputa totales, puede dejar saldo).
                          Solo con permiso factura.reparar — el sistema deja arreglar, no bloquear. */}
                      {!esBorrador && esGeneral && can("factura.reparar") && (
                        <button
                          type="button"
                          onClick={() => setImpuestoItem(it)}
                          className="ml-2 rounded-md border px-1.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10"
                        >
                          {t("corregirImpuesto.abrir")}
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {/* Cantidad EFECTIVA (base × multiplicadores) read-only cuando hay multiplicadores. */}
                      {multsDe(it) ? (
                        <span className="tabular-nums font-medium" title={t("cantEfectivaHint")}>{cantEfectiva(it)}</span>
                      ) : esBorrador && !isPackageLine(it) ? (
                        <Input
                          value={String(e.quantity)}
                          onChange={(ev) => setEdit(it.id, { quantity: Math.max(1, Math.floor(Number(ev.target.value) || 0)) })}
                          onBlur={() => persist(it)}
                          className="h-7 w-16 text-right tabular-nums" inputMode="numeric" disabled={busy}
                        />
                      ) : <span className="tabular-nums">{n(it.quantity)}</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      {esBorrador && !isPackageLine(it) ? (
                        <Input
                          value={String(e.unitPrice)}
                          onChange={(ev) => setEdit(it.id, { unitPrice: Math.max(0, Number(ev.target.value) || 0) })}
                          onBlur={() => persist(it)}
                          className="h-7 w-24 text-right tabular-nums" inputMode="decimal" disabled={busy}
                        />
                      ) : <span className="tabular-nums">{money(it.unitPrice)}</span>}
                    </TableCell>
                    {esGeneral && (
                      <TableCell className="text-center">
                        {/* A package line is not toggled: the toggle deletes and re-adds the line. */}
                        {esBorrador && !isPackageLine(it) ? (
                          <button
                            type="button"
                            onClick={() => toggleGravado(it)}
                            disabled={busy}
                            className={
                              "rounded-full px-2 py-0.5 text-[11px] font-medium disabled:opacity-40 " +
                              (it.taxable
                                ? "bg-info/15 text-info-foreground"
                                : "bg-muted text-muted-foreground")
                            }
                            title={t("ivuToggleHint")}
                          >
                            {it.taxable ? t("ivuGravado") : t("ivuExento")}
                          </button>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">
                            {it.taxable ? t("ivuGravado") : t("ivuExento")}
                          </span>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-right font-medium tabular-nums">{money(lineTotal(it))}</TableCell>
                    {esBorrador && (
                      <TableCell className="text-right">
                        <button type="button" onClick={() => run(() => eliminarItem(id, it.id, centro))} disabled={busy} aria-label={t("remove")} className="text-destructive hover:opacity-70 disabled:opacity-40">×</button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </DataTable>
        </CardContent>
      </Card>

      {/* Summary: ONE card — totals, then divided sections (discount, VAT exemption, payments), with
          Issue as its footer. */}
      <Card className={esBorrador ? "pb-0" : undefined}>
        <CardHeader><CardTitle>{t("summary")}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Row label={t("subtotal")} value={money(subtotal)} />
          <Row label={t("discount")} value={`- ${money(descuento)}`} />
          {impuestosDesglose.length > 0
            ? impuestosDesglose.map((im, i) => (
                <Row key={i} label={(im.name || t("tax")) + (im.rate != null ? ` (${im.rate}%)` : "")} value={money(im.amount)} />
              ))
            : <Row label={t("tax")} value={money(impuesto)} />}
          <EnvioRow
            key={`envio-${n((factura as { shipping?: number }).shipping)}`}
            envio={n((factura as { shipping?: number }).shipping)}
            editable={esBorrador && puedeUpdate}
            showWhenZero={esBorrador && puedeUpdate}
            disabled={busy}
            label={t("shipping")}
            onSet={(m) => run(() => setEnvio(id, m, centro))}
          />
          <div className="border-t pt-2"><Row label={t("total")} value={money(total)} strong /></div>
          <PackageSavingsRow items={serverItems} />
        </CardContent>

        {esBorrador && <CardSection><DescuentoGlobal disabled={busy} subtotal={subtotal} descuentoActual={descuento} onApply={(tipo, valor) => run(() => setDescuentoGlobal(id, { type: tipo, value: valor } as never, centro))} applyLabel={t("applyDiscount")} /></CardSection>}

        {esBorrador && esGeneral && (
          <CardSection className="flex items-center justify-between">
            <span className="text-sm">{t("exentoLabel")}</span>
            <input
              type="checkbox"
              className="size-4"
              checked={!!(factura as { exempt?: boolean }).exempt}
              disabled={busy}
              onChange={(e) => run(() => setExento(id, { exempt: e.target.checked }, centro))}
            />
          </CardSection>
        )}

        {!esBorrador && esGeneral && sesionesPorEntregar > 0 && (
          <CardSection><div className="rounded-md border border-info/40 bg-info px-4 py-3 text-sm text-info-foreground">{t("sesionesPorEntregar", { n: sesionesPorEntregar })}</div></CardSection>
        )}

        {esBorrador ? (
          <>
          <CardSection>
            {/* Primero se cobra, después se emite: el cobro es el paso PREVIO a emitir (regla
                cobrar-antes-de-emitir). El BE ya acepta pagos en borrador. */}
            <PagosFactura pagos={factura.payments ?? []} formas={formas} id={id} centro={centro} busy={busy} run={run} saldo={saldo} montoAbonado={n(factura.paidAmount)} esBorrador={esBorrador} />
          </CardSection>
          <CardFooter className="mt-auto flex-col items-stretch pb-4">
            {/* Emitir solo cuando está SALDADA (nada por cobrar). Cortesía / 100% de descuento = total 0
                → saldo 0 → habilitado de un clic. Con saldo pendiente, deshabilitado y con el importe que
                falta a la vista (no hay que pulsarlo para enterarse). El BE es la autoridad: si igual llega
                sin saldar responde 400 FACTURA_NO_SALDADA y se muestra su mensaje (toastError). */}
            <IssueButton
              invoice={factura}
              invoiceId={id}
              centro={centro}
              run={run}
              disabled={busy || serverItems.length === 0 || saldo > 0.005}
              label={saldo > 0.005 ? t("emitFaltaCobrar", { monto: money(saldo) }) : t("emit")}
            />
          </CardFooter>
          </>
        ) : (
          <CardSection><PagosFactura pagos={factura.payments ?? []} formas={formas} id={id} centro={centro} busy={busy} run={run} saldo={saldo} montoAbonado={n(factura.paidAmount)} esBorrador={esBorrador} /></CardSection>
        )}
      </Card>

      {receipt}

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

      {kitItem && (
        <PersonalizarKitDialog
          key={kitItem.id}
          open={!!kitItem}
          facturaId={id}
          item={kitItem}
          centro={centro}
          onOpenChange={(o) => !o && setKitItem(null)}
          onSaved={() => { setKitItem(null); run(() => Promise.resolve()); }}
        />
      )}

      {impuestoItem && (
        <CorregirImpuestoDialog
          key={impuestoItem.id}
          open={!!impuestoItem}
          facturaId={id}
          item={impuestoItem}
          impuestos={impuestosAplicables}
          centro={centro}
          onOpenChange={(o) => !o && setImpuestoItem(null)}
          onSaved={() => { setImpuestoItem(null); run(() => Promise.resolve()); }}
        />
      )}
    </div>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const variant =
    estado === "borrador" ? "warning"
    : estado === "anulada" ? "destructive"
    : "success";
  const label = estado ? estado.charAt(0).toUpperCase() + estado.slice(1) : "—";
  return <Badge variant={variant}>{label}</Badge>;
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={strong ? "text-sm font-semibold" : "text-sm text-muted-foreground"}>{label}</span>
      <span className={"tabular-nums " + (strong ? "text-base font-bold" : "text-sm")}>{value}</span>
    </div>
  );
}

// Fila de ENVÍO/flete en el resumen. Editable inline (solo borrador + factura.update): al confirmar
// (blur/Enter) llama al BE, que recomputa el total (FE no recalcula). En emitida (o sin permiso) es de
// solo lectura y solo aparece si hay envío (>0). 0 = sin envío. Alineada con las demás filas del resumen.
function EnvioRow({
  envio,
  editable,
  showWhenZero,
  disabled,
  label,
  onSet,
}: {
  envio: number;
  editable: boolean;
  showWhenZero: boolean;
  disabled?: boolean;
  label: string;
  onSet: (monto: number) => void;
}) {
  // El valor inicial sale del BE; el padre remonta esta fila por `key={envio}` tras recomputar, así que
  // no hace falta sincronizar con un efecto (evita setState-in-effect y renders en cascada).
  const [val, setVal] = React.useState(envio > 0 ? envio.toFixed(2) : "");

  if (!editable) {
    if (!showWhenZero && !(envio > 0)) return null;
    return <Row label={label} value={money(envio)} />;
  }

  const commit = () => {
    const m = Math.max(0, Number(val) || 0);
    if (Math.abs(m - envio) > 0.001) onSet(m);
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <span className="text-sm text-muted-foreground">$</span>
        <Input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
          inputMode="decimal"
          placeholder="0.00"
          disabled={disabled}
          aria-label={label}
          className="h-7 w-24 text-right tabular-nums"
        />
      </div>
    </div>
  );
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
  const eff = (o: ItemOpcional) => ov[o.componentId] ?? o.incluido;
  const extra = opcionales.filter(eff).reduce((s, o) => s + (o.incrementalPrice ?? 0), 0);

  async function guardar() {
    setSaving(true);
    try {
      const incluidos = opcionales.filter(eff).map((o) => o.componentId);
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
          {res.state.kind === "loading" && <DialogRowsSkeleton trailing="w-14" />}
          {res.state.kind === "ok" && opcionales.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("opcionalesEmpty")}</p>
          )}
          {opcionales.map((o) => (
            <label key={o.componentId} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                <input type="checkbox" checked={eff(o)} onChange={() => setOv((m) => ({ ...m, [o.componentId]: !eff(o) }))} />
                <span className="font-medium">{o.name}</span>
                {o.quantity > 1 && <span className="text-xs text-muted-foreground">×{o.quantity}</span>}
              </span>
              <span className="tabular-nums text-muted-foreground">+{money(o.incrementalPrice)}</span>
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

// Personalizar el KIT de una línea: quitar / cambiar cantidad / AGREGAR componentes, SOLO en esta factura
// (no toca la receta general). Lo que quede es lo que el paciente recibe en el frontdesk (menos sesiones =
// menos disponibilidad). Overlay sin setState-en-effect: partimos de la receta (o de la personalización ya
// guardada) y guardamos removidos/cantidades/agregados encima; al guardar mandamos la LISTA FINAL completa.
type KitRow = { productoId: string; cantidad: number; nombre: string; isAdded?: boolean };
function PersonalizarKitDialog({
  open,
  onOpenChange,
  facturaId,
  item,
  centro,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  facturaId: string;
  item: FacturaItem;
  centro?: string;
  onSaved: () => void;
}) {
  const t = useTranslations("facturacion");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const { can } = useCan();
  const puedeAgregar = can("factura.kit_agregar");

  // Receta base del compuesto (BOM) + nombres de producto. Autocontenido, como ComponentesEditor.
  const recetaRes = useResource<ProductoComponente[]>(() => listComponentes(String(item.productId)), [item.productId]);
  const prodRes = useResource<ProductoInv[]>(() => listProductos({}), []);
  const prodName = React.useMemo(() => {
    const m = new Map<string, string>();
    if (prodRes.state.kind === "ok") prodRes.state.data.forEach((p) => m.set(p.id, p.name));
    return m;
  }, [prodRes.state]);

  // Base = personalización ya guardada (si la hay) o la receta real (activa, no estimada). Los insumos
  // ESTIMADOS no se descargan ni entran a frontdesk → fuera de aquí.
  const perso = (item.customization as { componentes?: { productId: string; quantity: number }[] } | null)?.componentes;
  const base: KitRow[] = React.useMemo(() => {
    if (Array.isArray(perso)) {
      return perso.map((c) => ({ productoId: c.productId, cantidad: Number(c.quantity) || 0, nombre: prodName.get(c.productId) ?? c.productId }));
    }
    const receta = recetaRes.state.kind === "ok" ? recetaRes.state.data : [];
    return receta
      .filter((c) => c.active !== false && !c.estimated)
      .map((c) => ({ productoId: c.componentId, cantidad: Number(c.quantity) || 0, nombre: prodName.get(c.componentId) ?? c.componentId }));
  }, [perso, recetaRes.state, prodName]);

  const [removed, setRemoved] = React.useState<Record<string, boolean>>({});
  const [qty, setQty] = React.useState<Record<string, string>>({});
  const [added, setAdded] = React.useState<KitRow[]>([]);
  const [nuevoId, setNuevoId] = React.useState("");
  const [nuevoNombre, setNuevoNombre] = React.useState("");
  const [nuevaCant, setNuevaCant] = React.useState("1");
  const [saving, setSaving] = React.useState(false);

  const cargando = recetaRes.state.kind === "loading" || prodRes.state.kind === "loading";
  const cantDe = (r: KitRow) => (qty[r.productoId] !== undefined ? Math.max(0, Number(qty[r.productoId]) || 0) : r.cantidad);
  // Lista final que se manda: base viva (no removida) + agregados, con la cantidad efectiva.
  const finalRows: KitRow[] = [
    ...base.filter((r) => !removed[r.productoId]).map((r) => ({ ...r, cantidad: cantDe(r) })),
    ...added,
  ].filter((r) => r.cantidad > 0);

  function agregar() {
    const c = Math.max(1, Math.floor(Number(nuevaCant) || 0));
    if (!nuevoId || c <= 0) return;
    // Si ya está en base y estaba removido, reponerlo en vez de duplicar.
    if (base.some((b) => b.productoId === nuevoId)) {
      setRemoved((m) => ({ ...m, [nuevoId]: false }));
      setQty((m) => ({ ...m, [nuevoId]: String(c) }));
    } else {
      setAdded((a) => (a.some((x) => x.productoId === nuevoId) ? a : [...a, { productoId: nuevoId, cantidad: c, nombre: nuevoNombre || nuevoId, isAdded: true }]));
    }
    setNuevoId("");
    setNuevoNombre("");
    setNuevaCant("1");
  }

  async function guardar() {
    setSaving(true);
    try {
      await personalizarKit(facturaId, item.id, finalRows.map((r) => ({ productId: r.productoId, quantity: r.cantidad })), centro);
      onSaved();
    } catch (err) {
      toastError(err, tRoot);
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("kit.titulo", { nombre: item.description ?? "" })}</DialogTitle>
        </DialogHeader>

        {cargando ? (
          <DialogRowsSkeleton trailing="w-16" />
        ) : (
          <div className="space-y-3">
            {base.length === 0 && added.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("kit.vacio")}</p>
            )}

            <ul className="space-y-2">
              {base.map((r) => {
                const quitado = !!removed[r.productoId];
                return (
                  <li key={r.productoId} className={"flex items-center justify-between gap-3 rounded-lg border px-3 py-2 " + (quitado ? "opacity-50" : "")}>
                    <span className={"min-w-0 flex-1 truncate text-sm font-medium " + (quitado ? "line-through" : "")}>{r.nombre}</span>
                    {quitado ? (
                      <Button variant="ghost" size="sm" onClick={() => setRemoved((m) => ({ ...m, [r.productoId]: false }))}>{t("kit.reponer")}</Button>
                    ) : (
                      <>
                        <Input
                          value={qty[r.productoId] ?? String(r.cantidad)}
                          onChange={(e) => setQty((m) => ({ ...m, [r.productoId]: e.target.value }))}
                          inputMode="numeric"
                          className="h-8 w-16 text-right tabular-nums"
                          aria-label={t("kit.cantidad")}
                        />
                        <button type="button" onClick={() => setRemoved((m) => ({ ...m, [r.productoId]: true }))} aria-label={t("kit.quitar")} className="text-destructive hover:opacity-70">×</button>
                      </>
                    )}
                  </li>
                );
              })}
              {added.map((r) => (
                <li key={r.productoId} className="flex items-center justify-between gap-3 rounded-md border border-primary/40 bg-primary/5 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.nombre}<span className="ml-2 text-[11px] text-primary">{t("kit.agregado")}</span></span>
                  <span className="tabular-nums text-sm">×{r.cantidad}</span>
                  <button type="button" onClick={() => setAdded((a) => a.filter((x) => x.productoId !== r.productoId))} aria-label={t("kit.quitar")} className="text-destructive hover:opacity-70">×</button>
                </li>
              ))}
            </ul>

            {/* Agregar componente: solo con permiso fino (el BE lo exige; no mostramos la puerta si no se abre). */}
            {puedeAgregar && (
              <div className="flex items-end gap-2 rounded-md border border-dashed p-3">
                <div className="min-w-0 flex-1">
                  <Lbl>{t("kit.agregarComponente")}</Lbl>
                  <ProductoPicker
                    value={nuevoId}
                    soloFisicos={false}
                    onChange={(id, p) => { setNuevoId(id); setNuevoNombre(p?.name ?? ""); }}
                    placeholder={t("kit.buscarProducto")}
                  />
                </div>
                <Input value={nuevaCant} onChange={(e) => setNuevaCant(e.target.value)} inputMode="numeric" className="h-9 w-16 text-right tabular-nums" aria-label={t("kit.cantidad")} />
                <Button size="sm" onClick={agregar} disabled={!nuevoId}>{tc("add")}</Button>
              </div>
            )}

            {/* Qué implica: la duda de todos la primera vez. */}
            <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{t("kit.avisoFrontdesk")}</p>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>{tc("cancel")}</Button>
              <Button size="sm" onClick={guardar} disabled={saving}>{tc("save")}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Corregir el IMPUESTO de una línea, incluso en una factura EMITIDA (caso real: salió con el impuesto
// equivocado). PUT /facturas/:id/items/:itemId {impuestoId} recomputa los totales y puede dejar saldo
// (se cobra la diferencia normal). Solo lista impuestos APLICABLES (parentId null); el desglose
// Estatal/Municipal lo calcula el servidor. Gate factura.reparar (ya resuelto por quien abre el botón).
// Handoff HANDOFF-ivu-compuesto-y-corregir-impuesto-de-linea.
function CorregirImpuestoDialog({
  open,
  onOpenChange,
  facturaId,
  item,
  impuestos,
  centro,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  facturaId: string;
  item: FacturaItem;
  impuestos: Impuesto[];
  centro?: string;
  onSaved: () => void;
}) {
  const t = useTranslations("facturacion");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const SIN = "__sin_impuesto__";
  const [sel, setSel] = React.useState<string>(item.taxId ? String(item.taxId) : SIN);
  const [saving, setSaving] = React.useState(false);

  async function guardar() {
    setSaving(true);
    try {
      await actualizarItem(facturaId, item.id, { taxId: sel === SIN ? null : sel } as never, centro);
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
          <DialogTitle>{t("corregirImpuesto.titulo", { nombre: item.description ?? "" })}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <label className="flex flex-col gap-1.5">
            <Lbl>{t("corregirImpuesto.impuesto")}</Lbl>
            <Select value={sel} onValueChange={setSel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {/* "Sin impuesto" (exento) + solo los APLICABLES (parentId null): nunca sus componentes. */}
                <SelectItem value={SIN}>{t("corregirImpuesto.sinImpuesto")}</SelectItem>
                {impuestos.map((im) => {
                  // El nombre del catálogo a veces YA trae la tasa ("IVU PR (11.5%)"): no duplicarla.
                  const base = im.name || im.slug;
                  const label = im.rate != null && !/%/.test(base) ? `${base} (${im.rate}%)` : base;
                  return <SelectItem key={im.id} value={im.id}>{label}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </label>
          <Alert variant="warning" className="text-xs">
            <AlertDescription>{t("corregirImpuesto.aviso")}</AlertDescription>
          </Alert>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>{tc("cancel")}</Button>
            <Button size="sm" onClick={guardar} disabled={saving}>{tc("save")}</Button>
          </div>
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
  const nombre = (p: PacienteBusqueda) => (p.displayName || `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim()) || t("patient");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("cambiarPacienteTitle")}</DialogTitle>
        </DialogHeader>
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPatientPlaceholder")} />
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {term.length < 2 && <p className="py-6 text-center text-sm text-muted-foreground">{t("searchHint")}</p>}
          {loading && <DialogRowsSkeleton sub trailing={null} />}
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
                    {p.medicalRecordNumber ? `#${p.medicalRecordNumber}` : ""} {p.documentId ? `· ID ${p.documentId}` : ""}
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

// Usuario responsable de la venta (en el encabezado). En emitida = quién cobró; en borrador = quién la
// creó. `esLlave` = la emitió una integración (se muestra distinto). El botón corregir aparece con permiso
// (el BE es la autoridad final de si se puede). Handoff usuario-de-la-factura.
function UsuarioResponsable({
  factura,
  puedeEditar,
  onCorregir,
  label,
  integracionLabel,
  sinUsuarioLabel,
  corregirLabel,
}: {
  factura: FacturaConItems;
  puedeEditar: boolean;
  onCorregir: () => void;
  label: string;
  integracionLabel: string;
  sinUsuarioLabel: string;
  corregirLabel: string;
}) {
  const est = String(factura.status ?? "");
  const u = est === "borrador"
    ? (factura.createdBy ?? factura.emisor)
    : (factura.issuedBy ?? factura.emisor ?? factura.createdBy);
  const esLlave = !!u?.esLlave;
  return (
    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>
        {label}: <span className="font-medium text-foreground">{esLlave ? integracionLabel : (u?.name || sinUsuarioLabel)}</span>
      </span>
      {puedeEditar && (
        <button type="button" onClick={onCorregir} className="no-print rounded-md border px-1.5 py-0.5 font-medium text-primary hover:bg-primary/10">
          {corregirLabel}
        </button>
      )}
    </p>
  );
}

// Corregir el usuario responsable → PUT /facturas/:id/cabecera { usuarioId } (id de /profiles). El BE
// valida existencia y permiso (admin; gerente o quien facturó, el mismo día). Handoff usuario-de-la-factura.
function UsuarioDialog({
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
  onSaved: () => void;
}) {
  const t = useTranslations("facturacion");
  const tRoot = useTranslations();
  // getProfiles es de administración (403 a un cajero): pedirlo SOLO al abrir este diálogo (acción de
  // admin «corregir usuario»), no al montar la pantalla de caja. Handoff selector-de-linea-sin-buscador.
  const perfilesRes = useResource<Perfil[]>(() => (open ? getProfiles() : Promise.resolve([])), [open]);
  const perfiles = perfilesRes.state.kind === "ok" ? perfilesRes.state.data : [];
  const est = String(factura.status ?? "");
  const actual = ((est === "borrador" ? factura.createdBy?.profileId : factura.issuedBy?.profileId) ?? factura.emisor?.profileId ?? "") as string;
  const [sel, setSel] = React.useState<string>(actual);
  const [saving, setSaving] = React.useState(false);

  async function guardar() {
    if (!sel) return;
    setSaving(true);
    try {
      await editarCabeceraFactura(String(factura.id), { userId: sel } as EditarCabeceraPayload, centro);
      onSaved();
    } catch (err) {
      toastError(err, tRoot);
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{t("corregirUsuarioTitle")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <label className="flex flex-col gap-1.5">
            <Lbl>{t("usuarioResponsable")}</Lbl>
            {perfilesRes.state.kind === "loading" ? <ControlSkeleton /> : (
            <Select value={sel} onValueChange={setSel}>
              <SelectTrigger><SelectValue placeholder={t("elegirUsuario")} /></SelectTrigger>
              <SelectContent>
                {perfiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            )}
          </label>
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{t("corregirUsuarioAyuda")}</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>{tRoot("common.cancel")}</Button>
            <Button size="sm" onClick={guardar} disabled={saving || !sel}>{tRoot("common.save")}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DescuentoGlobal({ disabled, onApply, applyLabel, subtotal, descuentoActual = 0 }: { disabled?: boolean; onApply: (tipo: string, valor: number) => void; applyLabel: string; subtotal: number; descuentoActual?: number }) {
  const t = useTranslations("facturacion");
  // Por defecto MONTO ($): quien escribe «2520» en una caja piensa en dólares; el % es el caso raro y se
  // elige a propósito. Handoff descuento-global-monto-vs-porcentaje.
  const [tipo, setTipo] = React.useState("monto");
  const [valor, setValor] = React.useState("");
  const num = Number(valor);
  const numOk = valor.trim() !== "" && !Number.isNaN(num) && num >= 0;
  // Validación EN el control, donde se escribe (no un toast que llega y se pierde):
  const pctPasa100 = tipo === "porcentaje" && numOk && num > 100;
  const montoPasaBase = tipo === "monto" && numOk && subtotal > 0 && num > subtotal;
  const error = pctPasa100 || montoPasaBase;

  return (
    <div className="space-y-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("globalDiscount")}</span>
      <div className="flex items-center gap-2">
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="monto">$</SelectItem>
            <SelectItem value="porcentaje">%</SelectItem>
          </SelectContent>
        </Select>
        <Input
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !disabled && numOk && !error) { e.preventDefault(); onApply(tipo, Math.max(0, num)); } }}
          placeholder="0"
          aria-invalid={error}
          className={"h-9 flex-1 text-right tabular-nums " + (error ? "border-destructive focus-visible:ring-destructive" : "")}
          inputMode="decimal"
        />
        <Button type="button" variant="outline" size="sm" disabled={disabled || !numOk || error} onClick={() => onApply(tipo, Math.max(0, num))}>{applyLabel}</Button>
        {/* Quitar el descuento aplicado: X discreta (manda monto 0). Título/aria para que se entienda. */}
        {descuentoActual > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
            disabled={disabled}
            title={t("removeDiscount")}
            aria-label={t("removeDiscount")}
            onClick={() => { setValor(""); onApply("monto", 0); }}
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
          </Button>
        )}
      </div>
      {descuentoActual > 0 && (
        <p className="text-xs text-muted-foreground">{t("descuentoActual", { monto: descuentoActual })}</p>
      )}
      {/* El error se ve DONDE se escribe, con el atajo para corregirlo en un clic. */}
      {pctPasa100 && (
        <p className="text-xs text-destructive">
          {t("descuentoPctPasa100", { valor: num })}{" "}
          <button type="button" className="font-medium underline underline-offset-2" onClick={() => setTipo("monto")}>
            {t("descuentoUsarMonto", { valor: num })}
          </button>
        </p>
      )}
      {montoPasaBase && (
        <p className="text-xs text-destructive">
          {t("descuentoPasaBase", { valor: num, base: subtotal })}{" "}
          <button type="button" className="font-medium underline underline-offset-2" onClick={() => setValor(String(subtotal))}>
            {t("descuentoUsarBase", { base: subtotal })}
          </button>
        </p>
      )}
    </div>
  );
}

