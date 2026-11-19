import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Enforcement for CLAUDE.md rule 9 ("Live screens, and the one that stays the reference"): the
// general service viewer must be governed by patient-desk's own ServiceSessionsTable + usePatientDay
// + useServiceBoards, never a parallel copy. Without a guard like this the rule is a habit, not a
// gate — it was already broken once (cmr-fe #139, first built against the deprecated frontdesk-board,
// then rebuilt against the live screen). This fails the moment the viewer starts fetching on its own,
// rendering FilaSesion directly, or calling a lib/api function outside the shared hooks.
const VIEWER_PATH = "components/frontdesk/service-board-viewer.tsx";

test("ServiceBoardViewer usa usePatientDay + useServiceBoards + ServiceSessionsTable, nada propio", () => {
  const texto = readFileSync(VIEWER_PATH, "utf8");

  for (const requerido of [
    /from "@\/hooks\/use-patient-day"/,
    /\busePatientDay\b/,
    /\buseServiceBoards\b/,
    /from "@\/components\/patient-desk\/service-sessions-table"/,
    /<ServiceSessionsTable\b/,
  ]) {
    assert.match(texto, requerido, `falta ${requerido} — debe consumir el MISMO hook/tabla que patient-desk`);
  }

  // No debe pintar FilaSesion por su cuenta: ESO es exactamente lo que se rompió la primera vez
  // (sinSaldo={false} hardcodeado) y lo que ServiceSessionsTable ya resuelve.
  assert.ok(!texto.includes("<FilaSesion"), "renderiza <FilaSesion> directamente — debe pasar por ServiceSessionsTable");
  assert.ok(
    !/from "@\/components\/frontdesk\/fila-sesion"/.test(texto),
    "importa fila-sesion.tsx directamente — debe pasar por ServiceSessionsTable",
  );

  // No debe armar su propia plomería de datos: ni useResource/useCitaStream sueltos, ni una llamada
  // de lib/api que no sea un import de TIPO (import type/los tipos no ejecutan nada en runtime).
  assert.ok(!/\buseResource\b/.test(texto), "usa useResource directamente — la data debe venir de usePatientDay/useServiceBoards");
  assert.ok(!/\buseCitaStream\b/.test(texto), "se suscribe a SSE por su cuenta — usePatientDay ya lo hace");

  // Cada import es su PROPIA sentencia, hasta su propio `;` — nunca una sola regex sobre el texto
  // entero, que puede "saltar" de un import sin type a un `}` de un import type DISTINTO más abajo y
  // leer mal cuál de los dos es cuál.
  const importStmts = [...texto.matchAll(/^import\s[\s\S]*?;/gm)].map((m) => m[0]);
  const llamadasReales = importStmts
    .filter((s) => !/^import\s+type\s+/.test(s))
    .map((s) => s.match(/from\s+"@\/lib\/api\/([^"]+)"/)?.[1])
    .filter((x): x is string => !!x);
  assert.deepEqual(
    llamadasReales,
    [],
    `importa funciones de la API directamente (${llamadasReales.join(", ")}) — solo tipos (import type) están permitidos, toda lectura/escritura pasa por los hooks compartidos`,
  );
});

test("ServiceBoardViewer no pasa literales hardcodeados a ServiceSessionsTable", () => {
  const texto = readFileSync(VIEWER_PATH, "utf8");

  const inicio = texto.indexOf("<ServiceSessionsTable");
  assert.ok(inicio >= 0, "no se encontró <ServiceSessionsTable en el visor");
  const fin = texto.indexOf("/>", inicio);
  const bloque = texto.slice(inicio, fin);

  const LITERAL = /^(true|false|null|undefined|\[\]|""|'')$/;
  const fallos: string[] = [];
  for (const linea of bloque.split("\n")) {
    const m = linea.match(/^\s*([A-Za-z]+)=\{(.+)\}\s*$/);
    if (!m) continue;
    const [, prop, valor] = m;
    if (LITERAL.test(valor.trim())) fallos.push(`${prop}={${valor.trim()}}`);
  }
  assert.deepEqual(
    fallos,
    [],
    `<ServiceSessionsTable> recibe un literal hardcodeado en vez de un valor de los hooks compartidos: ${fallos.join(", ")}`,
  );
});
