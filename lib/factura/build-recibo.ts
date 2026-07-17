import type { FacturaConItems, FacturaEmpresa } from "@/lib/api/facturas";

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
  total: number;
  montoAbonado: number;
  saldo: number;
  pagos: { formaPagoNombre: string; monto: number; referencia?: string | null }[];
  atendidoPor?: string;
};

const num = (v: unknown) => Number(v ?? 0);

// Assemble the receipt model from the BE's enriched GET /facturas/:id projection.
// All data travels from the BE (empresa, pagos, emisor, medico, numeroDisplay,
// emitidaEn) — no FE fallbacks/hardcode. numeroDisplay is null on drafts → "—".
// `precios` = mapa productoId→precio de referencia (del catálogo del POS) para el "Incluye:".
// `diasTratamiento` = mapa productoId→visitas del protocolo (producto.diasTratamiento).
export function buildRecibo(
  f: FacturaConItems,
  precios: Record<string, number> = {},
  diasTratamiento: Record<string, number> = {},
): Recibo {
  const items: ReciboItem[] = (f.items ?? []).map((it) => {
    // "Incluye:" del kit desde item.contenido (BE PR #96): disponible en borrador Y emitida.
    // Compacto (imprimeComponentes=false) → contenido:[] (el BE ya lo devuelve vacío).
    const contenido =
      (it as { contenido?: { productoId?: string; nombre?: string; cantidad?: number; nota?: string | null }[] }).contenido ?? [];
    const itemComps = contenido.map((c) => ({
      descripcion: c.nombre ?? "—",
      cantidad: num(c.cantidad),
      ...(c.productoId && precios[c.productoId] != null ? { precio: precios[c.productoId] } : {}),
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
    total,
    montoAbonado,
    saldo: Math.max(0, total - montoAbonado),
    pagos: (f.pagos ?? []).map((p) => ({
      formaPagoNombre: p.formaPagoNombre ?? "—",
      monto: num(p.monto),
      referencia: p.referencia ?? null,
    })),
    // "Atendido por" = quien COBRÓ (emitidoPor) o, si aún es borrador, quien la CREÓ (creadoPor).
    // BE PR #82; `emisor` queda como fallback legacy. NUNCA el médico.
    atendidoPor: f.emitidoPor?.nombre ?? f.creadoPor?.nombre ?? f.emisor?.nombre,
  };
}
