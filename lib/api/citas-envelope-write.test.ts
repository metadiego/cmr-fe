import test from "node:test"
import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

// Handoff citas-envelope-write-sweep (28-nov-2026): `createCita`/`reagendarCita` (lib/api/citas.ts)
// silently drop `meta.advertencias` — a BE warning (an appointment auto-moved off a Sunday or closing
// holiday, an overlap let through under "advertir") reaches no one. Two screens shipped on these before
// this rule existed (next-appointment-cell.tsx, nueva-cita-modal.tsx) and lost every warning they
// returned; this is the gate so a THIRD never ships quietly. Every caller outside citas.ts itself must
// use the envelope-aware siblings instead: `crearCitaAgenda`/`reagendarCitaAgenda`.
const REPO_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..")
const SCANNED_DIRS = ["app", "components", "hooks", "lib"]
// The plain functions still exist here on purpose: `createCita`/`reagendarCita` are kept for the rare
// caller with no warnings to lose (dry runs, tests), and `crearCitaAgenda`/`reagendarCitaAgenda` are
// themselves defined here, naming the plain ones as their own implementation detail.
const EXEMPT = new Set(["lib/api/citas.ts"])

const toRepoPath = (abs: string): string => relative(REPO_ROOT, abs).split(sep).join("/")

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry)
    if (statSync(abs).isDirectory()) sourceFiles(abs, out)
    else if (/\.tsx?$/.test(entry) && !entry.endsWith(".test.ts")) out.push(abs)
  }
  return out
}

// Word-boundary + immediate `(`, so `crearCitaAgenda(`/`reagendarCitaAgenda(` never match.
const PLAIN_WRITE_CALL = /\b(createCita|reagendarCita)\(/

test("createCita/reagendarCita (the plain, warning-dropping writes) are called only inside citas.ts", () => {
  const offenders: string[] = []
  for (const dir of SCANNED_DIRS)
    for (const abs of sourceFiles(join(REPO_ROOT, dir))) {
      const path = toRepoPath(abs)
      if (EXEMPT.has(path)) continue
      if (PLAIN_WRITE_CALL.test(readFileSync(abs, "utf8"))) offenders.push(path)
    }
  assert.deepEqual(
    offenders,
    [],
    `${offenders.length} file(s) call the plain createCita/reagendarCita, which drop meta.advertencias. ` +
      `Use crearCitaAgenda/reagendarCitaAgenda (lib/api/citas.ts) and show the warnings with mostrarAvisos.\n` +
      offenders.join("\n"),
  )
})
