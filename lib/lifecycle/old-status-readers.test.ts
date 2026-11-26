import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"

import { OLD_STATUS_ALLOWLIST } from "./old-status-allowlist.ts"

/**
 * The blocking scan of release 5d (mirror of cmr-be `appointment-lifecycle/readers/old-status-readers.spec.ts`):
 * an old `status` value may be named only inside `lib/lifecycle/` and in the files OLD_STATUS_ALLOWLIST
 * lists, each pinned at its hit count. Readers name stage groups and labels.
 *
 * Only string literals are read (through the TypeScript parser), so comments never count. A literal
 * counts when it IS an old value (`"presente"`, `` `presente` ``, a JSX attribute), or when its text
 * holds one single-quoted (`IN ('presente','triage')`). `"presenteEn"` is not an old value. An object
 * keyed by two or more old values (`{ presente: 0, asistido: 2 }`) counts its identifier keys too.
 */
const OLD_VALUES = [
  "programada",
  "confirmada",
  "presente",
  "triage",
  "en_consulta",
  "atendida",
  "no_show",
  "cancelada",
  "reprogramada",
  "pendiente",
  "en_terapia",
  "asistido",
] as const

/**
 * Files whose OWN unrelated enum shares a word with the old status, and that read no appointment or
 * session status at all. Each pins the file's hit count: a new hit (an appointment-status read added
 * next to the enum, say) fails until someone looks at it.
 */
const UNRELATED_ENUMS: Readonly<Record<string, { hits: number; reason: string }>> = {
  "app/(app)/patients/legacy-availability/preparation/page.tsx": {
    hits: 3,
    reason: "legacy-availability row state ('pendiente'), not a visit",
  },
  "app/oauth/consent/page.tsx": { hits: 1, reason: "profile approval state ('pendiente'), not a visit" },
  "components/admin/user-access-panel.tsx": { hits: 1, reason: "profile approval state ('pendiente'), not a visit" },
  "lib/api/auth.ts": { hits: 1, reason: "profile approval state ('pendiente'), not a visit" },
  "lib/personal/staff-access.ts": { hits: 1, reason: "profile approval state ('pendiente'), not a visit" },
  "components/facturacion/resumen-paciente-panel.tsx": {
    hits: 1,
    reason: "message key of the unpaid amount ('pendiente'), money, not a visit",
  },
  "components/inventario/transferencias/transferencia-recibir.tsx": {
    hits: 5,
    reason: "stock transfer states ('pendiente', 'cancelada'), not a visit",
  },
  "components/inventario/transferencias/transferencias-list.tsx": {
    hits: 4,
    reason: "stock transfer states ('pendiente', 'cancelada'), not a visit",
  },
  "lib/inventario/transfer-clinics.ts": { hits: 1, reason: "stock transfer state ('pendiente'), not a visit" },
}

/**
 * Exported old-status types the app once had (deleted in 5d). A file that uses one reads the old status
 * without spelling a value, so the literal scan alone cannot see it.
 */
const STATUS_CONSTANTS = new Set(["EstadoCita", "EstadoSesion"])

const REPO_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..")
const SCANNED_DIRS = ["app", "components", "hooks", "lib"]
const EXCLUDED_DIRS = ["lib/lifecycle"]

const toRepoPath = (abs: string): string => relative(REPO_ROOT, abs).split(sep).join("/")

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry)
    if (statSync(abs).isDirectory()) {
      if (!EXCLUDED_DIRS.includes(toRepoPath(abs))) sourceFiles(abs, out)
    } else if (/\.tsx?$/.test(entry) && !entry.endsWith(".test.ts")) {
      out.push(abs)
    }
  }
  return out
}

const WHOLE = new Set<string>(OLD_VALUES)
const INNER = new RegExp(`'(${OLD_VALUES.join("|")})'`, "g")

interface Hit {
  line: number
  value: string
}

const parse = (fileName: string, text: string) =>
  ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, false)

/** Old values named by the string literals of one file (comments are not tokens: never read). */
function oldValuesIn(fileName: string, text: string): Hit[] {
  const source = parse(fileName, text)
  const hits: Hit[] = []
  const add = (node: ts.Node, value: string) =>
    hits.push({ line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, value })
  const visit = (node: ts.Node): void => {
    // A map keyed by old values. Two keys at least, so a single money or count field named
    // `pendiente` is not a status reader. String-literal keys are hits on their own.
    if (ts.isObjectLiteralExpression(node)) {
      const keys = node.properties
        .map((p) => p.name)
        .filter((n): n is ts.Identifier | ts.StringLiteral => !!n && (ts.isIdentifier(n) || ts.isStringLiteral(n)))
        .filter((n) => WHOLE.has(n.text))
      if (keys.length >= 2) for (const k of keys) if (ts.isIdentifier(k)) add(k, k.text)
    }
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      if (WHOLE.has(node.text) && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))) {
        add(node, node.text)
      } else {
        for (const m of node.text.matchAll(INNER)) add(node, m[1])
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return hits
}

/** Every identifier of one file that names an exported old-status type. */
function statusConstantsIn(fileName: string, text: string): Hit[] {
  const source = parse(fileName, text)
  const hits: Hit[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && STATUS_CONSTANTS.has(node.text))
      hits.push({ line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, value: node.text })
    ts.forEachChild(node, visit)
  }
  visit(source)
  return hits
}

