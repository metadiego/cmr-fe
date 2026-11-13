"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  getPersonalCentros, updatePersonalCentros, updateFrontdeskStartsOnConsultation,
  updateConsultationBoardInitialTab,
  type Personal, type CentroDePersonal, type PersonalConPreferenciaFrontdesk,
} from "@/lib/api/personal";
import { getDefinicion, type TableroDefinicion } from "@/lib/api/tablero";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CONSULTATION_BOARD } from "@/lib/frontdesk/consultation-board";

// Sections of a staff record (app/(app)/configuration/staff/page.tsx). `centro` is the PERSON's home
// clinic (`persona.clinicId`), never a screen clinic: every read and write here runs in that clinic.

export function CentrosDePersona({ persona, centro }: { persona: Personal; centro?: string }) {
  const t = useTranslations("personalFicha");
  const tRoot = useTranslations();
  const res = useResource<CentroDePersonal[]>(() => getPersonalCentros(persona.id, centro), [persona.id, centro]);
  const base = res.state.kind === "ok" ? res.state.data : [];
  // Selección local (activos) sobre lo que trae el BE; guardar manda la lista de encendidos.
  const [activos, setActivos] = React.useState<Set<string> | null>(null);
  const marcados = activos ?? new Set(base.filter((c) => c.active).map((c) => c.id));
  const [busy, setBusy] = React.useState(false);
  const original = new Set(base.filter((c) => c.active).map((c) => c.id));
  const sucio = base.length > 0 && (marcados.size !== original.size || [...marcados].some((id) => !original.has(id)));

  function toggle(id: string) {
    setActivos(() => {
      const next = new Set(marcados);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  async function guardar() {
    if (busy || !sucio) return;
    setBusy(true);
    try {
      await updatePersonalCentros(persona.id, [...marcados], centro);
      toast.success(t("centrosGuardados"));
      setActivos(null);
      res.reload();
    } catch (e) {
      toastError(e, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t pt-4">
      <Label className="mb-1 block">{t("centros")}</Label>
      <p className="mb-2 text-xs text-muted-foreground">{t("centrosAyuda")}</p>
      {res.state.kind === "loading" && <p className="text-sm text-muted-foreground">{t("cargando")}</p>}
      {res.state.kind === "fail" && <p className="text-sm text-destructive">{res.state.message}</p>}
      <div className="flex flex-wrap gap-2">
        {base.map((c) => {
          const on = marcados.has(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle(c.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                on ? "border-primary/40 bg-primary/15 text-primary" : "border-border text-muted-foreground hover:bg-accent",
              )}
            >
              {on ? "✓ " : ""}{c.name}
            </button>
          );
        })}
      </div>
      {sucio && (
        <div className="mt-3 flex justify-end">
          <Button size="sm" onClick={guardar} disabled={busy}>{busy ? t("guardando") : t("guardarCentros")}</Button>
        </div>
      )}
    </div>
  );
}

export function FrontdeskConsultaPreferencia({ persona, centro }: { persona: Personal; centro?: string }) {
  const t = useTranslations("personalFicha");
  const tRoot = useTranslations();
  // Lee su propio valor ya traído en la lista (ningún GET nuevo): hoy el campo no existe en prod
  // (PR #386 sin desplegar), así que esto da `undefined` → el switch nace apagado, sin romper nada.
  const actual = (persona as PersonalConPreferenciaFrontdesk).frontdeskStartsOnConsultation ?? false;
  const [valor, setValor] = React.useState(actual);
  const [busy, setBusy] = React.useState(false);
  const sucio = valor !== actual;

  async function guardar() {
    if (busy || !sucio) return;
    setBusy(true);
    try {
      await updateFrontdeskStartsOnConsultation(persona.id, valor, centro);
      toast.success(t("frontdeskConsultaGuardado"));
    } catch (e) {
      toastError(e, tRoot);
      setValor(actual);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t pt-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <Label>{t("frontdeskConsultaLabel")}</Label>
          <p className="text-xs text-muted-foreground">{t("frontdeskConsultaAyuda")}</p>
        </div>
        <Switch checked={valor} disabled={busy} onCheckedChange={setValor} />
      </div>
      {sucio && (
        <div className="mt-3 flex justify-end">
          <Button size="sm" onClick={guardar} disabled={busy}>{busy ? t("guardando") : t("guardarCambios")}</Button>
        </div>
      )}
      <ConsultaInitialTab persona={persona} centro={centro} />
    </div>
  );
}

// Con qué pestaña de ESTADO abre el tablero de Consulta — preferencia de la persona (handoff
// traer-al-dia-y-la-pestana-inicial). Opciones data-driven desde los estados del tablero de Atención: hoy
// "Como está configurado" (null) + cada estado; si mañana se añade uno, aparece solo, es dato no código.
function ConsultaInitialTab({ persona, centro }: { persona: Personal; centro?: string }) {
  const t = useTranslations("personalFicha");
  const tRoot = useTranslations();
  const AS_IS = "__as_is__"; // null no es value válido de <Select>: se mapea a null al guardar
  const actual = (persona as PersonalConPreferenciaFrontdesk).consultationBoardInitialTab ?? null;
  const [valor, setValor] = React.useState<string>(actual ?? AS_IS);
  const [busy, setBusy] = React.useState(false);
  const sucio = (valor === AS_IS ? null : valor) !== actual;
  const defRes = useResource<TableroDefinicion>(
    () => (centro ? getDefinicion(CONSULTATION_BOARD, centro) : Promise.resolve({ statuses: [], transitions: [], columns: [], subtypes: [] } as unknown as TableroDefinicion)),
    [centro],
  );
  const estados = defRes.state.kind === "ok" ? defRes.state.data.statuses : [];

  async function guardar() {
    if (busy || !sucio) return;
    setBusy(true);
    try {
      await updateConsultationBoardInitialTab(persona.id, valor === AS_IS ? null : valor, centro);
      toast.success(t("consultaInicialGuardado"));
    } catch (e) {
      toastError(e, tRoot);
      setValor(actual ?? AS_IS);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <Label>{t("consultaInicialLabel")}</Label>
        <p className="text-xs text-muted-foreground">{t("consultaInicialAyuda")}</p>
      </div>
      <div className="flex items-center gap-2">
        <Select value={valor} disabled={busy} onValueChange={setValor}>
          <SelectTrigger size="sm" className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={AS_IS}>{t("consultaInicialAsIs")}</SelectItem>
            {estados.map((e) => (
              <SelectItem key={e.slug} value={e.slug}>{tRoot.has(e.labelKey) ? tRoot(e.labelKey) : e.slug}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {sucio && (
          <Button size="sm" onClick={guardar} disabled={busy}>{busy ? t("guardando") : t("guardarCambios")}</Button>
        )}
      </div>
    </div>
  );
}
