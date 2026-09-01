"use client";

import * as React from "react";
import { useTranslations, useLocale } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";

import { getMyCentros, type Centro } from "@/lib/api/centers";
import { getTiposCita, type TipoCita } from "@/lib/api/citas";
import {
  getCupos,
  createCupo,
  updateCupo,
  deleteCupo,
  type Cupo,
  type Scope,
} from "@/lib/api/cupos";
import { getActiveCentro } from "@/lib/tenant";
import { toastError } from "@/lib/api/errors";
import { weekdayLabel, WEEKDAYS_MON_FIRST } from "@/lib/i18n/weekdays";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const GLOBAL = "__global__";
const DEFAULT_DAY = "default"; // diaSemana = null
const SCOPE_KEY = "cmr_agenda_config_scope"; // persist center/global choice

interface EditContext {
  scope: Scope;
  centroId?: string;
  diaSemana?: number; // recurring-by-weekday mode (undefined + no fecha = default)
  fecha?: string; // one-off date-override mode
}

function defaultCentro(centros: Centro[]): string {
  if (centros.length === 0) return "";
  const active = getActiveCentro();
  return active && centros.some((c) => c.id === active) ? active : centros[0].id;
}

// Signature of a cupo set → forces the grid to remount when server data changes
// (so it resyncs after a save instead of showing stale typed values).
function sig(cupos: Cupo[]): string {
  return cupos
    .map((c) => `${c.id}:${c.cantidad}`)
    .sort()
    .join(",");
}

