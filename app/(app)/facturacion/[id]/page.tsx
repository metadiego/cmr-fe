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
  emitirFactura,
  imprimirFactura,
  regenerarDisponibilidad,
  type RegenerarDisponibilidad,
  type FacturaConItems,
  type FacturaItem,
  type Producto,
  type FormaPago,
  type PacienteBusqueda,
  type EditarCabeceraPayload,
} from "@/lib/api/facturas";
import { listComponentes, listProductos, type ProductoComponente, type Producto as ProductoInv } from "@/lib/api/inventario";
import { ProductoPicker } from "@/components/inventario/producto-picker";
import { listMedicos, listMedios, type MedicoOpcion, type MedioFacturacion } from "@/lib/api/facturacion-config";
import { listTiposPrecio, listImpuestos, listCatalogoPrecios, type TipoPrecio, type Impuesto } from "@/lib/api/precios";
import { listColumnasFacturacion, type ColumnaFacturacion } from "@/lib/api/facturacion-config";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { getPaciente, type Paciente } from "@/lib/api/pacientes";
import { getProfiles, type Perfil } from "@/lib/api/profiles";
import { ResumenPacientePanel } from "@/components/facturacion/resumen-paciente-panel";
import { toast } from "sonner";
import { toastError } from "@/lib/api/errors";
import { buildRecibo } from "@/lib/factura/build-recibo";
import { reciboToEscPos, type EscPosLabels } from "@/lib/print/escpos";
import { getPrintSettings, setPrintSettings, type PrintSettings } from "@/lib/print/print-settings";
import { qzListPrinters, qzPrintRaw } from "@/lib/print/qz";
import { printEscPosWebUsb, webUsbSupported } from "@/lib/print/webusb";
import { ReciboTermico } from "@/components/facturacion/recibo-termico";
import { PagosFactura } from "@/components/facturacion/pagos-factura";
import { HugeiconsIcon } from "@hugeicons/react";
import { PrinterIcon, MoreHorizontalIcon } from "@hugeicons/core-free-icons";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const n = (v: unknown) => Number(v ?? 0);
const money = (v: unknown) => `$${n(v).toFixed(2)}`;