/* ---- The scanner itself ----------------------------------------------------------------------- */

const values = (text: string, file = "x.ts") => oldValuesIn(file, text).map((h) => h.value)

test("scanner: finds a whole old value in double quotes, single quotes and backticks", () => {
  assert.deepEqual(values(`a === "presente"; b('asistido'); c(\`triage\`);`), ["presente", "asistido", "triage"])
})

test("scanner: finds single-quoted old values inside query strings and templates", () => {
  assert.deepEqual(values("q(`status IN ('presente','en_terapia') AND x = ${y} AND z <> 'no_show'`);"), [
    "presente",
    "en_terapia",
    "no_show",
  ])
})

test("scanner: ignores words that only contain an old value, and comments", () => {
  assert.deepEqual(values(`// a === "presente"\n/* "asistido" */\nconst k = "presenteEn"; const j = "no_show_rate";`), [])
})

test("scanner: finds JSX attributes and literal types in a .tsx file", () => {
  assert.deepEqual(values(`type T = "cancelada" | "x";\nconst e = <Input placeholder="pendiente" />;`, "x.tsx"), [
    "cancelada",
    "pendiente",
  ])
})

test("scanner: finds an object keyed by two or more old values (identifier keys count)", () => {
  assert.deepEqual(values(`const G = { presente: 0, en_terapia: 0, "asistido": 2, other: 9 };`), [
    "presente",
    "en_terapia",
    "asistido",
  ])
})

test("scanner: ignores an object with a single old-value key (a money or count field)", () => {
  assert.deepEqual(values("const t = { pendiente: 10, pagado: 5 };"), [])
})

test("scanner: finds the old-status types, imported or used", () => {
  assert.deepEqual(
    statusConstantsIn("x.ts", `import { type EstadoCita } from "./c";\nconst x: EstadoCita[] = [];\nconst EstadoCitaX = 1;`).map(
      (h) => h.value,
    ),
    ["EstadoCita", "EstadoCita"],
  )
})

/* ---- The repo ---------------------------------------------------------------------------------- */

const SHARED_WORDS_NOTE =
  "'no_show' and 'triage' are stage group names too: use the named unions of lib/lifecycle/stage-groups.ts " +
  "(NEVER_SEEN, IN_CARE, …) instead of spelling them."

const describeHits = (entries: [string, Hit[]][]) =>
  entries.map(([path, hits]) => `${path}\n${hits.map((h) => `    line ${h.line}: ${h.value}`).join("\n")}`).join("\n")

const found = new Map<string, Hit[]>()
for (const dir of SCANNED_DIRS)
  for (const abs of sourceFiles(join(REPO_ROOT, dir))) {
    const text = readFileSync(abs, "utf8")
    const hits = [...oldValuesIn(abs, text), ...statusConstantsIn(abs, text)]
    if (hits.length) found.set(toRepoPath(abs), hits)
  }

test("every file naming an old value (or an old-status type) is allowlisted or an unrelated enum", () => {
  const offenders = [...found.entries()].filter(
    ([path]) => !(path in OLD_STATUS_ALLOWLIST) && !(path in UNRELATED_ENUMS),
  )
  assert.ok(
    offenders.length === 0,
    `${offenders.length} file(s) name an old status value outside lib/lifecycle/ and are not allowlisted. ` +
      `Read through the stage groups (rowInGroups, rowGroup) and labels (stageLabel) instead. ` +
      `${SHARED_WORDS_NOTE}\n\n${describeHits(offenders)}`,
  )
})

test("every allowlisted file keeps its pinned hit count (the list only shrinks)", () => {
  const problems = Object.entries(OLD_STATUS_ALLOWLIST)
    .filter(([path, { hits }]) => (found.get(path)?.length ?? 0) !== hits)
    .map(
      ([path, { hits }]) =>
        `${path}: ${found.get(path)?.length ?? 0} hit(s), pinned at ${hits}. Fewer: lower the pin or delete ` +
        `the line. More: a new old-value read is not covered by the file's reason; read the stage groups.`,
    )
  assert.ok(problems.length === 0, `Allowlist out of date (lib/lifecycle/old-status-allowlist.ts):\n\n${problems.join("\n")}`)
})

test("every unrelated-enum exemption exists, is not allowlisted, and keeps its hit count", () => {
  const problems: string[] = []
  for (const [path, { hits }] of Object.entries(UNRELATED_ENUMS)) {
    if (!existsSync(join(REPO_ROOT, path))) problems.push(`${path}: no longer exists, delete its exemption`)
    else if (path in OLD_STATUS_ALLOWLIST) problems.push(`${path}: exempted AND allowlisted, keep one`)
    else if ((found.get(path)?.length ?? 0) !== hits)
      problems.push(
        `${path}: ${found.get(path)?.length ?? 0} hit(s), pinned at ${hits}. Check the new or removed ones: ` +
          `an appointment/session status read there is not exempt.`,
      )
  }
  assert.ok(problems.length === 0, `Unrelated-enum exemptions changed:\n\n${problems.join("\n")}`)
})
