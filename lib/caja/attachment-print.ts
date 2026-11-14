// Settlements escaneado como página(s) extra del mismo trabajo de impresión de «Imprimir cuadre» (owner,
// 14-nov-2026): solo si el cuadre TIENE adjuntos — sin ellos, `attachmentPagesHtml` devuelve "" y la hoja
// impresa queda exactamente igual que siempre. Foto → <img>, PDF del escaneo → <iframe> (el visor de PDF
// del navegador imprime su contenido junto con el resto). `data-attach` marca cada uno para que quien
// llama espere su load/error antes de llamar a print() — ver components/caja/cuadre-detalle.tsx.
function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

export const ATTACHMENT_PRINT_CSS = `
.attach-page{page-break-before:always}
.attach-page img.attach-asset{max-width:100%;display:block;margin:0 auto}
.attach-page iframe.attach-asset{width:100%;height:100vh;border:none;display:block}
`;

export function attachmentPagesHtml(attachments: Array<{ url: string | null; contentType: string }>): string {
  return attachments
    .filter((a) => a.url)
    .map((a, i) =>
      a.contentType === "application/pdf"
        ? `<div class="attach-page"><iframe src="${esc(a.url)}" class="attach-asset" data-attach="${i}"></iframe></div>`
        : `<div class="attach-page"><img src="${esc(a.url)}" class="attach-asset" data-attach="${i}"></div>`,
    )
    .join("");
}
