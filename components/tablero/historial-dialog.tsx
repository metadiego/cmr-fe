"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { getHistorial, type CitaEvento } from "@/lib/api/citas";
import { humanizeKey } from "@/lib/i18n/humanize";
import { useResource } from "@/hooks/use-resource";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Reusable audit-trail viewer for a cita. Shows each event with actor + time,
// and for `campo_editado` the field, before → after. All fields come from the BE
// (actorNombre resolved server-side) — the FE just paints them.
export function HistorialDialog({
  citaId,
  centroId,
  onClose,
}: {
  citaId: string;
  centroId?: string;
  onClose: () => void;
}) {
  const t = useTranslations("tableroBoard");
  const tc = useTranslations("common");
  const tRoot = useTranslations();

  const res = useResource<CitaEvento[]>(() => getHistorial(citaId, centroId), [citaId]);
  const events = res.state.kind === "ok" ? res.state.data : [];

  const fmt = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleString();
  };
  const val = (v: unknown) =>
    v == null || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("history")}</DialogTitle>
        </DialogHeader>

        {res.state.kind === "loading" && (
          <p className="text-sm text-muted-foreground">{tc("loading")}</p>
        )}
        {res.state.kind === "ok" && events.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("historyEmpty")}</p>
        )}

        <ol className="space-y-3">
          {events.map((ev) => {
            const p = ev.payload ?? {};
            const columna = (p as { columna?: string }).columna;
            return (
              <li key={ev.id} className="rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{tRoot(`appointments.actions.event.${ev.type}`)}</span>
                  <span className="text-xs text-muted-foreground">{fmt(ev.createdAt)}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {ev.actorNombre ?? "—"}
                  {ev.reason ? ` · ${ev.reason}` : ""}
                </p>
                {ev.type === "campo_editado" && (
                  <p className="mt-1 text-xs">
                    <span className="text-muted-foreground">
                      {columna ? humanizeKey(columna) : ""}:
                    </span>{" "}
                    <span className="line-through opacity-70">{val(p.antes)}</span>
                    {" → "}
                    <span className="font-medium">{val(p.despues)}</span>
                  </p>
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
