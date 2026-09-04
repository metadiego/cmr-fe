"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Edit02Icon, Clock01Icon } from "@hugeicons/core-free-icons";

import { editarCelda } from "@/lib/api/tablero";
import { toastError } from "@/lib/api/errors";
import { usePersistenciaToast } from "@/hooks/use-persistencia-toast";
import { Input } from "@/components/ui/input";
import { HistorialDialog } from "@/components/tablero/historial-dialog";

// Inline-editable cell for an editable board column (data-driven: the day-view
// only renders this for columns the tablero marks editable). Saves via
// POST /tablero/celda (BE audits it) and shows the change log per row.
export function CeldaEditable({
  tablero,
  entidadId,
  columna,
  tipo,
  value,
  centroId,
  etiqueta,
  onChanged,
}: {
  tablero: string;
  entidadId: string;
  columna: string;
  tipo: string; // column tipo (texto/hora/…) → input kind
  value: unknown;
  centroId?: string;
  etiqueta?: string; // nombre humano de la columna para el toast de certificación
  onChanged: () => void;
}) {
  const t = useTranslations("tableroBoard");
  const notifyPersistencia = usePersistenciaToast();
  const original = value == null ? "" : String(value);
  const [editing, setEditing] = React.useState(false);
  const [val, setVal] = React.useState(original);
  const [busy, setBusy] = React.useState(false);
  const [histOpen, setHistOpen] = React.useState(false);

  async function save() {
    if (val === original) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      const { persistencia } = await editarCelda({ boardSlug: tablero, entityId: entidadId, column: columna, value: val }, centroId);
      // El toast CERTIFICA con lo que quedó en la base. Si ok:false, onChanged() re-lee la fila y la celda
      // vuelve sola a la verdad (no dejamos en pantalla un número que no se guardó).
      notifyPersistencia(persistencia, etiqueta);
      setEditing(false);
      onChanged();
    } catch (err) {
      toastError(err);
      setVal(original);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <Input
        type={tipo === "hora" ? "time" : "text"}
        className="h-8 w-40"
        value={val}
        autoFocus
        disabled={busy}
        onChange={(e) => setVal(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") {
            setVal(original);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <span className="group inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1 text-left hover:text-primary"
        title={t("edit")}
      >
        <span className={original ? "" : "text-muted-foreground"}>{original || "—"}</span>
        <HugeiconsIcon
          icon={Edit02Icon}
          className="size-3.5 opacity-0 transition-opacity group-hover:opacity-60"
        />
      </button>
      <button
        type="button"
        onClick={() => setHistOpen(true)}
        className="text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-60"
        title={t("history")}
      >
        <HugeiconsIcon icon={Clock01Icon} className="size-3.5" />
      </button>
      {histOpen && (
        <HistorialDialog citaId={entidadId} centroId={centroId} onClose={() => setHistOpen(false)} />
      )}
    </span>
  );
}
