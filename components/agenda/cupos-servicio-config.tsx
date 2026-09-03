"use client";

import * as React from "react";
import { useTranslations, useLocale } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";

import { getMyCentros, type Centro } from "@/lib/api/centers";
import { getServicios, type Servicio } from "@/lib/api/servicios";
import { getCupos, createCupo, updateCupo, deleteCupo, type Cupo, type Scope } from "@/lib/api/cupos";
import { getAgendaHoras, type AgendaHora } from "@/lib/api/frontdesk";
import { getActiveCentro } from "@/lib/tenant";
import { toastError } from "@/lib/api/errors";
import { weekdayLabel, WEEKDAYS_MON_FIRST } from "@/lib/i18n/weekdays";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const GLOBAL = "__global__";
const DEFAULT_COL = "default"; // diaSemana = null → base permanente (todos los días)
const SCOPE_KEY = "cmr_cupos_serv_scope";

function defaultCentro(centros: Centro[]): string {
  if (centros.length === 0) return "";
  const active = getActiveCentro();
  return active && centros.some((c) => c.id === active) ? active : centros[0].id;
}

// Firma de los cupos en vista → fuerza remonte de la grilla tras guardar (resync sin valores viejos).
function sig(cupos: Cupo[]): string {
  return cupos.map((c) => `${c.id}:${c.dayOfWeek ?? "d"}:${c.time}:${c.quantity}`).sort().join(",");
}

/**
 * "Cupos por hora" POR SERVICIO (frontdesk: láser, vitc…). Grilla semanal editable
 * (filas = franjas horarias, columnas = Default + Lun–Dom) con vista previa en vivo del
 * efecto (GET /frontdesk/agenda). 100% dato (CRUD /citas/cupos con servicioId). Multi-tenant
 * por centro + scope global. Gate `citas.config` (lo aplica la página). NO duplica el
 * `CuposConfig` de tipos de cita: distinto eje (hora×día por servicio) y con preview.
 */
export function CuposServicioConfig() {
  const t = useTranslations("agenda");
  const tc = useTranslations("common");
  const { can } = useCan();
  const canGlobal = can("citas.config.global");

  const centrosRes = useResource<Centro[]>(() => getMyCentros());
  const centros = centrosRes.state.kind === "ok" ? centrosRes.state.data : [];

  // Scope (persistido): un centro o GLOBAL (todos).
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

  // Servicios (chips). Solo activos; el cupo es del servicio de frontdesk.
  const servRes = useResource<Servicio[]>(() => (centroId ? getServicios(centroId) : getServicios()), [centroId]);
  const servicios = React.useMemo(
    () =>
      (servRes.state.kind === "ok" ? servRes.state.data : [])
        .filter((s) => s.active !== false)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)),
    [servRes.state],
  );
  const [servSel, setServSel] = React.useState<string>("");
  const servicioId = servicios.some((s) => s.id === servSel) ? servSel : servicios[0]?.id ?? "";
  const servicio = servicios.find((s) => s.id === servicioId) ?? null;

  // Cupos del scope (todos): se filtran por servicio + recurrentes (fecha null) para la grilla semanal.
  const cuposRes = useResource<Cupo[]>(
    () => (scope === "global" || centroId ? getCupos({ scope, centroId }) : Promise.resolve([])),
    [scope, centroId],
  );
  const cupos = cuposRes.state.kind === "ok" ? cuposRes.state.data : [];
  const cuposServicio = cupos.filter((c) => c.serviceId === servicioId && c.date == null);

  const loading = centrosRes.state.kind === "loading" || servRes.state.kind === "loading" || cuposRes.state.kind === "loading";

  return (
    <div className="space-y-5">
      {/* Scope + servicio */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">{t("cupos.center")}</span>
        <Select value={scopeSel} onValueChange={pickScope}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            {centros.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            {canGlobal && <SelectItem value={GLOBAL}>{t("cupos.allCenters")}</SelectItem>}
          </SelectContent>
        </Select>
        {scope === "global" && <span className="text-xs text-muted-foreground">{t("cupos.globalHint")}</span>}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {servicios.map((s) => {
          const activo = s.id === servicioId;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setServSel(s.id)}
              className={
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors " +
                (activo ? "border-primary bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:text-foreground")
              }
            >
              {s.color && <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />}
              {s.name}
            </button>
          );
        })}
      </div>

      {loading && <p className="text-sm text-muted-foreground">{tc("loading")}</p>}

      {!loading && servicio && (
        <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
          <SemanaGrid
            key={`${scope}|${centroId ?? "g"}|${servicioId}|${sig(cuposServicio)}`}
            scope={scope}
            centroId={centroId}
            servicioId={servicioId}
            cupos={cuposServicio}
            onSaved={cuposRes.reload}
          />
          <Preview servicioClave={servicio.slug ?? ""} centroId={centroId} />
        </div>
      )}
      {!loading && !servicio && <p className="text-sm text-muted-foreground">{t("cupos.noServicios")}</p>}
    </div>
  );
}

