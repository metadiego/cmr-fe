"use client";

import * as React from "react";
import { useTranslations, useLocale } from "next-intl";

import type { Paciente } from "@/lib/api/pacientes";
import { createCita, getTiposCita, type TipoCita } from "@/lib/api/citas";
import { getOpciones, type Opcion } from "@/lib/api/tablero";
import { toastError } from "@/lib/api/errors";
import { PacienteSelect } from "@/components/citas/paciente-select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

const NO_MEDICO = "__none__";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtHoy(iso: string, locale: string): string {
  const d = new Date(iso + "T00:00:00");
  return Number.isNaN(d.getTime())
    ? iso
    : new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-PR", { weekday: "short", day: "numeric", month: "short", timeZone: "America/Puerto_Rico" }).format(d);
}

// Walk-in: agrega un paciente al tablero de HOY como cita CONFIRMADA (entra al
// board; BE sella confirmadaEn). Reusa PacienteSelect. tenant-scoped, RBAC en el
// botón que lo abre (citas.create). fecha = hoy (fija). Ver POST /citas (estado).
export function AgregarCitaModal({
  tablero,
  centroId,
  onClose,
  onSaved,
}: {
  tablero: string;
  centroId?: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const t = useTranslations("agregarCita");
  const tRoot = useTranslations();
  const locale = useLocale();
  const hoy = todayISO();

  const [tipos, setTipos] = React.useState<TipoCita[]>([]);
  const [medicos, setMedicos] = React.useState<Opcion[]>([]);
  const [paciente, setPaciente] = React.useState<Paciente | null>(null);
  const [tipoId, setTipoId] = React.useState<string>("");
  const [esPrimeraVez, setEsPrimeraVez] = React.useState(false);
  const [medicoId, setMedicoId] = React.useState<string>(NO_MEDICO);
  const [hora, setHora] = React.useState<string>("");
  const [notas, setNotas] = React.useState<string>("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    getTiposCita().then((ts) => active && setTipos(ts)).catch(() => {});
    getOpciones(tablero, "medico", centroId).then((o) => active && setMedicos(o)).catch(() => {});
    return () => {
      active = false;
    };
  }, [tablero, centroId]);

  const tipo = tipos.find((x) => x.id === tipoId);
  const medicoRequerido = !!tipo?.requiereMedico && !esPrimeraVez;
  const canSubmit = !!paciente && !!tipoId && (!medicoRequerido || medicoId !== NO_MEDICO) && !busy;

  async function onGuardar() {
    if (!paciente || !tipoId) return;
    setBusy(true);
    try {
      await createCita(
        {
          pacienteId: paciente.id,
          tipoCitaId: tipoId,
          fecha: hoy,
          estado: "confirmada", // entra al tablero de atención de hoy
          esPrimeraVez,
          ...(medicoId !== NO_MEDICO ? { medicoId } : {}),
          ...(hora ? { hora } : {}),
          ...(notas.trim() ? { notas: notas.trim() } : {}),
        } as Parameters<typeof createCita>[0],
        centroId,
      );
      onSaved?.();
      onClose();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <div className="relative bg-gradient-to-br from-primary/12 via-primary/5 to-transparent px-6 pt-6 pb-5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-primary/80">{t("eyebrow")}</span>
          <div className="flex items-center justify-between gap-3 pr-8">
            <DialogTitle className="text-xl leading-tight tracking-tight">{t("title")}</DialogTitle>
            <span className="shrink-0 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">
              {t("today")} · {fmtHoy(hoy, locale)}
            </span>
          </div>
          <DialogDescription className="mt-0.5 text-xs">{t("subline")}</DialogDescription>
        </div>

        <div className="space-y-4 px-6 py-5">
          <Field label={t("patient")}>
            <PacienteSelect value={paciente} onChange={setPaciente} />
          </Field>

          <Field label={t("type")}>
            <div className="flex flex-wrap gap-1.5">
              {tipos.map((tp) => {
                const active = tp.id === tipoId;
                const c = tp.color ?? undefined;
                return (
                  <button
                    key={tp.id}
                    type="button"
                    onClick={() => setTipoId(tp.id)}
                    aria-pressed={active}
                    className={
                      "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors " +
                      (active ? "" : "border-input text-muted-foreground hover:border-primary/50 hover:text-foreground")
                    }
                    style={active && c ? { borderColor: c, color: c, backgroundColor: `${c}1a` } : undefined}
                  >
                    {tp.nombre}
                  </button>
                );
              })}
            </div>
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("doctor") + (medicoRequerido ? " *" : "")}>
              <Select value={medicoId} onValueChange={setMedicoId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("noDoctor")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_MEDICO}>{t("noDoctor")}</SelectItem>
                  {medicos.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("time")}>
              <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
            </Field>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={esPrimeraVez} onCheckedChange={(v) => setEsPrimeraVez(v === true)} />
            {t("firstTime")}
          </label>

          <Field label={t("notes")}>
            <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder={t("notesPlaceholder")} rows={2} />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-2 border-t bg-muted/30 px-6 py-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button type="button" onClick={onGuardar} disabled={!canSubmit}>
            {t("save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
