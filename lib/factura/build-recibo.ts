import type { FacturaConItems, FacturaEmpresa, ReciboDevolucion } from "@/lib/api/facturas";

// Fiscal/branch block, projected by the BE per sucursal (getById `empresa`). NO
// hardcoded company data here.
export type ReciboEmpresa = FacturaEmpresa | null;

export type ReciboItem = {
  cantidad: number; // EFECTIVA (base × multiplicadores). Para láser: 24, no la base 1.
  descripcion: string;
  precioUnitario: number;
  descuento: number;
  total: number;
  // "Incluye:" de un kit (item.contenido, disponible en borrador+emitida). Vacío = compacto.
  // `precio` = REFERENCIA (mapeado del catálogo por productoId); NO suma al total.
  // `nota` = programación/protocolo del componente (PR #100), opcional.
  componentes?: { descripcion: string; cantidad: number; precio?: number; nota?: string | null }[];
  // Duración del protocolo del kit en visitas (producto.diasTratamiento), si aplica.
  protocoloVisitas?: number;
  // Multiplicadores (láser: {dias:12, areas:2}) — el label lo resuelve el recibo (fac.col.<clave>).
  multiplicadores?: Record<string, number>;
};

// Presentational model consumed by <ReciboTermico>. Assembled ONCE here from the
// dynamic invoice contract so the same receipt works for consulta/productos/servicios.
export type Recibo = {
  empresa: ReciboEmpresa;
  logoUrl: string | null;
  // "factura" (por defecto) o "devolucion" → el encabezado dice "Factura #" vs "Devolución #".
  tipoDocumento?: "factura" | "devolucion";
  numeroDisplay: string;
  fecha: string;
  estado: string;
  anulada: boolean;
  paciente: { nombre: string; record?: string | null; docId?: string | null };
  items: ReciboItem[];
  subtotal: number;
  descuento: number;
  impuesto: number;
  impuestos: { nombre: string; tasa?: number; monto: number }[];
  envio: number; // envío/flete sumado al total DESPUÉS del impuesto (0 = sin envío → no se imprime)
  total: number;
  montoAbonado: number;
  saldo: number;
  // `clave` = clave estable de la forma (efectivo/cheque/…) para traducir el label en el recibo; el
  // `formaPagoNombre` (español) queda de fallback para formas personalizadas.
  pagos: { formaPagoNombre: string; clave?: string | null; monto: number; referencia?: string | null }[];
  atendidoPor?: string;
};

const num = (v: unknown) => Number(v ?? 0);

