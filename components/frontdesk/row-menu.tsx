"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";

import { cancelarSesion, confirmSession, unconfirmSession } from "@/lib/api/frontdesk";
import { cancelMeaning, confirmToggle, refusalRefreshesRow } from "@/lib/lifecycle/allowed-actions";
import { useCan } from "@/hooks/use-can";
import { ChangeLogSheet } from "@/components/change-log/change-log-sheet";
import { cancelPatientDay, reopenPatientDay, reopenSession } from "@/lib/api/frontdesk-day";
import { ApiError } from "@/lib/api/types";
import { todayISO } from "@/lib/agenda/calendar";
import { canReopen, duplicatesReopen, REOPEN_ERROR_KEYS, skippedReasons } from "@/lib/frontdesk/reopen";
import { sessionReasonMissing } from "@/lib/frontdesk/session-reason-missing";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { useConfirm } from "@/components/kit/confirm-host";
import { useSubmit } from "@/components/kit/use-submit";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Row "···" actions menu (extracted from fila-sesion.tsx): history, report formats, data-driven
// actions, cancel and repair (admin). The BE decides which transitions apply; this only lists them
// and confirms the ones that ask for it.
export function RowMenu({
  allowedActions,
  disabled,
  cancelada,
  canReparar,
  conHistorial,
  estados,
  onHistorial,
  reports,
  onReport,
  accionesMenu,
  onAccion,
  onProgramar,
  day,
  onDone,
  onReparar,
}: {
  /** The row's `allowedActions` (live Patient desk, cmr-be 4a): Cancel / not-served and Confirm /
   * Unconfirm follow it. null/undefined: today's rule (Cancel on any open session, no confirm). */
  allowedActions?: readonly string[] | null;
  disabled: boolean;
  cancelada: boolean;
  canReparar: boolean;
  conHistorial: boolean;
  estados: { clave: string; label: string }[];
  onHistorial: () => void;
  reports?: { id: string; label: string }[]; // formatos del servicio, PLANOS en el menú (cada uno abre su doc)
  onReport?: (id: string) => void;
  // Acciones data-driven aplicables desde el estado actual (p. ej. reactivar una cancelada). El BE es la
  // autoridad (transiciones + permiso); el FE solo las pinta y confirma si la transición lo pide.
  accionesMenu?: { clave: string; label: string; confirmar?: boolean; from?: string[] | null }[];
  onAccion?: (clave: string) => void;
  onProgramar?: () => void; // abrir "Programar citas" desde la fila (agendar la próxima aunque ya esté asistido)
  // The row's session and its patient's day: Cancelar, Cancelar todas, Reabrir, Reabrir todas (BE #508).
  day: { sessionId: string; status: string; patientId?: string | null; date?: string | null; centerId?: string };
  onDone: () => void;
  onReparar: (payload: { reason: string; status?: string }) => void;
}) {
  const t = useTranslations("frontdesk");
  const tRoot = useTranslations();
  const { can } = useCan();
  // Which cancel the dialog confirms: this session, or every open session of the patient's day.
  const [cancelOpen, setCancelOpen] = React.useState<false | "one" | "all">(false);
  const [repararOpen, setRepararOpen] = React.useState(false);
  const [motivo, setMotivo] = React.useState("");
  const [estadoNuevo, setEstadoNuevo] = React.useState("");
  const [changesOpen, setChangesOpen] = React.useState(false); // «Historial de cambios» of this session

  // Reopen is offered only on a cancelled session of TODAY; the BE re-checks it (409 otherwise).
  const reopenable = canReopen(day.status, day.date, todayISO());
  const patientId = day.patientId ?? null;
  const acciones = reopenable ? (accionesMenu ?? []).filter((a) => !duplicatesReopen(a.from)) : (accionesMenu ?? []);

  const say = (code: string) => {
    const key = REOPEN_ERROR_KEYS[code];
    return key && tRoot.has(key) ? tRoot(key) : code;
  };
  const confirm = useConfirm();
  // One guard for cancel / reopen: the cancel dialog stays open (and un-closable) while it runs.
  const { submitting: busy, submit: act } = useSubmit((fn: () => Promise<string | null>) => fn(), {
    onSuccess: (msg) => {
      if (msg) toast.success(msg);
      setCancelOpen(false);
      onDone();
    },
    onError: (err) => {
      // The session moved under us: close the dialog and redraw (the generic toast still says why).
      if (refusalRefreshesRow(err)) {
        setCancelOpen(false);
        onDone();
        return false;
      }
      if (!(err instanceof ApiError && REOPEN_ERROR_KEYS[err.code])) return false;
      toast.error(say(err.code));
      return true;
    },
  });
  const missing = sessionReasonMissing({ reason: motivo }).map(() => t("motivo"));
  // With the row's list: Cancel shows only when listed, as "not served" on an arrived session.
  const meaning = cancelMeaning(allowedActions);
  const showCancel = meaning === undefined ? !cancelada : meaning !== null;
  const cancelLabel = meaning === "not_serve" ? tRoot("lifecycle.action.not_serve") : t("cancelar");
  const toggle = confirmToggle(allowedActions);
  const confirmMove = (move: "confirm" | "unconfirm") =>
    act(async () => {
      await (move === "confirm" ? confirmSession : unconfirmSession)(day.sessionId, day.centerId);
      return tRoot("common.saved");
    });
  const cancel = (mode: "one" | "all", reason: string) =>
    act(async () => {
      if (mode === "one") {
        await cancelarSesion(day.sessionId, reason, day.centerId);
        return null;
      }
      const r = await cancelPatientDay(patientId!, reason, day.centerId);
      return t("cancelledMany", { n: r.count });
    });
  const reopenOne = () =>
    act(async () => {
      await reopenSession(day.sessionId, undefined, day.centerId);
      return t("reopened");
    });
  const reopenAll = () =>
    act(async () => {
      const r = await reopenPatientDay(patientId!, day.centerId);
      const skipped = skippedReasons(r.skipped);
      if (skipped.length) {
        toast.warning(t("reopenSkipped", { n: r.reopened.length, reasons: skipped.map((x) => `${say(x.code)} (${x.n})`).join(" · ") }));
        return null;
      }
      return t("reopenedMany", { n: r.reopened.length });
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" disabled={disabled || busy} aria-label={t("acciones")}>
            <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/* Los formatos son documentos de SOLO LECTURA: se pueden ver/imprimir incluso en una sesión
              cancelada (a diferencia de Cancelar/Programar, que sí requieren sesión activa). */}
          {(reports ?? []).map((r) => (
            <DropdownMenuItem key={r.id} onSelect={(e) => { e.preventDefault(); onReport?.(r.id); }}>
              {r.label}
            </DropdownMenuItem>
          ))}
          {/* Acciones data-driven desde el estado actual (p. ej. Reactivar una cancelada → segunda
              oportunidad). Blocking confirm when the BE transition asks for it. */}
          {reopenable && (
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); reopenOne(); }}>
              {t("reopen")}
            </DropdownMenuItem>
          )}
          {reopenable && patientId && (
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); reopenAll(); }}>
              {t("reopenAll")}
            </DropdownMenuItem>
          )}
          {toggle && (
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); confirmMove(toggle); }}>
              {tRoot(`lifecycle.action.${toggle}`)}
            </DropdownMenuItem>
          )}
          {acciones.map((a) => (
            <DropdownMenuItem
              key={a.clave}
              onSelect={async (e) => {
                e.preventDefault();
                if (!a.confirmar || (await confirm({ title: t("confirmarAccion", { accion: a.label }), confirmLabel: a.label })))
                  onAccion?.(a.clave);
              }}
            >
              {a.label}
            </DropdownMenuItem>
          ))}
          {onProgramar && !cancelada && (
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onProgramar(); }}>
              {t("programarCitas")}
            </DropdownMenuItem>
          )}
          {conHistorial && (
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onHistorial(); }}>
              {t("historial")}
            </DropdownMenuItem>
          )}
          {can("change_log.read") && (
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setChangesOpen(true); }}>
              {tRoot("changeLog.title")}
            </DropdownMenuItem>
          )}
          {showCancel && (
            <DropdownMenuItem variant="destructive" onSelect={(e) => { e.preventDefault(); setMotivo(""); setCancelOpen("one"); }}>
              {cancelLabel}
            </DropdownMenuItem>
          )}
          {!cancelada && patientId && (
            <DropdownMenuItem variant="destructive" onSelect={(e) => { e.preventDefault(); setMotivo(""); setCancelOpen("all"); }}>
              {t("cancelAll")}
            </DropdownMenuItem>
          )}
          {canReparar && (
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setMotivo(""); setEstadoNuevo(""); setRepararOpen(true); }}>
              {t("reparar")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ChangeLogSheet
        open={changesOpen}
        onOpenChange={setChangesOpen}
        filter={{ entityType: "frontdesk_session", entityId: day.sessionId, centerIds: day.centerId ? [day.centerId] : undefined }}
        onUndone={onDone}
      />

      <FormDialog
        open={!!cancelOpen}
        onOpenChange={(v) => !v && setCancelOpen(false)}
        size="sm"
        title={cancelOpen === "all" ? t("cancelAllTitle") : meaning === "not_serve" ? cancelLabel : t("cancelarTitle")}
        description={cancelOpen === "all" ? t("cancelAllHint") : undefined}
        onSubmit={() => cancel(cancelOpen || "one", motivo.trim())}
        actions={[
          {
            label: cancelOpen === "all" ? t("cancelAll") : cancelLabel,
            variant: "destructive",
            onClick: () => cancel(cancelOpen || "one", motivo.trim()),
          },
        ]}
        submitting={busy}
        missing={missing}
      >
        <Field label={t("motivo")} htmlFor="row-cancel-reason" required>
          <Input id="row-cancel-reason" value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus />
        </Field>
      </FormDialog>

      <FormDialog
        open={repararOpen}
        onOpenChange={setRepararOpen}
        size="sm"
        title={t("repararTitle")}
        onSubmit={() => {
          setRepararOpen(false);
          onReparar({ reason: motivo.trim(), ...(estadoNuevo ? { status: estadoNuevo } : {}) });
        }}
        submitLabel={t("reparar")}
        missing={missing}
      >
        <Field label={t("motivo")} htmlFor="row-repair-reason" required>
          <Input id="row-repair-reason" value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus />
        </Field>
        <Field label={t("estadoNuevo")} htmlFor="row-repair-status">
          <Select value={estadoNuevo} onValueChange={setEstadoNuevo}>
            <SelectTrigger id="row-repair-status" className="w-full"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              {estados.map((e) => <SelectItem key={e.clave} value={e.clave}>{e.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </FormDialog>
    </>
  );
}

// El botón de Estatus de enfermeras (ver + poner/quitar, con contador) es ahora un componente COMPARTIDO
// con el panel de enfermería: components/frontdesk/nurse-status-button.tsx (no duplicar).

// ————— Modal "Historial de terapias" del paciente por servicio (BE PR #148, paridad legacy) —————
// Nivel mega-pro: tabla limpia con fecha, estado (badge), Sesión X/Y + Áreas, y staff. El BE lo proyecta
// todo (migradas viejas pueden traer X/Y y staff en null → se muestra "—"). Se abre desde el menú Acciones.
