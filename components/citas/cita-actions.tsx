"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";

import {
  confirmarCita,
  presenteCita,
  noShowCita,
  cancelarCita,
  reagendarCita,
  getTiposCita,
  getHistorial,
  type Cita,
  type EstadoCita,
  type TipoCita,
  type CitaEvento,
} from "@/lib/api/citas";
import { getMyCentros, type Centro } from "@/lib/api/centers";
import { getMedicos, type Personal } from "@/lib/api/personal";
import { getAgendaDia, type AgendaDia } from "@/lib/api/agenda-dia";
import { toastError } from "@/lib/api/errors";
import { useCan } from "@/hooks/use-can";
import { useMe } from "@/hooks/use-me";
import { useResource } from "@/hooks/use-resource";
import { useEstados } from "@/hooks/use-estados";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Scheduling-flow actions allowed from each state (slice 2). Clinical states
// (triage/en_consulta → vitals/consult) are handled in slice 3.
const ACTIONS: Record<EstadoCita, string[]> = {
  programada: ["confirmar", "reagendar", "noShow", "cancelar"],
  confirmada: ["presente", "reagendar", "noShow", "cancelar"],
  presente: ["cancelar"],
  triage: ["cancelar"],
  en_consulta: ["cancelar"],
  atendida: [],
  no_show: [],
  cancelada: [],
  reprogramada: [],
};