// Slice C (v2) — hourly capacity ("cupos"): recurring by weekday (+ a global
// default) or one-off per date, per center or global. On a specific center the
// grid shows the inherited global default (dimmed) so it's never empty; editing
// a value creates a center override. Gated `citas.config`; the global scope needs
// `citas.config.global`.
export function CuposConfig() {
  const t = useTranslations("agenda");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { can } = useCan();
  const canGlobal = can("citas.config.global");

  const centrosRes = useResource<Centro[]>(() => getMyCentros());
  const centros = centrosRes.state.kind === "ok" ? centrosRes.state.data : [];
  const tiposRes = useResource<TipoCita[]>(() => getTiposCita());
  const tipos = (tiposRes.state.kind === "ok" ? tiposRes.state.data : []).filter(
    (t) => t.activo,
  );

  // Scope selector (persisted): a center id, or GLOBAL (all centers).
  const [picked, setPicked] = React.useState<string | null>(null);
  const [restored, setRestored] = React.useState(false);
  if (!restored && typeof window !== "undefined") {
    setRestored(true);
    const saved = window.localStorage.getItem(SCOPE_KEY);
    if (saved) setPicked(saved);
  }
  function pickScope(v: string) {
    setPicked(v);
    if (typeof window !== "undefined") window.localStorage.setItem(SCOPE_KEY, v);
  }
  const scopeSel = picked ?? defaultCentro(centros);
  const scope: Scope = scopeSel === GLOBAL ? "global" : "centro";
  const centroId = scope === "global" ? undefined : scopeSel;

  const [mode, setMode] = React.useState<"weekday" | "fecha">("weekday");
  const [daySel, setDaySel] = React.useState<string>(DEFAULT_DAY);
  const [fecha, setFecha] = React.useState<string>("");

  const context: EditContext = React.useMemo(() => {
    if (mode === "fecha") return { scope, centroId, fecha };
    return { scope, centroId, diaSemana: daySel === DEFAULT_DAY ? undefined : Number(daySel) };
  }, [mode, scope, centroId, fecha, daySel]);

  // Own rows for the selected scope.
  const cuposRes = useResource<Cupo[]>(
    () => (scope === "global" || centroId ? getCupos({ scope, centroId }) : Promise.resolve([])),
    [scope, centroId],
  );
  // Global rows, used to show inheritance when a specific center is selected.
  const globalRes = useResource<Cupo[]>(
    () => (scope === "centro" ? getCupos({ scope: "global" }) : Promise.resolve([])),
    [scope],
  );
  const allCupos = cuposRes.state.kind === "ok" ? cuposRes.state.data : [];
  const globalCupos = globalRes.state.kind === "ok" ? globalRes.state.data : [];

  const inView = (c: Cupo) =>
    c.tipoCitaId != null && // esta grilla es de tipos de cita; los cupos de servicio se gestionan aparte
    (mode === "fecha"
      ? c.fecha === fecha
      : c.fecha == null &&
        (daySel === DEFAULT_DAY ? c.diaSemana == null : c.diaSemana === Number(daySel)));

  const viewCupos = allCupos.filter(inView);
  // Inheritance only applies to a center's DEFAULT view (inherits the global default).
  const showsInheritance =
    scope === "centro" && mode === "weekday" && daySel === DEFAULT_DAY;
  const inheritedView = showsInheritance
    ? globalCupos.filter((c) => c.fecha == null && c.diaSemana == null)
    : [];

  const loading =
    centrosRes.state.kind === "loading" ||
    tiposRes.state.kind === "loading" ||
    cuposRes.state.kind === "loading" ||
    (scope === "centro" && globalRes.state.kind === "loading");
  const gridReady = !loading && tipos.length > 0 && (mode !== "fecha" || !!fecha);

  const isException = mode === "fecha" || daySel !== DEFAULT_DAY;

  return (
    <div className="space-y-5">
      {/* Scope: center / all centers */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">{t("cupos.center")}</span>
        <Select value={scopeSel} onValueChange={pickScope}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            {centros.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
            ))}
            {canGlobal && <SelectItem value={GLOBAL}>{t("cupos.allCenters")}</SelectItem>}
          </SelectContent>
        </Select>
        {scope === "global" && (
          <span className="text-xs text-muted-foreground">{t("cupos.globalHint")}</span>
        )}
      </div>

      {/* Mode: recurring weekday / one-off date */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border p-0.5">
          {(["weekday", "fecha"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={
                "rounded-md px-3 py-1 text-sm transition-colors " +
                (mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")
              }
            >
              {t(m === "weekday" ? "cupos.byWeekday" : "cupos.byDate")}
            </button>
          ))}
        </div>

        {mode === "weekday" ? (
          <div className="flex flex-wrap gap-1">
            <DayChip active={daySel === DEFAULT_DAY} onClick={() => setDaySel(DEFAULT_DAY)}>
              {t("cupos.defaultDay")}
            </DayChip>
            {WEEKDAYS_MON_FIRST.map((d) => (
              <DayChip key={d} active={daySel === String(d)} onClick={() => setDaySel(String(d))}>
                {weekdayLabel(locale, d, "short")}
              </DayChip>
            ))}
          </div>
        ) : (
          <Input type="date" className="h-9 w-44" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        )}
      </div>

      {/* Contextual explainer */}
      {mode === "weekday" && daySel === DEFAULT_DAY && (
        <p className="text-sm text-muted-foreground">
          {scope === "global" ? t("cupos.defaultHint") : t("cupos.centerDefaultHint")}
        </p>
      )}
      {isException && (
        <p className="text-sm text-muted-foreground">{t("cupos.exceptionHint")}</p>
      )}
      {mode === "fecha" && !fecha && (
        <p className="text-sm text-muted-foreground">{t("cupos.pickDate")}</p>
      )}

      {loading && <p className="text-sm text-muted-foreground">{tc("loading")}</p>}

      {gridReady && (
        <CuposGrid
          key={`${scope}|${centroId ?? "g"}|${mode}|${mode === "fecha" ? fecha : daySel}|${sig(viewCupos)}|${sig(inheritedView)}`}
          context={context}
          cupos={viewCupos}
          inherited={inheritedView}
          tipos={tipos}
          onSaved={() => {
            cuposRes.reload();
            globalRes.reload();
          }}
        />
      )}
    </div>
  );
}

function DayChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "min-w-11 rounded-md border px-2.5 py-1 text-sm capitalize transition-colors " +
        (active
          ? "border-primary bg-primary/10 font-medium text-primary"
          : "text-muted-foreground hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}

// A cell carries its own row id (if the current scope has one) plus the inherited
// value (from the global default) so we can render it dimmed and revert to it.
type Cell = { id?: string; value: string; inherited: number | null };
type Row = { hora: string; cells: Record<string, Cell> };

function buildRows(cupos: Cupo[], inherited: Cupo[], tipos: TipoCita[]): Row[] {
  const horas = new Set<string>([...cupos, ...inherited].map((c) => c.hora));
  const rows = new Map<string, Row>();
  for (const hora of [...horas].sort()) {
    rows.set(hora, {
      hora,
      cells: Object.fromEntries(
        tipos.map((t) => [t.id, { value: "", inherited: null } as Cell]),
      ),
    });
  }
  for (const c of inherited) {
    if (!c.tipoCitaId) continue; // esta grilla es de tipos de cita; ignora cupos de servicio
    const cell = rows.get(c.hora)?.cells[c.tipoCitaId];
    if (cell) {
      cell.inherited = c.cantidad;
      cell.value = String(c.cantidad);
    }
  }
  for (const c of cupos) {
    if (!c.tipoCitaId) continue;
    const cell = rows.get(c.hora)?.cells[c.tipoCitaId];
    if (cell) {
      cell.id = c.id;
      cell.value = String(c.cantidad);
    }
  }
  return [...rows.values()];
}

function CuposGrid({
  context,
  cupos,
  inherited,
  tipos,
  onSaved,
}: {
  context: EditContext;
  cupos: Cupo[];
  inherited: Cupo[];
  tipos: TipoCita[];
  onSaved: () => void;
}) {
  const t = useTranslations("agenda");
  const tc = useTranslations("common");
  const [rows, setRows] = React.useState<Row[]>(() => buildRows(cupos, inherited, tipos));
  const [newHora, setNewHora] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const hasInherited = inherited.length > 0;

  function setCell(hora: string, tipoId: string, value: string) {
    setRows((rs) =>
      rs.map((r) =>
        r.hora === hora
          ? { ...r, cells: { ...r.cells, [tipoId]: { ...r.cells[tipoId], value } } }
          : r,
      ),
    );
  }

  function removeRow(hora: string) {
    setRows((rs) => rs.filter((r) => r.hora !== hora));
  }

  function addRow() {
    const hora = newHora.trim();
    if (!hora || rows.some((r) => r.hora === hora)) return;
    setRows((rs) =>
      [
        ...rs,
        {
          hora,
          cells: Object.fromEntries(
            tipos.map((t) => [t.id, { value: "", inherited: null } as Cell]),
          ),
        },
      ].sort((a, b) => a.hora.localeCompare(b.hora)),
    );
    setNewHora("");
  }

  async function save() {
    setSaving(true);
    const { scope, centroId, diaSemana, fecha } = context;
    const ops: Promise<unknown>[] = [];

    for (const r of rows) {
      for (const tipo of tipos) {
        const cell = r.cells[tipo.id];
        if (!cell) continue;
        const raw = cell.value.trim();
        const n = raw === "" ? 0 : Number(raw);
        const valid = Number.isFinite(n) && n > 0;

        if (cell.id) {
          // Existing own row.
          if (!valid || (cell.inherited != null && n === cell.inherited)) {
            // 0/blank, or reverted to the inherited value → drop the override.
            ops.push(deleteCupo(cell.id, { scope, centroId }));
          } else {
            ops.push(updateCupo(cell.id, { cantidad: n, scope }, centroId));
          }
        } else if (valid && n !== cell.inherited) {
          // No own row and value differs from inherited → create an override.
          ops.push(
            createCupo(
              {
                hora: r.hora,
                tipoCitaId: tipo.id,
                cantidad: n,
                scope,
                ...(diaSemana != null ? { diaSemana } : {}),
                ...(fecha ? { fecha } : {}),
              },
              centroId,
            ),
          );
        }
      }
    }

    try {
      await Promise.all(ops);
      toast.success(t("cupos.saved"));
      onSaved();
    } catch (err) {
      toastError(err, t);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">{t("cupos.hour")}</th>
              {tipos.map((tipo) => (
                <th key={tipo.id} className="px-3 py-2 text-left font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: tipo.color }} />
                    {tipo.nombre}
                  </span>
                </th>
              ))}
              <th className="w-10 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={tipos.length + 2} className="px-3 py-4 text-center text-muted-foreground">
                  {t("cupos.empty")}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.hora} className="border-t">
                <td className="px-3 py-1.5 font-mono">{r.hora}</td>
                {tipos.map((tipo) => {
                  const cell = r.cells[tipo.id];
                  const dimmed = !cell?.id && cell?.inherited != null;
                  return (
                    <td key={tipo.id} className="px-3 py-1.5">
                      <Input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        className={"h-8 w-20" + (dimmed ? " border-dashed text-muted-foreground" : "")}
                        value={cell?.value ?? ""}
                        onChange={(e) => setCell(r.hora, tipo.id, e.target.value)}
                      />
                    </td>
                  );
                })}
                <td className="px-3 py-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => removeRow(r.hora)}
                    className="text-muted-foreground transition-colors hover:text-destructive"
                    aria-label={tc("delete")}
                  >
                    <HugeiconsIcon icon={Delete02Icon} className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasInherited && (
        <p className="text-xs text-muted-foreground">{t("cupos.inheritedLegend")}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Input type="time" className="h-9 w-32" value={newHora} onChange={(e) => setNewHora(e.target.value)} />
        <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={!newHora}>
          <HugeiconsIcon icon={Add01Icon} className="size-4" />
          {t("cupos.addHour")}
        </Button>
        <div className="ml-auto">
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? tc("saving") : tc("save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