// Columnas de la grilla: Default (diaSemana null) + Lun–Dom.
type ColKey = string; // "default" | "0".."6"
function columnas(): { key: ColKey; dia: number | null }[] {
  return [{ key: DEFAULT_COL, dia: null }, ...WEEKDAYS_MON_FIRST.map((d) => ({ key: String(d), dia: d }))];
}

type Cell = { id?: string; value: string };
// `todos` = la fila aplica a TODOS los días (se guarda como Default, diaSemana null). Atajo del usuario.
type Row = { hora: string; cells: Record<ColKey, Cell>; todos: boolean };

function buildRows(cupos: Cupo[]): Row[] {
  const cols = columnas();
  const horas = [...new Set(cupos.map((c) => c.time))].sort();
  const rows = new Map<string, Row>();
  for (const hora of horas) {
    rows.set(hora, { hora, todos: false, cells: Object.fromEntries(cols.map((c) => [c.key, { value: "" } as Cell])) });
  }
  for (const c of cupos) {
    const colKey = c.dayOfWeek == null ? DEFAULT_COL : String(c.dayOfWeek);
    const cell = rows.get(c.time)?.cells[colKey];
    if (cell) { cell.id = c.id; cell.value = String(c.quantity); }
  }
  // "Todos" = la hora solo tiene Default y ningún valor por día (aplica a todos por igual).
  for (const r of rows.values()) {
    const soloDefault = !!r.cells[DEFAULT_COL].value && WEEKDAYS_MON_FIRST.every((d) => !r.cells[String(d)].value);
    r.todos = soloDefault;
  }
  return [...rows.values()];
}

