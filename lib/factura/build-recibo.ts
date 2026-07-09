import type { FacturaConItems } from "@/lib/api/facturas";

// Fiscal/branch block that must travel from the BE (per sucursal). Null until the
// BE ships it (see docs/specs/factura-datos-impresion-handoff-be.md) → the header
// degrades to the center name. NO hardcoded company data here.
export type ReciboEmpresa = {
  nombreLegal: string;
  registroFiscal?: string | null;
  registroFiscalLabel?: string | null; // "MN" (PR) / "RIF" / "EIN" — comes from BE
  telefono?: string | null;
  direccion?: string | null;
  sucursal?: string | null;
  web?: string | null;
  pieFactura?: string | null;
} | null;

export type ReciboItem = {
  cantidad: number;
  descripcion: string;
  precioUnitario: number;
  descuento: number;
  total: number;
};

// Presentational model consumed by <ReciboTermico>. Assembled ONCE here from the
// dynamic invoice contract so the same receipt works for consulta/productos/servicios.
export type Recibo = {
  empresa: ReciboEmpresa;
  centroNombre?: string;
  numeroDisplay: string;
  fecha: string;
  estado: string;
  anulada: boolean;
  paciente: { nombre: string; record?: string | null; docId?: string | null };
  items: ReciboItem[];
  subtotal: number;
  descuento: number;
  impuesto: number;
  impuestos: { nombre: string; monto: number }[];
  total: number;
  montoAbonado: number;
  saldo: number;
  pagos: { formaPagoNombre: string; monto: number; referencia?: string | null }[];
  atendidoPor?: string;
};

const num = (v: unknown) => Number(v ?? 0);

// Legacy format: serie + 7-digit zero-padded number. Prefer the BE's preformatted
// `numeroDisplay` once it ships (F2), so the format stays configurable server-side.
function numeroDisplay(f: FacturaConItems): string {
  const pre = (f as { numeroDisplay?: string }).numeroDisplay;
  if (pre) return pre;
  if (f.numero == null) return "—";
  const padded = String(f.numero).padStart(7, "0");
  return f.serie ? `${f.serie}-${padded}` : padded;
}

export function buildRecibo(
  f: FacturaConItems,
  opts: { empresa?: ReciboEmpresa; centroNombre?: string } = {},
): Recibo {
  const items: ReciboItem[] = (f.items ?? []).map((it) => ({
    cantidad: num(it.cantidad),
    descripcion: it.descripcion ?? "—",
    precioUnitario: num(it.precioUnitario),
    descuento: num(it.descuento),
    total: num(it.total) || num(it.cantidad) * num(it.precioUnitario),
  }));
  const subtotal = num(f.subtotal) || items.reduce((s, it) => s + it.total, 0);
  const descuento = num(f.descuento);
  const impuesto = num(f.impuesto);
  const total = num(f.total) || Math.max(0, subtotal - descuento + impuesto);
  const montoAbonado = num(f.montoAbonado);

  // Tax breakdown if the BE projects it (products); consulta has none.
  const impuestosRaw =
    (f as { impuestos?: { nombre?: string; label?: string; monto?: number }[] })
      .impuestos ?? [];
  const impuestos = impuestosRaw
    .map((i) => ({ nombre: i.nombre ?? i.label ?? "", monto: num(i.monto) }))
    .filter((i) => i.monto > 0);

  // pagos[] / emisor / emitidaEn are pending BE (F2); read defensively so the
  // receipt still renders (empty blocks are hidden by the component).
  const pagosRaw =
    (f as {
      pagos?: { formaPagoNombre?: string; monto?: number; referencia?: string | null }[];
    }).pagos ?? [];
  const emisor = (f as { emisor?: { nombre?: string } }).emisor?.nombre;
  const emitidaEn = (f as { emitidaEn?: string }).emitidaEn;

  const pac = f.paciente as
    | { nombres?: string; apellidos?: string | null; record?: string | null; docId?: string | null }
    | null
    | undefined;

  return {
    empresa: opts.empresa ?? null,
    centroNombre: opts.centroNombre,
    numeroDisplay: numeroDisplay(f),
    fecha: emitidaEn ?? f.fecha ?? f.createdAt ?? "",
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
    total,
    montoAbonado,
    saldo: Math.max(0, total - montoAbonado),
    pagos: pagosRaw.map((p) => ({
      formaPagoNombre: p.formaPagoNombre ?? "—",
      monto: num(p.monto),
      referencia: p.referencia ?? null,
    })),
    atendidoPor: f.medico?.nombre ?? emisor,
  };
}
