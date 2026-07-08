"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import type { CitaFila } from "@/lib/api/agenda-dia";
import { facturarCita } from "@/lib/api/facturas";
import { toastError } from "@/lib/api/errors";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// An action item comes 100% from config: the `acciones` column's
// `render.actions` (stored in the DB). The FE renders whatever's there — nothing
// hardcoded. Admins add/remove/reorder actions without touching code.
export interface AccionItem {
  key: string;
  labelKey: string; // i18n key (humanized fallback if missing)
  icon?: string; // "edit" | "invoice" | "history" | … (cosmetic)
  kind?: string; // "link" → navigate to href; else → "soon" toast
  href?: string; // template with :pacienteId / :citaId placeholders
}

function iconFor(key?: string) {
  const cls = "size-4 text-muted-foreground";
  switch (key) {
    case "edit":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cls}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>;
    case "invoice":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cls}><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9.5 9.8a2.4 2 0 0 1 5 0c0 1.3-1.1 1.7-2.5 2.1s-2.5.8-2.5 2.1a2.4 2 0 0 0 5 0" /></svg>;
    case "history":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cls}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 4v4h4M12 8v4l3 2" /></svg>;
    default:
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cls}><circle cx="12" cy="12" r="9" /></svg>;
  }
}

function resolve(href: string, fila: CitaFila): string {
  return href
    .replace(":pacienteId", String(fila.pacienteId ?? ""))
    .replace(":citaId", String(fila.id));
}

export function AccionesModal({
  actions,
  fila,
  centroId,
}: {
  actions: AccionItem[];
  fila: CitaFila;
  centroId?: string;
}) {
  const t = useTranslations("tableroBoard");
  const tRoot = useTranslations();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  // "Facturar Consulta": crea/obtiene el borrador de la cita (idempotente) y abre
  // la pantalla de facturación. POST /facturas/cita/:citaId (data-driven kind).
  async function facturar() {
    setBusy(true);
    try {
      const f = await facturarCita(String(fila.id), centroId);
      setOpen(false);
      const q = centroId ? `?centro=${centroId}` : "";
      router.push(`/facturacion/${(f as { id: string }).id}${q}`);
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          title={t("actionsTitle")}
          aria-label={t("actionsTitle")}
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
            <circle cx="5" cy="12" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="19" cy="12" r="1.5" />
          </svg>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("actionsTitle")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2 pt-2">
          {actions.length === 0 && (
            <p className="px-1 py-3 text-sm text-muted-foreground">{t("noActions")}</p>
          )}
          {actions.map((a) => {
            const cls = "flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50";
            if (a.kind === "link" && a.href) {
              return (
                <Link key={a.key} href={resolve(a.href, fila)} onClick={() => setOpen(false)} className={cls}>
                  {iconFor(a.icon)}
                  {tRoot(a.labelKey)}
                </Link>
              );
            }
            if (a.kind === "facturar") {
              return (
                <button key={a.key} type="button" onClick={facturar} disabled={busy} className={cls}>
                  {iconFor(a.icon)}
                  {tRoot(a.labelKey)}
                </button>
              );
            }
            return (
              <button key={a.key} type="button" onClick={() => toast(tRoot(a.labelKey) + " — " + t("soon"))} className={cls}>
                {iconFor(a.icon)}
                {tRoot(a.labelKey)}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