// Impresión ESC/POS por QZ Tray: OCULTA por ahora (exige instalar QZ en cada equipo → no práctico).
// El código queda intacto para el futuro; en false todo imprime por el navegador. Cambiar a true para
// volver a exponer el botón «Opciones de impresión» y la ruta QZ.
const QZ_PRINT_UI = false;
// Panel «lo que suma el paciente hoy»: ENCENDIDO. El BE arregló GET /facturas/resumen-paciente (ya acepta
// pacienteId; verificado en prod: Felicita → total general 7.640, sin colar la consulta de 20).
const RESUMEN_PACIENTE_ENABLED = true;

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
  // Impresión: ajustes por dispositivo (navegador vs térmica ESC/POS por QZ Tray) + diálogo de opciones.
  const [printOpen, setPrintOpen] = React.useState(false);
  const [printCfg, setPrintCfg] = React.useState<PrintSettings>(() => getPrintSettings());
  const [impresoras, setImpresoras] = React.useState<string[]>([]);
  const [buscandoImpresoras, setBuscandoImpresoras] = React.useState(false);
  const { can } = useCan();

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

  // Imprimir PASA POR EL SERVIDOR: un borrador saldado se emite (número/fecha definitivos, entra al
  // cuadre) antes de imprimir; uno sin cobrar imprime igual pero avisa que no quedó emitido. Refrescamos
  // la factura con lo que devuelve el BE y, tras pintar el recibo definitivo, mandamos a imprimir.
  // Handoff HANDOFF-vitales-en-atencion-e-imprimir-emite.
  async function imprimir() {
    // Dos rutas según el ajuste del DISPOSITIVO (por defecto navegador → todo igual que antes):
    //  - "navegador": ventana propia aislada (portable). Se abre YA, sincrónico con el clic, para
    //    conservar la activación del usuario (si no, el navegador la bloquea como popup).
    //  - "qz": ESC/POS crudo a la impresora térmica vía QZ Tray (independiente del navegador). Si algo
    //    falla (QZ no corriendo, sin impresora, error), SIEMPRE cae al navegador — nunca deja sin imprimir.
    const cfg = getPrintSettings();
    // Mientras QZ_PRINT_UI esté oculto, SIEMPRE navegador (aunque un equipo tenga 'qz' guardado de antes).
    const usarQz = QZ_PRINT_UI && cfg.metodo === "qz";
    const win = usarQz ? null : window.open("", "cmr_recibo", "width=380,height=760");
    let facturaFinal = factura;
    let numPres = presupuestoNum;
    try {
      const r = await imprimirFactura(id, centro);
      setFactura(r.factura);
      facturaFinal = r.factura;
      // Presupuesto: guardar el nº que asigna el BE (se reusa al reimprimir) para pintarlo en el recibo y
      // en la ficha. Handoff imprimir-presupuesto-cuando-no-esta-cobrada.
      if (r.documento === "presupuesto" && r.numeroPresupuesto) {
        setPresupuestoNum(r.numeroPresupuesto);
        numPres = r.numeroPresupuesto;
      }
      if (!r.emitida && r.motivo) {
        // El motivo viene como labelKey del BE (factura.no_emitida_pendiente_pago, factura.ya_emitida…).
        // Ámbar solo cuando falta cobrar (hay `pendiente`); neutral para reimpresiones normales (ya
        // emitida/anulada/devuelta). Nunca como error: imprimir es válido igual.
        const msg = tRoot.has(r.motivo) ? tRoot(r.motivo) : t("imprimirNoEmitida");
        if (r.pendiente) toast.warning(msg);
        else toast.info(msg);
      }
    } catch (err) {
      // Un fallo al emitir NO debe impedir imprimir: se avisa y se imprime igual.
      toastError(err, tRoot);
    } finally {
      if (usarQz) {
        try {
          if (!cfg.impresora) throw new Error("sin impresora configurada");
          // Reconstruir el recibo del BE recién devuelto (el `recibo` de render aún es el viejo).
          const reciboFinal = facturaFinal
            ? buildRecibo(facturaFinal, diasCatalogo, clavePorFormaId, numPres)
            : recibo;
          await qzPrintRaw(cfg.impresora, reciboToEscPos(reciboFinal, escposLabels, cfg.columnas));
          toast.success(t("print.doneQz"));
        } catch {
          // QZ falló → respaldo por navegador (ventana propia aislada), sin dejar al usuario sin recibo.
          toast.warning(t("print.qzFallback"));
          const w = window.open("", "cmr_recibo", "width=380,height=760");
          requestAnimationFrame(() => requestAnimationFrame(() => imprimirReciboAislado(w)));
        }
      } else {
        // Esperar a que el recibo se repinte con el número/estado definitivos antes de imprimir.
        requestAnimationFrame(() => requestAnimationFrame(() => imprimirReciboAislado(win)));
      }
    }
  }

  // Etiquetas del recibo ESC/POS (la lib es pura; el texto i18n viene de aquí). Objeto plano: el React
  // Compiler lo memoiza solo.
  const Lr = (key: string, fallback: string) =>
    tRoot.has(`receipt.${key}`) ? tRoot(`receipt.${key}`) : fallback;
  const escposLabels: EscPosLabels = {
    factura: Lr("invoice", "Factura"),
    presupuesto: Lr("budgetDoc", "Presupuesto"),
    devolucion: Lr("returnDoc", "Devolucion"),
    anulada: Lr("void", "ANULADA"),
    patientEn: Lr("patientLabelEn", "Patient or Responsible Party"),
    patientEs: Lr("patientLabelEs", "Paciente o responsable"),
    record: Lr("record", "Record"),
    id: "ID",
    subtotal: Lr("subtotal", "Subtotal"),
    discount: Lr("discount", "Descuento"),
    tax: Lr("tax", "Impuesto"),
    shipping: Lr("shipping", "Envio"),
    total: Lr("total", "Total"),
    paid: Lr("paid", "Total pagado"),
    balance: Lr("balance", "Balance"),
    includes: Lr("includes", "Incluye"),
  };

  // PRUEBA: impresión directa por WebUSB (Chrome/Edge, sin instalar nada, sin diálogo). Envía el recibo
  // actual tal cual está en pantalla. Al primer uso el navegador pide elegir la impresora (una vez).
  async function probarUsbDirecto() {
    try {
      if (!webUsbSupported()) {
        toast.error(t("print.usbUnsupported"));
        return;
      }
      const bytes = reciboToEscPos(recibo, escposLabels, getPrintSettings().columnas);
      await printEscPosWebUsb(bytes);
      toast.success(t("print.usbDone"));
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : t("print.usbError"));
    }
  }

  // Buscar impresoras del sistema vía QZ (para el selector del diálogo de opciones).
  async function buscarImpresoras() {
    setBuscandoImpresoras(true);
    try {
      const lista = await qzListPrinters();
      setImpresoras(lista);
      if (lista.length === 0) toast.warning(t("print.qzNoPrinters"));
    } finally {
      setBuscandoImpresoras(false);
    }
  }

  // Documento HTML autónomo del recibo: reusa los estilos ya cargados (Tailwind + globals, sin duplicar
  // CSS) y fuerza el recibo a ancho completo. Se auto-imprime al cargar (body onload) — patrón portable
  // que funciona en Chrome, Safari, Firefox y Edge.
  function reciboDocHtml(node: Element): string {
    const estilos = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((el) => el.outerHTML)
      .join("\n");
    return (
      `<!doctype html><html><head><meta charset="utf-8"><title>${tRoot("receipt.previewTitle")}</title>${estilos}` +
      // ANCHO LIBRE: sin @page size ni ancho fijo, el recibo (width:auto) se ajusta SOLO al papel del
      // driver, en todo navegador. Firefox encogía la LETRA porque su "ajustar al ancho" reduce toda la
      // hoja cuando ALGO del contenido es más ancho que el papel (p. ej. las líneas largas del pie sin
      // espacios que corten). Solución sin imponer tamaño: forzar que TODO parta línea y nada desborde.
      `<style>@page{margin:0}html,body{margin:0;padding:0;background:#fff}` +
      `.recibo-print{position:static!important;visibility:visible!important;margin:0!important;width:auto!important;max-width:100%!important}` +
      `.recibo-print *{overflow-wrap:anywhere!important;word-break:break-word!important;max-width:100%!important}` +
      `.recibo-print img{max-width:100%!important;height:auto!important}</style>` +
      // Auto-imprimir tras cargar estilos/imágenes; el propio documento cierra su ventana al terminar.
      `</head><body onload="setTimeout(function(){window.focus();window.print();},300)">${node.outerHTML}</body></html>`
    );
  }

  // Imprime SOLO el recibo aislado. Antes hacíamos window.print() sobre la página completa: el recibo
  // salía incrustado en el layout (chico y con el fondo de la app). PRIMARIO: una ventana propia que se
  // auto-imprime (portable, funciona en Safari). RESPALDO: un iframe oculto (si el popup fue bloqueado).
  function imprimirReciboAislado(win: Window | null) {
    const node = document.querySelector(".recibo-print");
    if (!node) {
      win?.close();
      window.print();
      return;
    }
    if (win && !win.closed) {
      win.document.open();
      win.document.write(reciboDocHtml(node));
      win.document.close();
      win.onafterprint = () => {
        try {
          win.close();
        } catch {
          /* noop */
        }
      };
      return;
    }
    // Popup bloqueado → iframe oculto (funciona al menos en Chrome/Edge/Firefox).
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    Object.assign(iframe.style, {
      position: "fixed",
      right: "0",
      bottom: "0",
      width: "0",
      height: "0",
      border: "0",
    });
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) {
      iframe.remove();
      window.print();
      return;
    }
    doc.open();
    doc.write(reciboDocHtml(node));
    doc.close();
    // El body onload del documento dispara la impresión; limpiamos el iframe al terminar.
    const cw = iframe.contentWindow;
    if (cw) cw.onafterprint = () => setTimeout(() => iframe.remove(), 500);
    setTimeout(() => {
      if (iframe.isConnected) iframe.remove();
    }, 8000);
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
  const recibo = buildRecibo(factura, diasCatalogo, clavePorFormaId, presupuestoNum);
  // Un borrador con saldo pendiente es un PRESUPUESTO (no se emite al imprimir). Rige el rótulo del botón.
  const esPresupuesto = estado === "borrador" && n(factura.total) - n(factura.montoAbonado) > 0.005;

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
          {/* Nº de presupuesto (tras imprimir un borrador con saldo): el mostrador lo cita por teléfono. */}
          {presupuestoNum && (
            <span className="rounded-md bg-amber-500/15 px-2.5 py-1 font-mono text-sm font-semibold tabular-nums text-amber-700 ring-1 ring-amber-500/30 dark:text-amber-400">
              {t("presupuestoNum", { num: presupuestoNum })}
            </span>
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
          <Button variant="outline" size="sm" className="no-print" onClick={imprimir}>
            <HugeiconsIcon icon={PrinterIcon} className="size-4" />
            {esPresupuesto ? t("imprimirPresupuesto") : tRoot("receipt.print")}
          </Button>
          {/* PRUEBA (temporal): impresión USB directa por WebUSB, sin instalar nada. Solo Chrome/Edge. */}
          <Button variant="secondary" size="sm" className="no-print" onClick={probarUsbDirecto}>
            {t("print.usbTest")}
          </Button>
          {/* Opciones de impresión (navegador vs térmica ESC/POS por QZ Tray). OCULTO: QZ exige instalar
              software en cada equipo → no es práctico. El código queda para el futuro; por defecto todo
              imprime por el navegador. Poner QZ_PRINT_UI en true para volver a mostrarlo. */}
          {QZ_PRINT_UI && (
            <Button
              variant="ghost"
              size="sm"
              className="no-print text-xs text-muted-foreground"
              onClick={() => { setPrintCfg(getPrintSettings()); setPrintOpen(true); }}
            >
              {t("print.options")}
              {printCfg.metodo === "qz" && <span className="ml-1 rounded bg-primary/10 px-1 text-[10px] text-primary">QZ</span>}
            </Button>
          )}
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
        </div>
      </div>

      {/* Opciones de impresión (por dispositivo, en localStorage). El navegador es el default; la térmica
          por QZ Tray es opcional y con respaldo automático al navegador si falla. */}
      <Dialog open={printOpen} onOpenChange={setPrintOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("print.title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <p className="text-xs text-muted-foreground">{t("print.help")}</p>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t("print.method")}</label>
              <Select
                value={printCfg.metodo}
                onValueChange={(v) => setPrintCfg((c) => ({ ...c, metodo: v as PrintSettings["metodo"] }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="navegador">{t("print.methodBrowser")}</SelectItem>
                  <SelectItem value="qz">{t("print.methodQz")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {printCfg.metodo === "qz" && (
              <>
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">{t("print.printer")}</label>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={buscarImpresoras} disabled={buscandoImpresoras}>
                      {buscandoImpresoras ? tRoot("common.loading") : t("print.search")}
                    </Button>
                  </div>
                  <Select
                    value={printCfg.impresora ?? ""}
                    onValueChange={(v) => setPrintCfg((c) => ({ ...c, impresora: v }))}
                  >
                    <SelectTrigger><SelectValue placeholder={t("print.printerPlaceholder")} /></SelectTrigger>
                    <SelectContent>
                      {impresoras.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      {printCfg.impresora && !impresoras.includes(printCfg.impresora) && (
                        <SelectItem value={printCfg.impresora}>{printCfg.impresora}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t("print.width")}</label>
                  <Select
                    value={String(printCfg.columnas)}
                    onValueChange={(v) => setPrintCfg((c) => ({ ...c, columnas: Number(v) }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="48">{t("print.width80")}</SelectItem>
                      <SelectItem value="32">{t("print.width58")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{t("print.qzHint")}</p>
              </>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setPrintOpen(false)}>{tRoot("common.cancel")}</Button>
              <Button size="sm" onClick={() => { setPrintSettings(printCfg); setPrintOpen(false); toast.success(t("print.saved")); }}>
                {tRoot("common.save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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

      {/* «Lo que suma el paciente hoy»: varias facturas del mismo paciente → total sin calculadora. Solo
          facturación general y solo si la factura tiene paciente. Handoff resumen-de-facturas-del-paciente.
          DESACTIVADO: el endpoint GET /facturas/resumen-paciente está roto en prod (valida contradictorio:
          exige pacienteId como UUID y a la vez lo rechaza como propiedad → 400 con cualquier llamada). Ver
          docs/specs/resumen-paciente-endpoint-roto-handoff-be.md. Poner en true cuando el BE lo acepte. */}
      {RESUMEN_PACIENTE_ENABLED && factura.pacienteId && (
        <div className="mb-4 no-print">
          {/* El resumen exige centro (admin/master sin centro → 400). Usar el de la URL o, si falta, el de
              la propia factura (clinicId) → nunca 400 por centro al abrir el panel. */}
          <ResumenPacientePanel
            pacienteId={String(factura.pacienteId)}
            facturaActualId={id}
            centro={centro ?? (factura as { clinicId?: string }).clinicId ?? undefined}
          />
        </div>
      )}

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
          <Button variant="outline" size="sm" onClick={imprimir}>
            <HugeiconsIcon icon={PrinterIcon} className="size-4" />
            {esPresupuesto ? t("imprimirPresupuesto") : tRoot("receipt.print")}
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
  const { can } = useCan();
  const puedeUpdate = can("factura.update");
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
  // Impuestos APLICABLES: solo los que NO son componentes de desglose (parentId null) y están activos.
  // NO hay "impuesto por defecto" (regla del dueño): el FE NO autoselecciona ni manda impuestoId al crear
  // una línea — el servidor resuelve el impuesto correcto por la cascada precio→presentación→producto (y
  // así no se pierde el Municipal). Estos aplicables solo pueblan el selector de CORRECCIÓN de una línea.
  // Handoff HANDOFF-ivu-compuesto-y-corregir-impuesto-de-linea.
  const impuestosRes = useResource<Impuesto[]>(() => listImpuestos(), []);
  const impuestosAplicables = React.useMemo(
    () => (impuestosRes.state.kind === "ok" ? impuestosRes.state.data.filter((i) => !i.parentId && i.activo) : []),
    [impuestosRes.state],
  );

  // Ediciones locales (cantidad/precio) por item → cálculo INSTANTÁNEO al teclear;
  // se persiste al salir del campo. Sembrado del servidor (el padre remonta al guardar).
  type Edit = { cantidad: number; precioUnitario: number };
  const [edits, setEdits] = React.useState<Record<string, Edit>>(() =>
    Object.fromEntries(serverItems.map((it) => [it.id, { cantidad: n(it.cantidad) || 1, precioUnitario: n(it.precioUnitario) }])),
  );

  // Importe de LÍNEA = el del BE (`item.total`, ya incluye la cantidad EFECTIVA × precio con sus
  // multiplicadores). Regla dura: el recibo/detalle NUNCA recalcula; lo mostrado === lo cobrado.
  // Solo durante una edición ACTIVA en borrador mostramos un preview que respeta el multiplicador
  // (efectiva/base) para que "24 × 70" lea coherente; al salir del campo el BE recomputa el total real.
  const lineTotal = (it: FacturaItem) => {
    const e = edits[it.id];
    const editing = e && (e.cantidad !== n(it.cantidad) || e.precioUnitario !== n(it.precioUnitario));
    if (!editing) return n(it.total);
    const base = n(it.cantidad) || 1;
    const mult = base ? cantEfectiva(it) / base : 1;
    return e.cantidad * mult * e.precioUnitario;
  };
  // Totales de CABECERA = los del BE (subtotal/descuento/impuesto/total). No se recalculan en el cliente.
  const subtotal = n(factura.subtotal) || serverItems.reduce((s, it) => s + n(it.total), 0);
  const descuento = n(factura.descuento);
  const impuesto = n(factura.impuesto);
  // Desglose de impuestos del BE (impuestos[] con nombre/tasa/monto). Data-driven: N renglones,
  // sin hardcodear "11.5%". El total NO se recomputa aquí. Vacío → una sola línea (o exento).
  // IVU en dos renglones (Estatal 10.5% + Municipal 1%) tal cual los proyecta el BE. NO se filtra por
  // monto>0: un municipal en 0,00 de una línea gravada debe verse (su ausencia se lee como error).
  // Exento → lista vacía (no ceros). Handoff HANDOFF-ivu-estatal-y-municipal.
  const impuestosDesglose = (factura as { impuestos?: { nombre?: string; tasa?: number; monto?: number }[] }).impuestos ?? [];
  const total = n(factura.total) || Math.max(0, subtotal - descuento + impuesto);
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
  // NO se manda impuestoId: al quedar gravada, el servidor resuelve el impuesto correcto por la cascada
  // del precio (así no se pierde el Municipal). Handoff HANDOFF-ivu-compuesto-y-corregir-impuesto-de-linea.
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
  // Personalizar el kit de una línea (quitar/cambiar cantidad/agregar componentes) → lo que entra a frontdesk.
  const [kitItem, setKitItem] = React.useState<FacturaItem | null>(null);
  // Corregir el impuesto de una línea (incluso emitida): abre el diálogo de corrección.
  const [impuestoItem, setImpuestoItem] = React.useState<FacturaItem | null>(null);
  // Impuestos de UNA línea, discriminados (Estatal/Municipal…), tal cual los proyecta el BE.
  const impuestosDeLinea = (it: FacturaItem) =>
    (it as { impuestos?: { clave?: string; nombre?: string; tasa?: number; monto?: number }[] }).impuestos ?? [];

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
                              {(im.nombre || "") + (im.tasa != null ? ` ${im.tasa}%` : "")}: {money(im.monto)}
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
          <EnvioRow
            key={`envio-${n((factura as { envio?: number }).envio)}`}
            envio={n((factura as { envio?: number }).envio)}
            editable={esBorrador && puedeUpdate}
            showWhenZero={esBorrador && puedeUpdate}
            disabled={busy}
            label={t("shipping")}
            onSet={(m) => run(() => setEnvio(id, m, centro))}
          />
          <div className="border-t pt-2"><Row label={t("total")} value={money(total)} strong /></div>
        </div>

        {esBorrador && (
          <DescuentoGlobal disabled={busy} subtotal={subtotal} onApply={(tipo, valor) => run(() => setDescuentoGlobal(id, { tipo, valor } as never, centro))} applyLabel={t("applyDiscount")} />
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
          <div className="space-y-4">
            {/* Primero se cobra, después se emite: el cobro es el paso PREVIO a emitir (regla
                cobrar-antes-de-emitir). El BE ya acepta pagos en borrador. */}
            <PagosFactura pagos={factura.pagos ?? []} formas={formas} id={id} centro={centro} busy={busy} run={run} saldo={saldo} montoAbonado={n(factura.montoAbonado)} />
            {/* Emitir solo cuando está SALDADA (nada por cobrar). Cortesía / 100% de descuento = total 0
                → saldo 0 → habilitado de un clic. Con saldo pendiente, deshabilitado y con el importe que
                falta a la vista (no hay que pulsarlo para enterarse). El BE es la autoridad: si igual llega
                sin saldar responde 400 FACTURA_NO_SALDADA y se muestra su mensaje (toastError). */}
            <Button
              className="w-full"
              disabled={busy || serverItems.length === 0 || saldo > 0.005}
              onClick={() => run(() => emitirFactura(id, centro))}
            >
              {saldo > 0.005 ? t("emitFaltaCobrar", { monto: money(saldo) }) : t("emit")}
            </Button>
          </div>
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

// Confirmación + resultado EN PALABRAS de "Regenerar disponibilidad". Fase 1: explica qué hace y pide
// confirmar (acción deliberada y peligrosa). Fase 2: traduce la respuesta del BE a lenguaje humano
// (añadidas / nada faltaba / sugerencias de config), nunca JSON. Idempotente → repetir es inofensivo.
function RegenerarDisponibilidadDialog({
  open,
  onOpenChange,
  facturaId,
  centro,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  facturaId: string;
  centro?: string;
  onDone?: () => void | Promise<unknown>;
}) {
  const t = useTranslations("facturacion");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const [busy, setBusy] = React.useState(false);
  const [res, setRes] = React.useState<RegenerarDisponibilidad | null>(null);

  function handleOpenChange(next: boolean) {
    if (!next) { setRes(null); setBusy(false); }
    onOpenChange(next);
  }
  async function run() {
    setBusy(true);
    try {
      const r = await regenerarDisponibilidad(facturaId, centro);
      setRes(r);
      await onDone?.();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{t("regen.titulo")}</DialogTitle></DialogHeader>
        {res === null ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("regen.explica")}</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>{tc("cancel")}</Button>
              <Button onClick={run} disabled={busy}>{busy ? t("regen.ejecutando") : t("regen.confirmar")}</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            {res.creados > 0 ? (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-emerald-700 dark:text-emerald-400">
                <p className="font-medium">{t("regen.creados", { n: res.creados })}</p>
                <ul className="mt-1 list-disc pl-5">
                  {res.detalle.map((d, i) => (
                    <li key={i}>{t("regen.linea", { sesiones: d.sesiones ?? 0, sku: d.sku ?? "—" })}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="rounded-md border bg-muted/40 px-3 py-2 text-muted-foreground">{t("regen.nada")}</p>
            )}
            {!!res.sugerencias?.length && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-700 dark:text-amber-400">
                <p className="font-medium">{t("regen.sugerenciasTitulo")}</p>
                <ul className="mt-1 list-disc pl-5">
                  {res.sugerencias.map((s, i) => (
                    <li key={i}>{t("regen.sugerencia", { sku: s.sku ?? "—" })}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={() => handleOpenChange(false)}>{t("regen.listo")}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
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
  const recetaRes = useResource<ProductoComponente[]>(() => listComponentes(String(item.productoId)), [item.productoId]);
  const prodRes = useResource<ProductoInv[]>(() => listProductos({}), []);
  const prodName = React.useMemo(() => {
    const m = new Map<string, string>();
    if (prodRes.state.kind === "ok") prodRes.state.data.forEach((p) => m.set(p.id, p.nombre));
    return m;
  }, [prodRes.state]);

  // Base = personalización ya guardada (si la hay) o la receta real (activa, no estimada). Los insumos
  // ESTIMADOS no se descargan ni entran a frontdesk → fuera de aquí.
  const perso = (item.personalizacion as { componentes?: { productoId: string; cantidad: number }[] } | null)?.componentes;
  const base: KitRow[] = React.useMemo(() => {
    if (Array.isArray(perso)) {
      return perso.map((c) => ({ productoId: c.productoId, cantidad: Number(c.cantidad) || 0, nombre: prodName.get(c.productoId) ?? c.productoId }));
    }
    const receta = recetaRes.state.kind === "ok" ? recetaRes.state.data : [];
    return receta
      .filter((c) => c.activo !== false && !c.estimado)
      .map((c) => ({ productoId: c.componenteId, cantidad: Number(c.cantidad) || 0, nombre: prodName.get(c.componenteId) ?? c.componenteId }));
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
      await personalizarKit(facturaId, item.id, finalRows.map((r) => ({ productoId: r.productoId, cantidad: r.cantidad })), centro);
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
          <DialogTitle>{t("kit.titulo", { nombre: item.descripcion ?? "" })}</DialogTitle>
        </DialogHeader>

        {cargando ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{tc("loading")}</p>
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
                <li key={r.productoId} className="flex items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.nombre}<span className="ml-2 text-[11px] text-primary">{t("kit.agregado")}</span></span>
                  <span className="tabular-nums text-sm">×{r.cantidad}</span>
                  <button type="button" onClick={() => setAdded((a) => a.filter((x) => x.productoId !== r.productoId))} aria-label={t("kit.quitar")} className="text-destructive hover:opacity-70">×</button>
                </li>
              ))}
            </ul>

            {/* Agregar componente: solo con permiso fino (el BE lo exige; no mostramos la puerta si no se abre). */}
            {puedeAgregar && (
              <div className="flex items-end gap-2 rounded-lg border border-dashed p-3">
                <div className="min-w-0 flex-1">
                  <Lbl>{t("kit.agregarComponente")}</Lbl>
                  <ProductoPicker
                    value={nuevoId}
                    soloFisicos={false}
                    onChange={(id, p) => { setNuevoId(id); setNuevoNombre(p?.nombre ?? ""); }}
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
  const [sel, setSel] = React.useState<string>(item.impuestoId ? String(item.impuestoId) : SIN);
  const [saving, setSaving] = React.useState(false);

  async function guardar() {
    setSaving(true);
    try {
      await actualizarItem(facturaId, item.id, { impuestoId: sel === SIN ? null : sel } as never, centro);
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
          <DialogTitle>{t("corregirImpuesto.titulo", { nombre: item.descripcion ?? "" })}</DialogTitle>
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
                  const base = im.nombre || im.clave;
                  const label = im.tasa != null && !/%/.test(base) ? `${base} (${im.tasa}%)` : base;
                  return <SelectItem key={im.id} value={im.id}>{label}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </label>
          <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            {t("corregirImpuesto.aviso")}
          </p>
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
  const est = String(factura.estado ?? "");
  const u = est === "borrador"
    ? (factura.creadoPor ?? factura.emisor)
    : (factura.emitidoPor ?? factura.emisor ?? factura.creadoPor);
  const esLlave = !!u?.esLlave;
  return (
    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>
        {label}: <span className="font-medium text-foreground">{esLlave ? integracionLabel : (u?.nombre || sinUsuarioLabel)}</span>
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
  const est = String(factura.estado ?? "");
  const actual = ((est === "borrador" ? factura.creadoPor?.perfilId : factura.emitidoPor?.perfilId) ?? factura.emisor?.perfilId ?? "") as string;
  const [sel, setSel] = React.useState<string>(actual);
  const [saving, setSaving] = React.useState(false);

  async function guardar() {
    if (!sel) return;
    setSaving(true);
    try {
      await editarCabeceraFactura(String(factura.id), { usuarioId: sel } as EditarCabeceraPayload, centro);
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
            <Select value={sel} onValueChange={setSel}>
              <SelectTrigger><SelectValue placeholder={t("elegirUsuario")} /></SelectTrigger>
              <SelectContent>
                {perfiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
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

// Combobox de línea CON BÚSQUEDA server-side (SKU y nombre) — antes era un Select que solo ofrecía 100
// artículos y no buscaba, dejando fuera lo que no cayera en esos 100 (imposible de facturar en pantalla).
// Vacío = «lo más usado» (la carga inicial); al teclear (250 ms) busca en /precios/catalogo. Autocontenido
// (sin cmdk/popover), como ProductoPicker. Handoff selector-de-linea-sin-buscador.
function CatalogoCombobox({
  catalogoInicial, selected, tipoPrecioId, tenant, disabled, onPick,
}: {
  catalogoInicial: Producto[];
  selected: Producto | null;
  tipoPrecioId?: string | null;
  tenant?: string | null;
  disabled?: boolean;
  onPick: (p: Producto) => void;
}) {
  const t = useTranslations("facturacion");
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(id);
  }, [query]);
  React.useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const q = debounced.trim();
  // Buscar por SKU y por nombre en el catálogo de precios (alcanza TODO, no solo los 100). El precio
  // definitivo lo resuelve AddItem; aquí solo se necesita id/sku/nombre para elegir.
  const searchRes = useResource<Producto[]>(
    () =>
      q.length >= 1
        ? listCatalogoPrecios(tipoPrecioId ? { q, tipoPrecioId, limit: 50 } : { q, limit: 50 }, tenant ?? undefined)
            .then((r) => r.items.map((row) => ({ id: row.productoId, nombre: row.nombre, sku: row.sku } as unknown as Producto)))
        : Promise.resolve([]),
    [q, tipoPrecioId, tenant],
  );
  const buscando = q.length >= 1 && searchRes.state.kind === "loading";
  const resultados = q.length >= 1 ? (searchRes.state.kind === "ok" ? searchRes.state.data : []) : catalogoInicial;

  const etiqueta = selected ? (selected.sku ? `${selected.sku} — ${selected.nombre}` : selected.nombre) : "";

  return (
    <div ref={rootRef} className="relative">
      <Input
        value={open ? query : etiqueta}
        onChange={(e) => { setQuery(e.target.value); if (!open) setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={t("selectProduct")}
        disabled={disabled}
        className="h-9 w-full"
      />
      {open && (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          {buscando && <p className="px-2 py-2 text-xs text-muted-foreground">…</p>}
          {!buscando && resultados.length === 0 && (
            <p className="px-2 py-2 text-xs text-muted-foreground">{q ? t("noMatches") : t("selectProduct")}</p>
          )}
          {!buscando && resultados.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { onPick(p); setOpen(false); setQuery(""); setDebounced(""); }}
              className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              {p.sku && <span className="shrink-0 font-mono text-xs text-muted-foreground">{p.sku}</span>}
              <span className="min-w-0">{p.nombre}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AddItem({ catalogo, showIvu, tipoPrecioId, tenant, disabled, onAdd }: { catalogo: Producto[]; showIvu?: boolean; tipoPrecioId?: string | null; tenant?: string | null; disabled?: boolean; onAdd: (p: { productoId: string; descripcion: string; cantidad: number; precioUnitario?: number; gravado?: boolean; meta?: Record<string, number | string> }) => void }) {
  const t = useTranslations("facturacion");
  const tRoot = useTranslations();
  const [prodId, setProdId] = React.useState("");
  const [cant, setCant] = React.useState("1");
  const [precio, setPrecio] = React.useState(""); // override manual (vacío = precio de la lista de la factura)
  const [gravadoOverride, setGravadoOverride] = React.useState<boolean | null>(null); // null = default del producto
  const [metaVals, setMetaVals] = React.useState<Record<string, string>>({}); // valores de columnas multiplicador/informativo
  // Productos elegidos por BÚSQUEDA que no están en la carga inicial de 100 (p. ej. CMALA01): se recuerdan
  // aquí para que toda la lógica (precio, columnas, línea) los resuelva igual. Handoff selector-de-linea-sin-buscador.
  const [extra, setExtra] = React.useState<Producto[]>([]);
  const resolve = (pid: string) => extra.find((p) => p.id === pid) ?? catalogo.find((p) => p.id === pid);
  const prod = resolve(prodId);

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
  // Opciones INLINE de un select de captura (nuevo: `render.opciones` en la propia columna; antes los
  // select sacaban sus opciones de un catálogo). Sirve para cualquier select así declarado (p. ej. la ZONA
  // del Protocolo Articular: rodilla|codo|cadera|hombro). Contrato: HANDOFF-zona-protocolo-articular.
  const opcionesDe = (c: ColumnaFacturacion): { value: string; labelKey?: string }[] => {
    const r = c.render as { opciones?: { value: string; labelKey?: string }[] } | null;
    return Array.isArray(r?.opciones) ? r!.opciones : [];
  };
  const esSelectCaptura = (c: ColumnaFacturacion) => c.tipo === "select" && opcionesDe(c).length > 0;

  // Autocálculo Dosis→Cantidad (potes/frascos): al cambiar la Dosis, Cantidad = ceil(dosis×días/unidadesPorEnvase).
  // unidadesPorEnvase (de NTPRODUCTOS.CapsulasXUni) y diasTratamiento vienen del catálogo (BE, en prod);
  // si faltan → cantidad manual, sin autocálculo.
  const capsUnit = prod?.unidadesPorEnvase ?? null;
  const diasTrat = prod?.diasTratamiento ?? 30; // fallback si el producto no tiene el dato
  const dosisClave = capturables.find((c) => /dosis/i.test(c.clave))?.clave ?? null;
  const sugeridoClave = capturables.find((c) => /sugerid/i.test(c.clave))?.clave ?? null;

  // Defaults por columna (modelo del dueño): áreas = 1; días = cantidad (mismas visitas); resto vacío.
  // El valor mostrado = override del usuario (metaVals) ?? default → sin efectos ni setState en render.
  const isArea = (c: string) => /[aá]rea/i.test(c);
  const isDias = (c: string) => /d[ií]a/i.test(c) && !/dosis/i.test(c);
  // áreas = preset del producto (areasDefault ?? 1); días = cantidad (mismas visitas). Data-driven (PR #158).
  const areasDefault = (prod as { areasDefault?: number | null } | undefined)?.areasDefault ?? 1;
  const defMeta = (c: string) => (isArea(c) ? String(areasDefault) : isDias(c) ? cant : "");
  const metaShown = (c: string) => metaVals[c] ?? defMeta(c);

  // Flujo con Enter: cantidad → columnas (áreas, días…) → Enter en la última confirma la línea. La
  // navegación se resuelve por DOM DENTRO del handler (marca `data-flow`), sin refs leídos en render.
  const selectOnFocus = (e: React.FocusEvent<HTMLInputElement>) => e.target.select();
  const onFlowKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const cont = e.currentTarget.closest("[data-addline]");
    const inputs = cont ? Array.from(cont.querySelectorAll<HTMLInputElement>("[data-flow]")) : [];
    const next = inputs[inputs.indexOf(e.currentTarget) + 1];
    if (next) {
      next.focus();
      next.select();
    } else {
      add();
    }
  };

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
      const p = resolve(prodId);
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
  // Requeridos SIN llenar (p. ej. zona): bloquean agregar la línea → el aviso se ve ANTES de guardar.
  const faltanRequeridos = capturables.filter((c) => c.requerido && String(metaShown(c.clave)).trim() === "");
  const canAdd = !!prodId && !disabled && !buscando && faltanRequeridos.length === 0;

  function pick(p: Producto) {
    // Recordar el producto si vino de la búsqueda (no está en los 100 iniciales) → resolve() lo encuentra.
    setExtra((prev) =>
      prev.some((x) => x.id === p.id) || catalogo.some((x) => x.id === p.id) ? prev : [...prev, p],
    );
    setProdId(p.id);
    setGravadoOverride(null); // vuelve al default del nuevo producto
    setMetaVals({});
    setPrecio("");
    // Cantidad = diasTratamiento del pack (TD12→12…). Si el producto no lo trae → campo VACÍO (no 1).
    const dt = (p as { diasTratamiento?: number | null }).diasTratamiento;
    setCant(dt != null ? String(dt) : "");
  }

  function add() {
    if (!prod) return;
    // Solo mandamos `gravado` cuando lo SABEMOS (el producto lo trae) o el cajero lo tocó; si un producto
    // de búsqueda no trae el dato, se OMITE y el BE aplica el default del producto (no forzar «exento»).
    const prodGravado = (prod as { gravado?: boolean | null }).gravado;
    const gravadoKnown = prodGravado != null || gravadoOverride != null;
    const g = gravadoOverride ?? !!prodGravado;
    // Enviar SIEMPRE el precioUnitario resuelto (override del cajero ?? precio del catálogo por-sesión).
    // Si no se envía, el compuesto cae al precio-base (TD12=70) en vez del combo (50) → BE PR láser/precio.
    const precioOverride = precio.trim() === "" ? undefined : Math.max(0, Number(precio) || 0);
    const precioUnitarioEff = precioOverride ?? (precioLista != null ? precioLista : undefined);
    // meta = valores de las columnas de captura (por su clave). Número para multiplicador/informativo
    // (áreas, días…, el server calcula el total) y STRING para los select (p. ej. zona=rodilla).
    const meta: Record<string, number | string> = {};
    capturables.forEach((c) => {
      const raw = metaShown(c.clave); // override del usuario o el default (áreas=1, días=cantidad)
      if (raw == null || raw.trim() === "") return;
      if (esSelectCaptura(c)) { meta[c.clave] = raw; return; } // valor de opción (string)
      if (!Number.isNaN(Number(raw))) meta[c.clave] = Number(raw);
    });
    onAdd({
      productoId: prod.id,
      descripcion: prod.nombre,
      cantidad: Math.max(1, Math.floor(Number(cant) || 1)),
      ...(precioUnitarioEff !== undefined ? { precioUnitario: precioUnitarioEff } : {}),
      // Solo el flag gravado (cuando se conoce): NO se manda impuestoId — el servidor resuelve el impuesto
      // por la cascada del precio (desglose Estatal+Municipal completo). Handoff IVU compuesto.
      ...(gravadoKnown ? { gravado: g } : {}),
      ...(Object.keys(meta).length ? { meta } : {}),
    });
    setProdId(""); setCant("1"); setPrecio(""); setGravadoOverride(null); setMetaVals({});
  }

  return (
    <div data-addline className="grid grid-cols-2 items-end gap-3 rounded-xl border border-dashed p-3 md:flex md:flex-wrap">
      <label className="col-span-2 flex min-w-0 flex-1 flex-col gap-1">
        <Lbl>{t("addItem")}</Lbl>
        <CatalogoCombobox
          catalogoInicial={catalogo}
          selected={prod ?? null}
          tipoPrecioId={tipoPrecioId}
          tenant={tenant}
          disabled={disabled}
          onPick={pick}
        />
      </label>
      {/* Columnas dinámicas del producto (áreas/días/sesiones/dosis) + selects declarados (p. ej. ZONA).
          Van ANTES de Cantidad: primero áreas y días (así se lee «áreas × días»), Cantidad después. El
          Enter fluye producto → áreas → días → Cantidad → Agregar. Handoff descuento-… (posición). */}
      {capturables.map((c) => {
        const requeridoVacio = c.requerido && String(metaShown(c.clave)).trim() === "";
        if (esSelectCaptura(c)) {
          return (
            <label key={c.clave} className="flex w-32 flex-col gap-1">
              <Lbl>{tRoot(c.labelKey)}{c.requerido && <span className="text-destructive"> *</span>}</Lbl>
              <Select value={metaShown(c.clave) || undefined} onValueChange={(v) => setMetaVals((m) => ({ ...m, [c.clave]: v }))}>
                <SelectTrigger className={"h-9 w-full " + (requeridoVacio ? "border-destructive" : "")}>
                  <SelectValue placeholder={t("selectPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {opcionesDe(c).map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.labelKey && tRoot.has(o.labelKey) ? tRoot(o.labelKey) : o.value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          );
        }
        return (
          <label key={c.clave} className="flex w-24 flex-col gap-1">
            <Lbl>{tRoot(c.labelKey)}</Lbl>
            <Input
              data-flow={c.clave === sugeridoClave ? undefined : true}
              value={metaShown(c.clave)}
              onChange={(e) => onMetaChange(c.clave, e.target.value)}
              onFocus={selectOnFocus}
              onKeyDown={onFlowKey}
              readOnly={c.clave === sugeridoClave}
              className={"h-9 text-right tabular-nums " + (c.rol === "informativo" ? "opacity-80 " : "") + (c.clave === sugeridoClave ? "bg-muted" : "")}
              inputMode="decimal"
              placeholder={c.rol === "multiplicador" ? "×" : ""}
            />
          </label>
        );
      })}
      {/* Cantidad DESPUÉS de áreas/días. Con dosis, ya viene pre-calculada; queda editable. */}
      <label className="flex w-20 flex-col gap-1">
        <Lbl>{t("qty")}</Lbl>
        <Input
          data-flow
          value={cant}
          onChange={(e) => setCant(e.target.value)}
          onFocus={selectOnFocus}
          onKeyDown={onFlowKey}
          className="h-9 text-right tabular-nums"
          inputMode="numeric"
        />
      </label>
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

function DescuentoGlobal({ disabled, onApply, applyLabel, subtotal }: { disabled?: boolean; onApply: (tipo: string, valor: number) => void; applyLabel: string; subtotal: number }) {
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
    <div className="space-y-2 rounded-xl border p-4">
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
          placeholder="0"
          aria-invalid={error}
          className={"h-9 flex-1 text-right tabular-nums " + (error ? "border-destructive focus-visible:ring-destructive" : "")}
          inputMode="decimal"
        />
        <Button type="button" variant="outline" size="sm" disabled={disabled || !numOk || error} onClick={() => onApply(tipo, Math.max(0, num))}>{applyLabel}</Button>
      </div>
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