export function CitaActions({
  cita,
  onChanged,
}: {
  cita: Cita;
  onChanged: () => void;
}) {
  const t = useTranslations("appointments.actions");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const { can } = useCan();
  const centroId = cita.clinicId ?? undefined;

  const [busy, setBusy] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [reagOpen, setReagOpen] = React.useState(false);
  const [noShowOpen, setNoShowOpen] = React.useState(false);
  const [histOpen, setHistOpen] = React.useState(false);
  const [motivo, setMotivo] = React.useState("");

  const actions = ACTIONS[cita.estado] ?? [];
  // Show the menu whenever the user can act OR at least view history.
  if (!can("citas.update") && !can("citas.read")) return null;

  async function run(fn: () => Promise<unknown>, after?: () => void) {
    setBusy(true);
    try {
      await fn();
      toast.success(t("done"));
      after?.();
      onChanged();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={busy} aria-label={t("menu")}>
            <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {actions.includes("confirmar") && (
            <DropdownMenuItem onSelect={() => run(() => confirmarCita(cita.id, centroId))}>
              {t("confirmar")}
            </DropdownMenuItem>
          )}
          {actions.includes("presente") && (
            <DropdownMenuItem onSelect={() => run(() => presenteCita(cita.id, centroId))}>
              {t("presente")}
            </DropdownMenuItem>
          )}
          {actions.includes("reagendar") && (
            <DropdownMenuItem onSelect={() => setReagOpen(true)}>
              {t("reagendar")}
            </DropdownMenuItem>
          )}
          {actions.includes("noShow") && (
            <DropdownMenuItem onSelect={() => setNoShowOpen(true)}>
              {t("noShow")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setHistOpen(true)}>
            {t("historial")}
          </DropdownMenuItem>
          {actions.includes("cancelar") && (
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => setCancelOpen(true)}
            >
              {t("cancelar")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Cancel — requires a reason */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("cancelTitle")}</DialogTitle>
            <DialogDescription>{t("cancelHelp")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>{t("reason")}</Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={busy}>
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={busy || !motivo.trim()}
              onClick={() =>
                run(
                  () => cancelarCita(cita.id, motivo.trim(), centroId),
                  () => {
                    setCancelOpen(false);
                    setMotivo("");
                  },
                )
              }
            >
              {t("cancelar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule / move — own component, mounted only when open (avoids per-row fetches) */}
      {reagOpen && (
        <RescheduleDialog
          cita={cita}
          onClose={() => setReagOpen(false)}
          onDone={() => {
            setReagOpen(false);
            onChanged();
          }}
        />
      )}

      {/* History / audit trail — mounted only when open */}
      {histOpen && <HistorialDialog cita={cita} onClose={() => setHistOpen(false)} />}

      {/* No-show — confirm */}
      <AlertDialog open={noShowOpen} onOpenChange={setNoShowOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("noShowTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("noShowHelp")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                run(() => noShowCita(cita.id, centroId), () => setNoShowOpen(false));
              }}
            >
              {t("noShow")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Reschedule / cross-center move. Mounted only when open, so its data fetches
// (centros, tipos, medicos, destination availability) run once per open — not
// per table row. Reagendar records the audit trail (motivo + antes/después).
function RescheduleDialog({
  cita,
  onClose,
  onDone,
}: {
  cita: Cita;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("appointments.actions");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const { can } = useCan();
  const me = useMe();
  const actorId = me.kind === "ok" ? me.me.personalId ?? undefined : undefined;

  const centrosRes = useResource<Centro[]>(() => getMyCentros());
  const centros = centrosRes.state.kind === "ok" ? centrosRes.state.data : [];
  const tiposRes = useResource<TipoCita[]>(() => getTiposCita());
  const tipos = tiposRes.state.kind === "ok" ? tiposRes.state.data : [];
  const medicosRes = useResource<Personal[]>(() => getMedicos());
  const medicos = medicosRes.state.kind === "ok" ? medicosRes.state.data : [];

  const [centro, setCentro] = React.useState(cita.clinicId ?? "");
  const [fecha, setFecha] = React.useState(cita.fecha);
  const [hora, setHora] = React.useState(cita.hora ?? "");
  const [medico, setMedico] = React.useState(cita.medicoId ?? "");
  const [motivo, setMotivo] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const canMulti = can("citas.multicentro");
  const crossCentro = !!centro && centro !== cita.clinicId;
  const esSeguimiento = tipos.find((x) => x.id === cita.tipoCitaId)?.clave === "seguimiento";
  const medicoRequired = crossCentro && esSeguimiento;

  function pickCentro(v: string) {
    setCentro(v);
    // Moving a follow-up to another center clears the doctor (must pick one there).
    if (v !== cita.clinicId && esSeguimiento) setMedico("");
  }

  // Destination-day availability. reagendar does NOT enforce cupo — this is only
  // a hint + a "use the next free hour" shortcut.
  const agendaRes = useResource<AgendaDia | null>(
    () => (centro && fecha ? getAgendaDia(fecha, { centroId: centro }) : Promise.resolve(null)),
    [centro, fecha],
  );
  const availability = React.useMemo(() => {
    const data = agendaRes.state.kind === "ok" ? agendaRes.state.data : null;
    const c = data?.centros?.[0];
    if (!c) return null;
    const vaciosOf = (fr: { tipos: { tipoCitaId: string; vacios: number }[] }) =>
      fr.tipos.find((tp) => tp.tipoCitaId === cita.tipoCitaId)?.vacios ?? 0;
    const here = c.franjas.find((fr) => fr.hora === hora);
    const vacios = here ? vaciosOf(here) : 0;
    const next =
      c.franjas
        .filter((fr) => fr.hora && vaciosOf(fr) > 0)
        .map((fr) => fr.hora as string)
        .sort()
        .find((h) => h >= hora) ?? null;
    return { vacios, next };
  }, [agendaRes.state, hora, cita.tipoCitaId]);

  const origen = centros.find((c) => c.id === cita.clinicId)?.nombre ?? cita.clinicId ?? "";
  const destino = centros.find((c) => c.id === centro)?.nombre ?? centro;

  const canSubmit =
    !!fecha &&
    !!motivo.trim() &&
    (!medicoRequired || !!medico) &&
    (!crossCentro || tiposRes.state.kind === "ok") &&
    !busy;

  async function submit() {
    setBusy(true);
    try {
      await reagendarCita(
        cita.id,
        {
          fecha,
          hora: hora || undefined,
          motivo: motivo.trim(),
          centroId: crossCentro ? centro : undefined,
          medicoId: crossCentro && medico ? medico : undefined,
          actorId,
        },
        cita.clinicId ?? undefined,
      );
      toast.success(t("done"));
      onDone();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("reagendarTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {centros.length > 1 && canMulti && (
            <div className="space-y-1.5">
              <Label>{t("centro")}</Label>
              <Select value={centro || undefined} onValueChange={pickCentro}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {centros.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {crossCentro && (
            <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
              {t("moveFromTo", { from: origen, to: destino })}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("date")}</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("time")}</Label>
              <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
            </div>
          </div>

          {medicoRequired && (
            <div className="space-y-1.5">
              <Label>
                {t("doctor")} <span className="text-destructive">*</span>
              </Label>
              <Select value={medico || undefined} onValueChange={setMedico}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("doctorPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {medicos.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {[m.nombre, m.apellido].filter(Boolean).join(" ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {availability && hora && availability.vacios === 0 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              {t("noCupo", { hora })}
              {availability.next && (
                <button
                  type="button"
                  className="ml-1 underline"
                  onClick={() => setHora(availability.next!)}
                >
                  {t("useNext", { hora: availability.next })}
                </button>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>
              {t("reason")} <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              placeholder={t("reasonPlaceholder")}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {tc("cancel")}
          </Button>
          <Button disabled={!canSubmit} onClick={submit}>
            {busy ? tc("saving") : crossCentro ? t("move") : t("reagendar")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Audit trail viewer (GET /citas/:id/historial). Shows each event with its
// antes → después (fecha, hora, centro, médico), mapping ids to names.
function HistorialDialog({ cita, onClose }: { cita: Cita; onClose: () => void }) {
  const t = useTranslations("appointments.actions");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const { map: estadosMap } = useEstados();

  const histRes = useResource<CitaEvento[]>(() =>
    getHistorial(cita.id, cita.clinicId ?? undefined),
  );
  const centrosRes = useResource<Centro[]>(() => getMyCentros());
  const medicosRes = useResource<Personal[]>(() => getMedicos());
  const centros = centrosRes.state.kind === "ok" ? centrosRes.state.data : [];
  const medicos = medicosRes.state.kind === "ok" ? medicosRes.state.data : [];

  const centroName = (id: unknown) =>
    centros.find((c) => c.id === id)?.nombre ?? (id ? String(id) : "—");
  const medicoName = (id: unknown) => {
    const m = medicos.find((x) => x.id === id);
    return m ? [m.nombre, m.apellido].filter(Boolean).join(" ") : id ? String(id) : "—";
  };
  const fmt = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleString();
  };

  const events = histRes.state.kind === "ok" ? histRes.state.data : [];

  function diff(ev: CitaEvento) {
    const a = ev.payload?.antes ?? {};
    const d = ev.payload?.despues ?? {};
    const rows: { label: string; from: string; to: string }[] = [];
    const push = (key: string, label: string, render: (v: unknown) => string) => {
      if (a[key] === undefined && d[key] === undefined) return;
      const from = render(a[key]);
      const to = render(d[key]);
      if (from !== to) rows.push({ label, from, to });
    };
    const txt = (v: unknown) => (v ? String(v) : "—");
    const estadoName = (v: unknown) => {
      const e = estadosMap.get(String(v));
      return e ? tRoot(e.labelKey) : v ? String(v) : "—";
    };
    push("estado", t("estado"), estadoName);
    push("fecha", t("date"), txt);
    push("hora", t("time"), txt);
    push("centroId", t("centro"), centroName);
    push("medicoId", t("doctor"), medicoName);
    return rows;
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("historialTitle")}</DialogTitle>
        </DialogHeader>
        {histRes.state.kind === "loading" && (
          <p className="text-sm text-muted-foreground">{tc("loading")}</p>
        )}
        {histRes.state.kind === "fail" && (
          <p className="text-sm text-destructive">{histRes.state.message}</p>
        )}
        {histRes.state.kind === "ok" && events.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("historialEmpty")}</p>
        )}
        <ol className="space-y-3">
          {events.map((ev) => {
            const rows = diff(ev);
            return (
              <li key={ev.id} className="rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{t(`event.${ev.tipo}`)}</span>
                  <span className="text-xs text-muted-foreground">{fmt(ev.createdAt)}</span>
                </div>
                {ev.motivo && <p className="mt-1 text-xs text-muted-foreground">{ev.motivo}</p>}
                {rows.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-xs">
                    {rows.map((r) => (
                      <li key={r.label}>
                        <span className="text-muted-foreground">{r.label}:</span>{" "}
                        <span className="line-through opacity-70">{r.from}</span>
                        {" → "}
                        <span className="font-medium">{r.to}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {tc("cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