// Assemble the receipt model from the BE's enriched GET /facturas/:id projection.
// All data travels from the BE (empresa, pagos, emisor, medico, numeroDisplay,
// emitidaEn) — no FE fallbacks/hardcode. numeroDisplay is null on drafts → "—".
// `diasTratamiento` = mapa productoId→visitas del protocolo (producto.diasTratamiento).
export function buildRecibo(
  f: FacturaConItems,
  diasTratamiento: Record<string, number> = {},
  // Mapa formaPagoId → clave (del catálogo) para traducir la forma en el recibo. Opcional.
  clavePorFormaId: Record<string, string> = {},
): Recibo {
  const items: ReciboItem[] = (f.items ?? []).map((it) => {
    // "Incluye:" del kit desde item.contenido (BE PR #96): disponible en borrador Y emitida.
    // Compacto (imprimeComponentes=false) → contenido:[] (el BE ya lo devuelve vacío).
    // El PRECIO viene RESUELTO en contenido[].precio (cascada centro→global→base, BE #99) → leerlo
    // tal cual; NO mapear del catálogo (que solo tiene precios por-centro y omitía componentes).
    const contenido =
      (it as { contenido?: { productoId?: string; nombre?: string; cantidad?: number; precio?: number | null; nota?: string | null }[] }).contenido ?? [];
    const itemComps = contenido.map((c) => ({
      descripcion: c.nombre ?? "—",
      cantidad: num(c.cantidad),
      ...(c.precio != null ? { precio: num(c.precio) } : {}),
      ...(c.nota ? { nota: c.nota } : {}),
    }));
    const visitas = it.productoId ? diasTratamiento[String(it.productoId)] : undefined;
    // Multiplicadores (láser: áreas×días) → cantidad EFECTIVA = base × Π(multiplicadores).
    const mult = (it.meta as { multiplicadores?: Record<string, number> } | null | undefined)?.multiplicadores;
    const multiplicadores = mult && Object.keys(mult).length ? mult : undefined;
    const base = num(it.cantidad) || 1;
    const cantEfectiva = multiplicadores
      ? Object.values(multiplicadores).reduce((p, v) => p * (Number(v) || 1), base)
      : num(it.cantidad);
    return {
      cantidad: cantEfectiva,
      descripcion: it.descripcion ?? "—",
      precioUnitario: num(it.precioUnitario),
      descuento: num(it.descuento),
      total: num(it.total) || num(it.cantidad) * num(it.precioUnitario),
      ...(itemComps.length ? { componentes: itemComps } : {}),
      ...(itemComps.length && visitas ? { protocoloVisitas: visitas } : {}),
      ...(multiplicadores ? { multiplicadores } : {}),
    };
  });
  const subtotal = num(f.subtotal) || items.reduce((s, it) => s + it.total, 0);
  const descuento = num(f.descuento);
  const impuesto = num(f.impuesto);
  const total = num(f.total) || Math.max(0, subtotal - descuento + impuesto);
  const montoAbonado = num(f.montoAbonado);

  // Tax breakdown when the BE projects it (products); consulta has none.
  const impuestosRaw =
    (f as { impuestos?: { nombre?: string; label?: string; tasa?: number; monto?: number }[] })
      .impuestos ?? [];
  const impuestos = impuestosRaw
    .map((i) => ({ nombre: i.nombre ?? i.label ?? "", tasa: i.tasa, monto: num(i.monto) }))
    .filter((i) => i.monto > 0);

  const pac = f.paciente;

  return {
    empresa: f.empresa ?? null,
    // Per-branch logo enables distinct brands; null → the FE default asset.
    logoUrl: f.empresa?.logoUrl ?? null,
    numeroDisplay: f.numeroDisplay ?? "—",
    fecha: f.emitidaEn ?? f.fecha ?? f.createdAt ?? "",
    estado: String(f.estado ?? ""),
    anulada: String(f.estado ?? "") === "anulada",
    paciente: {
      nombre: pac ? [pac.nombres, pac.apellidos].filter(Boolean).join(" ") : "",
      record: pac?.record ?? null,
      docId: pac?.docId ?? null,
    },
    items,
    subtotal,
    descuento,
    impuesto,
    impuestos,
    envio: num((f as { envio?: number }).envio),
    total,
    montoAbonado,
    saldo: Math.max(0, total - montoAbonado),
    pagos: (f.pagos ?? []).map((p) => ({
      formaPagoNombre: p.formaPagoNombre ?? "—",
      clave: p.formaPagoId ? clavePorFormaId[String(p.formaPagoId)] : undefined,
      monto: num(p.monto),
      referencia: p.referencia ?? null,
    })),
    // "Atendido por" = quien COBRÓ (emitidoPor) o, si aún es borrador, quien la CREÓ (creadoPor).
    // BE PR #82; `emisor` queda como fallback legacy. NUNCA el médico.
    atendidoPor: f.emitidoPor?.nombre ?? f.creadoPor?.nombre ?? f.emisor?.nombre,
  };
}

// Recibo PROPIO de una devolución (BE PR #113), reusando <ReciboTermico>. El encabezado dice
// "Devolución #D-000001". El BE no manda el nombre del producto en el ítem → lo resolvemos con
// `nombres` (facturaItemId → descripción) desde la factura de origen. Los `pagos` muestran el REEMBOLSO
// (forma + monto). Sin abonado/saldo (no aplica a una devolución).
export function buildReciboDevolucion(
  d: ReciboDevolucion,
  nombres: Record<string, string> = {},
  // Mapa nombre-de-forma → clave (el recibo del BE trae la forma de reembolso como nombre, no id).
  clavePorFormaNombre: Record<string, string> = {},
): Recibo {
  const items: ReciboItem[] = (d.items ?? []).map((it) => {
    const base = num(it.monto);
    const cant = num(it.cantidad) || 1;
    return {
      cantidad: num(it.cantidad),
      descripcion: nombres[it.facturaItemId] ?? "—",
      precioUnitario: cant ? base / cant : base,
      descuento: 0,
      total: base, // base pre-impuesto por línea; el impuesto va al pie, igual que la factura
    };
  });
  const total = num(d.montoDevuelto);
  const impuesto = num(d.impuestoDevuelto);
  const subtotal = total - impuesto;
  const pac = d.paciente;

  return {
    empresa: d.empresa ?? null,
    logoUrl: d.empresa?.logoUrl ?? null,
    tipoDocumento: "devolucion",
    numeroDisplay: d.numeroDisplay ?? "—",
    fecha: d.fecha ?? "",
    estado: String(d.estado ?? ""),
    anulada: String(d.estado ?? "") === "anulada",
    paciente: {
      nombre: pac ? [pac.nombres, pac.apellidos].filter(Boolean).join(" ") : "",
      record: pac?.record ?? null,
      docId: pac?.docId ?? null,
    },
    items,
    subtotal,
    descuento: 0,
    impuesto,
    impuestos: [],
    envio: 0,
    total,
    montoAbonado: 0,
    saldo: 0,
    // El reembolso se muestra como "pago" del recibo (forma + monto), si el BE ya lo resolvió.
    pagos: d.formaReembolso
      ? [{ formaPagoNombre: d.formaReembolso, clave: clavePorFormaNombre[d.formaReembolso], monto: total }]
      : [],
    atendidoPor: d.emisor?.nombre ?? undefined,
  };
}
