import { money } from "./totales.ts";

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

export type DocumentoImpreso = {
  id: string;
  number: string | null;
  patient: string | null;
  medicalRecordNumber: string | null;
  formaPago: string | null;
  total: number;
  user?: { id: string; name: string | null } | null;
  division?: "general" | "consulta";
};

export type DocumentosPorDivision = {
  general: { count: number; total: number };
  consulta: { count: number; total: number };
  total: { count: number; total: number };
};

export type DocumentosPrintLabels = {
  documentos: string;
  ventaGeneral: string;
  consultas: string;
  totalVentaGeneral: string;
  totalConsultas: string;
  totalGeneralDocumentos: string;
  colNumero: string;
  colRecord: string;
  colPaciente: string;
  colFacturo: string;
  colFormaPago: string;
  colTotal: string;
};

// «Documentos del día» impreso (handoff documentos-del-dia-por-division, BE #613): el cuadre TOTAL
// lo parte en «Venta general» / «Consultas» (cada documento trae su `division`) + un total general;
// una sola división o un cajero, una sola tabla — en los dos casos con su total al pie, el que da el
// BE (`documentosPorDivision`), nunca recalculado salvo que falte (BE viejo, respaldo sumando la
// lista visible). Extraído de components/caja/cuadre-detalle.tsx (ceiling).
export function documentosPrintHtml(documentos: DocumentoImpreso[], porDivision: DocumentosPorDivision | undefined, L: DocumentosPrintLabels): string {
  const suma = (lista: DocumentoImpreso[]) => lista.reduce((sum, d) => sum + Number(d.total ?? 0), 0);
  const tabla = (lista: DocumentoImpreso[], totalLabel: string, total: number) =>
    `<table>
       <thead><tr><th>${esc(L.colNumero)}</th><th>${esc(L.colRecord)}</th><th>${esc(L.colPaciente)}</th><th>${esc(L.colFacturo)}</th><th>${esc(L.colFormaPago)}</th><th class="r">${esc(L.colTotal)}</th></tr></thead>
       <tbody>${
         lista.length
           ? lista
               .map(
                 (d) =>
                   `<tr><td class="mono">${esc(d.number || "—")}</td><td class="mono dim">${esc(d.medicalRecordNumber || "")}</td><td>${esc(d.patient || "—")}</td><td>${esc(d.user?.name || "—")}</td><td class="mono">${esc(d.formaPago || "—")}</td><td class="r mono">${esc(money(d.total))}</td></tr>`,
               )
               .join("")
           : `<tr><td colspan="6" class="dim">—</td></tr>`
       }</tbody>
       <tfoot><tr class="tot"><td colspan="5" class="r">${esc(totalLabel)}</td><td class="r mono">${esc(money(total))}</td></tr></tfoot>
     </table>`;

  const conDivision = documentos.some((d) => d.division);
  const head = `<h2>${esc(L.documentos)} (${documentos.length})</h2>`;
  if (!conDivision) return `${head}${tabla(documentos, L.colTotal, porDivision?.total.total ?? suma(documentos))}`;

  const general = documentos.filter((d) => d.division === "general");
  const consulta = documentos.filter((d) => d.division === "consulta");
  return `${head}
    <h2>${esc(L.ventaGeneral)} (${porDivision?.general.count ?? general.length})</h2>
    ${tabla(general, L.totalVentaGeneral, porDivision?.general.total ?? suma(general))}
    <h2>${esc(L.consultas)} (${porDivision?.consulta.count ?? consulta.length})</h2>
    ${tabla(consulta, L.totalConsultas, porDivision?.consulta.total ?? suma(consulta))}
    <div class="res"><table class="res"><tbody><tr class="var"><td>${esc(L.totalGeneralDocumentos)}</td><td class="r mono">${esc(money(porDivision?.total.total ?? suma(documentos)))}</td></tr></tbody></table></div>`;
}
