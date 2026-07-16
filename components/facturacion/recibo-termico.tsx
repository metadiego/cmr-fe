"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { Recibo } from "@/lib/factura/build-recibo";

const money = (v: number) => `$${(Number(v) || 0).toFixed(2)}`;

// Local, print-safe date formatting (dd/mm/yyyy + hh:mm) — matches the legacy
// receipt. Falls back to the raw string if unparseable.
function fmtFecha(iso: string): { fecha: string; hora: string } {
  if (!iso) return { fecha: "—", hora: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { fecha: iso, hora: "" };
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    // PR usa formato US: MM/DD/YYYY (no DD/MM).
    fecha: `${p(d.getMonth() + 1)}/${p(d.getDate())}/${d.getFullYear()}`,
    hora: `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`,
  };
}

function Dashed() {
  return <div className="my-1 border-t border-dashed border-black" />;
}

function Line({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className={"flex justify-between gap-2 " + (bold ? "font-bold" : "")}>
      <span className="min-w-0 break-words">{label}</span>
      <span className="shrink-0 tabular-nums">{value}</span>
    </div>
  );
}

// Presentational 80mm thermal receipt. Pure: receives a Recibo, renders paper.
// On screen it shows as a paper preview; print CSS (globals.css, `.recibo-print`)
// isolates it and sizes @page to 80mm. Degrades gracefully with partial data
// (no empresa block / no pagos / no tax) so nothing crashes before the BE lands.
export function ReciboTermico({ recibo }: { recibo: Recibo }) {
  const t = useTranslations("receipt");
  const tRoot = useTranslations();
  const { fecha, hora } = fmtFecha(recibo.fecha);
  // Label de un multiplicador (fac.col.<clave>), data-driven; fallback a la clave.
  const multLabel = (k: string) => (tRoot.has(`fac.col.${k}`) ? tRoot(`fac.col.${k}`) : k);
  const multTexto = (m: Record<string, number>) =>
    Object.entries(m).map(([k, v]) => `${v} ${multLabel(k)}`).join(" × ");
  // Terapias con multiplicadores → leyenda al pie (una por línea).
  const conMultiplicadores = recibo.items.filter((it) => it.multiplicadores && Object.keys(it.multiplicadores).length);
  const emp = recibo.empresa;

  return (
    <div className="recibo-print mx-auto w-[80mm] bg-white px-3 py-4 font-mono text-[11px] leading-tight text-black">
      {recibo.anulada && (
        <div className="mb-1 border border-black py-0.5 text-center text-base font-bold tracking-widest">
          {t("void")}
        </div>
      )}

      {/* Encabezado: logo + empresa/sucursal (o nombre del centro si el bloque
          fiscal aún no llega del BE). */}
      <div className="text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={recibo.logoUrl ?? "/img/logo_cmr.png"}
          alt=""
          className="mx-auto mb-1 max-h-[18mm] w-auto object-contain"
        />
        <div className="text-[13px] font-bold uppercase">{emp?.nombreLegal ?? ""}</div>
        {emp?.nombreComercial && <div>{emp.nombreComercial}</div>}
        {emp?.sucursal && <div>{emp.sucursal}</div>}
        {emp?.direccion && (
          <div className="whitespace-pre-line">{emp.direccion}</div>
        )}
        {emp?.telefono && <div>{emp.telefono}</div>}
        {emp?.registroFiscal && (
          <div>
            {emp.registroFiscalLabel ? `${emp.registroFiscalLabel}: ` : ""}
            {emp.registroFiscal}
          </div>
        )}
      </div>

      <Dashed />

      <div className="flex justify-between font-bold">
        <span>
          {t("invoice")} #{recibo.numeroDisplay}
        </span>
        <span className="font-normal">{fecha}</span>
      </div>

      <Dashed />

      {/* Paciente — rótulo bilingüe por requisito legal (igual que el legacy). */}
      <div className="font-semibold">{t("patientLabelEn")}</div>
      <div className="mb-0.5">{t("patientLabelEs")}</div>
      <div className="font-bold uppercase">{recibo.paciente.nombre || "—"}</div>
      {recibo.paciente.record && (
        <div>
          {t("record")} # {recibo.paciente.record}
        </div>
      )}
      {recibo.paciente.docId && <div>ID {recibo.paciente.docId}</div>}

      <Dashed />

      {/* Líneas */}
      {recibo.items.map((it, i) => (
        <div key={i} className="mb-1">
          <div className="uppercase">{it.descripcion}</div>
          <div className="flex justify-between gap-2">
            <span>
              {it.cantidad}
              {it.multiplicadores && Object.keys(it.multiplicadores).length ? ` (${multTexto(it.multiplicadores)})` : ""}
              {" "}x {money(it.precioUnitario)}
              {it.descuento > 0 ? ` − ${money(it.descuento)}` : ""}
            </span>
            <span className="shrink-0 tabular-nums">{money(it.total)}</span>
          </div>
          {/* "Incluye:" del kit (item.contenido); en compacto no viene. Indentado + fuente menor.
              El precio es de REFERENCIA (no suma al total). */}
          {it.componentes && it.componentes.length > 0 && (
            <div className="mt-0.5 pl-3 text-[0.85em] opacity-80">
              <div className="font-medium">{t("includes")}:</div>
              {it.componentes.map((c, j) => (
                <div key={j} className="flex justify-between gap-2">
                  <span>{c.cantidad} · {c.descripcion}</span>
                  {c.precio != null && <span className="shrink-0 tabular-nums">{money(c.precio)}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <Dashed />

      {/* Totales */}
      <Line label={t("subtotal")} value={money(recibo.subtotal)} />
      {recibo.descuento > 0 && (
        <Line label={t("discount")} value={`− ${money(recibo.descuento)}`} />
      )}
      {recibo.impuestos.length > 0
        ? recibo.impuestos.map((im, i) => (
            <Line
              key={i}
              label={(im.nombre || t("tax")) + (im.tasa != null ? ` (${im.tasa}%)` : "")}
              value={money(im.monto)}
            />
          ))
        : recibo.impuesto > 0 && (
            <Line label={t("tax")} value={money(recibo.impuesto)} />
          )}
      <div className="mt-0.5 border-t border-black pt-0.5">
        <Line label={t("total")} value={money(recibo.total)} bold />
      </div>
      {recibo.montoAbonado > 0 && (
        <Line label={t("paid")} value={money(recibo.montoAbonado)} />
      )}
      {recibo.saldo > 0 && (
        <Line label={t("balance")} value={money(recibo.saldo)} bold />
      )}

      {/* Pagos (pendiente BE: pagos[]) */}
      {recibo.pagos.length > 0 && (
        <>
          <Dashed />
          {recibo.pagos.map((p, i) => (
            <Line
              key={i}
              label={p.formaPagoNombre + (p.referencia ? ` ${p.referencia}` : "")}
              value={money(p.monto)}
            />
          ))}
        </>
      )}

      {recibo.atendidoPor && (
        <>
          <Dashed />
          <div>
            {t("attendedBy")}: {recibo.atendidoPor}
          </div>
        </>
      )}

      {/* Leyenda de terapias con multiplicadores (láser: días × áreas) — una por terapia, data-driven */}
      {conMultiplicadores.length > 0 && (
        <>
          <Dashed />
          <div className="space-y-0.5 text-[10px]">
            {conMultiplicadores.map((it, i) => (
              <div key={i}>* {it.descripcion} — {multTexto(it.multiplicadores!)}</div>
            ))}
          </div>
        </>
      )}

      {/* Pie */}
      <Dashed />
      <div className="text-center">
        <div>{t("thanks")}</div>
        {emp?.pieFactura && (
          <div className="mt-0.5 whitespace-pre-line">{emp.pieFactura}</div>
        )}
        {emp?.web && <div className="mt-0.5">{emp.web}</div>}
        {hora && (
          <div className="mt-0.5">
            {fecha} {hora}
          </div>
        )}
      </div>
    </div>
  );
}
