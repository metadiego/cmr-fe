"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
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
  onCancelar,
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
  accionesMenu?: { clave: string; label: string; confirmar?: boolean }[];
  onAccion?: (clave: string) => void;
  onProgramar?: () => void; // abrir "Programar citas" desde la fila (agendar la próxima aunque ya esté asistido)
  onCancelar: (motivo: string) => void;
  onReparar: (payload: { reason: string; status?: string }) => void;
}) {
  const t = useTranslations("frontdesk");
  const tc = useTranslations("common");
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [repararOpen, setRepararOpen] = React.useState(false);
  const [motivo, setMotivo] = React.useState("");
  const [estadoNuevo, setEstadoNuevo] = React.useState("");

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" disabled={disabled} aria-label={t("acciones")}>
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
          {(accionesMenu ?? []).map((a) => (
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
          {!cancelada && (
            <DropdownMenuItem variant="destructive" onSelect={(e) => { e.preventDefault(); setMotivo(""); setCancelOpen(true); }}>
              {t("cancelar")}
            </DropdownMenuItem>
          )}
          {canReparar && (
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setMotivo(""); setEstadoNuevo(""); setRepararOpen(true); }}>
              {t("reparar")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{t("cancelarTitle")}</DialogTitle></DialogHeader>
          <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={t("motivo")} autoFocus />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCancelOpen(false)}>{tc("cancel")}</Button>
            <Button
              variant="destructive"
              disabled={!motivo.trim()}
              onClick={() => { setCancelOpen(false); onCancelar(motivo.trim()); }}
            >
              {t("cancelar")}
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
