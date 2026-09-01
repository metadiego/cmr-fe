"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";

import { getMyCentros, type Centro } from "@/lib/api/centers";
import {
  getFestivos,
  createFestivo,
  updateFestivo,
  deleteFestivo,
  type Festivo,
} from "@/lib/api/festivos";
import { type Scope } from "@/lib/api/cupos";
import { getActiveCentro } from "@/lib/tenant";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const GLOBAL = "__global__";
const SCOPE_KEY = "cmr_agenda_config_scope"; // shared with cupos config

function defaultCentro(centros: Centro[]): string {
  if (centros.length === 0) return "";
  const active = getActiveCentro();
  return active && centros.some((c) => c.id === active) ? active : centros[0].id;
}

// Holiday CRUD for Citas Médicas. Per center or global (needs citas.config.global).
// `bloqueaAgenda` toggles whether the day closes scheduling.
export function FestivosConfig({ year }: { year: number }) {
  const t = useTranslations("agenda");
  const tc = useTranslations("common");
  const { can } = useCan();
  const canGlobal = can("citas.config.global");

  const centrosRes = useResource<Centro[]>(() => getMyCentros());
  const centros = centrosRes.state.kind === "ok" ? centrosRes.state.data : [];

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

  const festivosRes = useResource<Festivo[]>(
    () =>
      scope === "global" || centroId
        ? getFestivos({ anio: year, scope, centroId })
        : Promise.resolve([]),
    [scope, centroId, year],
  );
  const festivos = (festivosRes.state.kind === "ok" ? festivosRes.state.data : [])
    .slice()
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  // New-holiday form.
  const [fecha, setFecha] = React.useState("");
  const [nombre, setNombre] = React.useState("");
  const [recurrente, setRecurrente] = React.useState(false);
  const [bloquea, setBloquea] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  async function add() {
    if (!fecha || !nombre.trim()) return;
    setBusy(true);
    try {
      await createFestivo(
        { fecha, nombre: nombre.trim(), recurrenteAnual: recurrente, bloqueaAgenda: bloquea, scope },
        centroId,
      );
      toast.success(t("festivos.added"));
      setFecha("");
      setNombre("");
      setRecurrente(false);
      setBloquea(true);
      festivosRes.reload();
    } catch (err) {
      toastError(err, t);
    } finally {
      setBusy(false);
    }
  }

  async function toggleBloquea(f: Festivo) {
    try {
      await updateFestivo(f.id, { bloqueaAgenda: !f.bloqueaAgenda, scope }, centroId);
      festivosRes.reload();
    } catch (err) {
      toastError(err, t);
    }
  }

  async function remove(f: Festivo) {
    try {
      await deleteFestivo(f.id, { scope, centroId });
      festivosRes.reload();
    } catch (err) {
      toastError(err, t);
    }
  }

  return (
    <div className="space-y-5">
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
        <span className="ml-auto text-sm text-muted-foreground">{year}</span>
      </div>

      <div className="overflow-x-auto rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">{t("festivos.date")}</th>
              <th className="px-3 py-2 text-left font-medium">{t("festivos.name")}</th>
              <th className="px-3 py-2 text-left font-medium">{t("festivos.blocks")}</th>
              <th className="w-10 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {festivosRes.state.kind === "loading" && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">{tc("loading")}</td>
              </tr>
            )}
            {festivosRes.state.kind === "ok" && festivos.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">{t("festivos.empty")}</td>
              </tr>
            )}
            {festivos.map((f) => (
              <tr key={f.id} className="border-t">
                <td className="px-3 py-1.5 font-mono">{f.fecha}</td>
                <td className="px-3 py-1.5">
                  {f.nombre}
                  {f.recurrenteAnual && (
                    <Badge variant="secondary" className="ml-2">{t("festivos.recurring")}</Badge>
                  )}
                </td>
                <td className="px-3 py-1.5">
                  <label className="inline-flex cursor-pointer items-center gap-2">
                    <Checkbox checked={f.bloqueaAgenda} onCheckedChange={() => toggleBloquea(f)} />
                    <span className={f.bloqueaAgenda ? "text-destructive" : "text-muted-foreground"}>
                      {f.bloqueaAgenda ? t("festivos.closes") : t("festivos.informative")}
                    </span>
                  </label>
                </td>
                <td className="px-3 py-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => remove(f)}
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

      {/* Add holiday */}
      <div className="flex flex-wrap items-end gap-3 rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] p-3">
        <div className="space-y-1">
          <label className="block text-xs text-muted-foreground">{t("festivos.date")}</label>
          <Input type="date" className="h-9 w-40" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div className="min-w-48 flex-1 space-y-1">
          <label className="block text-xs text-muted-foreground">{t("festivos.name")}</label>
          <Input className="h-9" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={t("festivos.namePlaceholder")} />
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 pb-2 text-sm">
          <Checkbox checked={recurrente} onCheckedChange={(v) => setRecurrente(v === true)} />
          {t("festivos.recurring")}
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 pb-2 text-sm">
          <Checkbox checked={bloquea} onCheckedChange={(v) => setBloquea(v === true)} />
          {t("festivos.closes")}
        </label>
        <Button type="button" onClick={add} disabled={busy || !fecha || !nombre.trim()}>
          <HugeiconsIcon icon={Add01Icon} className="size-4" />
          {t("festivos.add")}
        </Button>
      </div>
    </div>
  );
}