function SemanaGrid({
  scope,
  centroId,
  servicioId,
  cupos,
  onSaved,
}: {
  scope: Scope;
  centroId?: string;
  servicioId: string;
  cupos: Cupo[];
  onSaved: () => void;
}) {
  const t = useTranslations("agenda");
  const tc = useTranslations("common");
  const locale = useLocale();
  const cols = columnas();
  const [rows, setRows] = React.useState<Row[]>(() => buildRows(cupos));
  const [newHora, setNewHora] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  function setCell(hora: string, col: ColKey, value: string) {
    setRows((rs) => rs.map((r) => (r.hora === hora ? { ...r, cells: { ...r.cells, [col]: { ...r.cells[col], value } } } : r)));
  }
  // Marca/desmarca "todos los días". Al marcar, si Default está vacío, toma el primer valor por día
  // (el que el usuario haya escrito) y lo vuelve el Default → aplica a lunes-domingo.
  function toggleTodos(hora: string, checked: boolean) {
    setRows((rs) =>
      rs.map((r) => {
        if (r.hora !== hora) return r;
        if (!checked) return { ...r, todos: false };
        let def = r.cells[DEFAULT_COL].value;
        if (!def) {
          const primer = WEEKDAYS_MON_FIRST.map((d) => r.cells[String(d)].value).find((v) => v.trim() !== "");
          if (primer) def = primer;
        }
        return { ...r, todos: true, cells: { ...r.cells, [DEFAULT_COL]: { ...r.cells[DEFAULT_COL], value: def } } };
      }),
    );
  }
  function addRow() {
    const hora = newHora.trim();
    if (!hora || rows.some((r) => r.hora === hora)) return;
    setRows((rs) => [...rs, { hora, todos: true, cells: Object.fromEntries(cols.map((c) => [c.key, { value: "" } as Cell])) }].sort((a, b) => a.hora.localeCompare(b.hora)));
    setNewHora("");
  }

  async function save() {
    setSaving(true);
    const ops: Promise<unknown>[] = [];
    const upsertCol = (r: Row, col: { key: ColKey; dia: number | null }) => {
      const cell = r.cells[col.key];
      const raw = cell.value.trim();
      const n = raw === "" ? 0 : Number(raw);
      const valid = Number.isFinite(n) && n > 0;
      if (cell.id) {
        if (!valid) ops.push(deleteCupo(cell.id, { scope, centroId }));
        else ops.push(updateCupo(cell.id, { quantity: n, scope }, centroId));
      } else if (valid) {
        ops.push(createCupo({ time: r.hora, serviceId: servicioId, quantity: n, scope, ...(col.dia != null ? { dayOfWeek: col.dia } : {}) }, centroId));
      }
    };
    for (const r of rows) {
      if (r.todos) {
        // "Todos los días" → guarda SOLO el Default (diaSemana null) y borra los cupos por día de esa hora.
        upsertCol(r, { key: DEFAULT_COL, dia: null });
        for (const d of WEEKDAYS_MON_FIRST) {
          const cell = r.cells[String(d)];
          if (cell.id) ops.push(deleteCupo(cell.id, { scope, centroId }));
        }
      } else {
        for (const col of cols) upsertCol(r, col);
      }
    }
    if (ops.length === 0) { setSaving(false); return; }
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
              {cols.map((c) => (
                <th key={c.key} className="px-2 py-2 text-center font-medium capitalize">
                  {c.dia == null ? t("cupos.defaultDay") : weekdayLabel(locale, c.dia, "short")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={cols.length + 1} className="px-3 py-4 text-center text-muted-foreground">{t("cupos.empty")}</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.hora} className="border-t">
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono">{r.hora}</span>
                    <span className="inline-flex items-center gap-1.5" title={t("cupos.todosHint")}>
                      <Switch checked={r.todos} onCheckedChange={(v) => toggleTodos(r.hora, v)} aria-label={t("cupos.todos")} />
                      <span className="text-[11px] text-muted-foreground">{t("cupos.todos")}</span>
                    </span>
                  </div>
                </td>
                {cols.map((c) => {
                  const esDia = c.dia != null;
                  const mirror = r.todos && esDia;
                  return (
                    <td key={c.key} className="px-1.5 py-1.5">
                      <Input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        disabled={mirror}
                        className={"h-8 w-14 text-center" + (mirror ? " border-dashed text-muted-foreground" : "")}
                        value={mirror ? r.cells[DEFAULT_COL]?.value ?? "" : r.cells[c.key]?.value ?? ""}
                        onChange={(e) => setCell(r.hora, c.key, e.target.value)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">{t("cupos.serviceHint")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Input type="time" className="h-9 w-32" value={newHora} onChange={(e) => setNewHora(e.target.value)} />
        <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={!newHora}>
          <HugeiconsIcon icon={Add01Icon} className="size-4" />
          {t("cupos.addHour")}
        </Button>
        <div className="ml-auto">
          <Button type="button" onClick={save} disabled={saving}>{saving ? tc("saving") : tc("save")}</Button>
        </div>
      </div>
    </div>
  );
}

// Vista previa en vivo del efecto de los cupos para una fecha (GET /frontdesk/agenda).
function Preview({ servicioClave, centroId }: { servicioClave: string; centroId?: string }) {
  const t = useTranslations("agenda");
  const [fecha, setFecha] = React.useState("");
  const horasRes = useResource<AgendaHora[]>(
    () => (servicioClave && fecha ? getAgendaHoras(servicioClave, fecha, centroId).then((r) => r.horas ?? []) : Promise.resolve([])),
    [servicioClave, fecha, centroId],
  );
  const horas = horasRes.state.kind === "ok" ? horasRes.state.data : [];
  return (
    <aside className="h-fit rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] p-4 lg:sticky lg:top-6">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("cupos.previewTitle")}</span>
      <Input type="date" className="mt-2 h-9" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      {!fecha && <p className="mt-3 text-xs text-muted-foreground">{t("cupos.previewPick")}</p>}
      {fecha && horasRes.state.kind === "loading" && <p className="mt-3 text-xs text-muted-foreground">…</p>}
      {fecha && horas.length > 0 && (
        <div className="mt-3 space-y-1">
          {horas.map((h) => (
            <div key={h.time} className="flex items-center justify-between rounded px-2 py-1 text-xs tabular-nums odd:bg-background/60">
              <span className="font-mono">{h.time}</span>
              <span className={h.vacios <= 0 ? "text-destructive" : "text-success-foreground"}>
                {t("cupos.previewCell", { agendadas: h.agendadas, cupo: h.cupo, vacios: h.vacios })}
              </span>
            </div>
          ))}
        </div>
      )}
      {fecha && horasRes.state.kind === "ok" && horas.length === 0 && (
        <p className="mt-3 text-xs text-muted-foreground">{t("cupos.previewEmpty")}</p>
      )}
    </aside>
  );
}
