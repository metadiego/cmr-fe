"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";

import { cancelarSesion } from "@/lib/api/frontdesk";
import { useCan } from "@/hooks/use-can";
import { ChangeLogSheet } from "@/components/change-log/change-log-sheet";
import { cancelPatientDay, reopenPatientDay, reopenSession } from "@/lib/api/frontdesk-day";
import { ApiError } from "@/lib/api/types";
import { toastError } from "@/lib/api/errors";
import { todayISO } from "@/lib/agenda/calendar";
import { canReopen, duplicatesReopen, REOPEN_ERROR_KEYS, skippedReasons } from "@/lib/frontdesk/reopen";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

// Menú "···" de acciones de la fila (extraído de fila-sesion.tsx): historial, formatos, acciones
// data-driven, cancelar y reparar (admin). El BE es la autoridad de qué transiciones aplican; esto
// solo las pinta y confirma lo que pide confirmación.
export function RowMenu({
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
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const { can } = useCan();
  // Which cancel the dialog confirms: this session, or every open session of the patient's day.
  const [cancelOpen, setCancelOpen] = React.useState<false | "one" | "all">(false);
  const [repararOpen, setRepararOpen] = React.useState(false);
  const [motivo, setMotivo] = React.useState("");
  const [estadoNuevo, setEstadoNuevo] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [changesOpen, setChangesOpen] = React.useState(false); // «Historial de cambios» of this session

  // Reopen is offered only on a cancelled session of TODAY; the BE re-checks it (409 otherwise).
  const reopenable = canReopen(day.status, day.date, todayISO());
  const patientId = day.patientId ?? null;
  const acciones = reopenable ? (accionesMenu ?? []).filter((a) => !duplicatesReopen(a.from)) : (accionesMenu ?? []);

  const say = (code: string) => {
    const key = REOPEN_ERROR_KEYS[code];
    return key && tRoot.has(key) ? tRoot(key) : code;
  };
  async function act(fn: () => Promise<string | null>) {
    setBusy(true);
    try {
      const msg = await fn();
      if (msg) toast.success(msg);
      onDone();
    } catch (err) {
      if (err instanceof ApiError && REOPEN_ERROR_KEYS[err.code]) toast.error(say(err.code));
      else toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }
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
              oportunidad). Confirmación con toast cuando la transición del BE la exige. */}
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
          {acciones.map((a) => (
            <DropdownMenuItem
              key={a.clave}
              onSelect={(e) => {
                e.preventDefault();
                if (a.confirmar) {
                  toast(t("confirmarAccion", { accion: a.label }), {
                    action: { label: a.label, onClick: () => onAccion?.(a.clave) },
                  });
                } else {
                  onAccion?.(a.clave);
                }
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
          {!cancelada && (
            <DropdownMenuItem variant="destructive" onSelect={(e) => { e.preventDefault(); setMotivo(""); setCancelOpen("one"); }}>
              {t("cancelar")}
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

      <Dialog open={!!cancelOpen} onOpenChange={(v) => !v && setCancelOpen(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{cancelOpen === "all" ? t("cancelAllTitle") : t("cancelarTitle")}</DialogTitle>
            {cancelOpen === "all" && <DialogDescription>{t("cancelAllHint")}</DialogDescription>}
          </DialogHeader>
          <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={t("motivo")} autoFocus />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCancelOpen(false)}>{tc("cancel")}</Button>
            <Button
              variant="destructive"
              disabled={!motivo.trim()}
              onClick={() => { const mode = cancelOpen || "one"; setCancelOpen(false); void cancel(mode, motivo.trim()); }}
            >
              {cancelOpen === "all" ? t("cancelAll") : t("cancelar")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={repararOpen} onOpenChange={setRepararOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{t("repararTitle")}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={t("motivo")} autoFocus />
            <Select value={estadoNuevo} onValueChange={setEstadoNuevo}>
              <SelectTrigger className="w-full"><SelectValue placeholder={t("estadoNuevo")} /></SelectTrigger>
              <SelectContent>
                {estados.map((e) => <SelectItem key={e.clave} value={e.clave}>{e.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRepararOpen(false)}>{tc("cancel")}</Button>
            <Button
              disabled={!motivo.trim()}
              onClick={() => {
                setRepararOpen(false);
                onReparar({ reason: motivo.trim(), ...(estadoNuevo ? { status: estadoNuevo } : {}) });
              }}
            >
              {t("reparar")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// El botón de Estatus de enfermeras (ver + poner/quitar, con contador) es ahora un componente COMPARTIDO
// con el panel de enfermería: components/frontdesk/nurse-status-button.tsx (no duplicar).

// ————— Modal "Historial de terapias" del paciente por servicio (BE PR #148, paridad legacy) —————
// Nivel mega-pro: tabla limpia con fecha, estado (badge), Sesión X/Y + Áreas, y staff. El BE lo proyecta
// todo (migradas viejas pueden traer X/Y y staff en null → se muestra "—"). Se abre desde el menú Acciones.
