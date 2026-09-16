import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// La carpeta dinámica se llama `[date]` y la página leía `params.fecha`: el valor llegaba
// `undefined`, el BE contestaba 400 y la vista-día del call-center no cargaba nunca
// (16-sep-2026). El nombre del segmento es el de la CARPETA; leerlo con otro no falla al
// compilar, así que hace falta esta red.
function paginas(dir: string, acc: string[] = []): string[] {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) paginas(ruta, acc);
    else if (nombre === "page.tsx") acc.push(ruta);
  }
  return acc;
}

test("useParams lee el MISMO nombre que la carpeta dinámica", () => {
  const fallos: string[] = [];
  for (const pagina of paginas("app")) {
    const texto = readFileSync(pagina, "utf8");
    if (!texto.includes("useParams")) continue;
    // Segmentos dinámicos de la ruta: app/(app)/x/[date]/page.tsx → ["date"]
    const segmentos = [...pagina.matchAll(/\[([^\]\.]+)\]/g)].map((m) => m[1]);
    if (!segmentos.length) continue;
    // Claves leídas: params.date, params.id…
    const leidas = [...texto.matchAll(/params\.([A-Za-z0-9_]+)/g)].map((m) => m[1]);
    for (const clave of leidas) {
      if (!segmentos.includes(clave)) {
        fallos.push(`${pagina}: lee params.${clave} pero la ruta declara [${segmentos.join("], [")}]`);
      }
    }
  }
  assert.deepEqual(fallos, []);
});
