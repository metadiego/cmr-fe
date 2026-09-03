// Genera los tipos en INGLÉS de la v2 a partir del mapa autoritativo del backend
// (cmr-be/src/core/api-ingles/campos.ts). NO es un parche: reescribe las CLAVES de
// propiedad de lib/api/schema.d.ts al inglés que la v2 devuelve de verdad, para que
// tsc avise de cada campo mal leído. Reutilizable tras `gen:api`.
import fs from "node:fs";

const BE = "/Applications/MAMP/htdocs/cmr-be/src/core/api-ingles/campos.ts";
const SCHEMA = "lib/api/schema.d.ts";

const src = fs.readFileSync(BE, "utf8");
// Extraer el objeto CAMPOS_EN_INGLES { es: 'en', ... }
const block = src.slice(src.indexOf("CAMPOS_EN_INGLES"));
const body = block.slice(block.indexOf("{") + 1, block.indexOf("\n};"));
const MAP = {};
for (const m of body.matchAll(/^\s*([A-Za-z0-9_]+):\s*'([^']+)'/gm)) MAP[m[1]] = m[2];
console.log("campos en el mapa:", Object.keys(MAP).length);

let schema = fs.readFileSync(SCHEMA, "utf8");
let hits = 0;
// Renombrar SOLO líneas de clave de propiedad: `    <clave>?: ` o `    "<clave>"?: `.
// Las claves españolas solo aparecen como campos reales (las claves estructurales de
// openapi son inglesas), así que el renombre global por el mapa es seguro.
schema = schema.replace(
  /^(\s*)(["']?)([A-Za-z0-9_]+)\2(\??):/gm,
  (full, indent, q, key, opt) => {
    if (Object.prototype.hasOwnProperty.call(MAP, key)) {
      hits++;
      return `${indent}${q}${MAP[key]}${q}${opt}:`;
    }
    return full;
  },
);
console.log("claves de propiedad renombradas:", hits);
fs.writeFileSync(SCHEMA, schema);
