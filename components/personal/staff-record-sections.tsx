"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import {
  getPersonalCentros, updatePersonalCentros, updateFrontdeskStartsOnConsultation,
  updateConsultationBoardInitialTab,
  type Personal, type CentroDePersonal, type PersonalConPreferenciaFrontdesk,
} from "@/lib/api/personal";
import { getDefinicion, type TableroDefinicion } from "@/lib/api/tablero";
import { useResource } from "@/hooks/use-resource";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CONSULTATION_BOARD } from "@/lib/frontdesk/consultation-board";
import { useSaveSection } from "@/components/personal/save-group";

// Sections of a staff record (app/(app)/configuration/staff/page.tsx). `centro` is the PERSON's home
// clinic (`persona.clinicId`), never a screen clinic: every read and write here runs in that clinic.

export function CentrosDePersona({ persona, centro }: { persona: Personal; centro?: string }) {
  const t = useTranslations("personalFicha");
  const res = useResource<CentroDePersonal[]>(() => getPersonalCentros(persona.id, centro), [persona.id, centro]);
  const base = res.state.kind === "ok" ? res.state.data : [];
  // Local selection over what the BE returned; saving sends the list of centers switched on.
  const [activos, setActivos] = React.useState<Set<string> | null>(null);
  const marcados = activos ?? new Set(base.filter((c) => c.active).map((c) => c.id));
  const original = new Set(base.filter((c) => c.active).map((c) => c.id));
  const dirty = base.length > 0 && (marcados.size !== original.size || [...marcados].some((id) => !original.has(id)));

  useSaveSection("centers", dirty, async () => {
    await updatePersonalCentros(persona.id, [...marcados], centro);
    setActivos(null);
    res.refresh();
  });

  function toggle(id: string) {
    setActivos(() => {
      const next = new Set(marcados);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
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
              aria-pressed={on}
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
    </div>
  );
}

// Front-desk preferences: land on Consulta when opening Frontdesk, and which status tab Consulta opens
// with. Each is its own PUT (a failure in one never touches the rest of the record); both save with the
// record's single "Save". The tab options come from the Consulta board's statuses (data, not code).
export function FrontdeskConsultaPreferencia({ persona, centro }: { persona: Personal; centro?: string }) {
  const t = useTranslations("personalFicha");
  const tRoot = useTranslations();
  const AS_IS = "__as_is__"; // null is not a valid <Select> value: mapped to null when saving
  const prefs = persona as PersonalConPreferenciaFrontdesk;
  const startsActual = prefs.frontdeskStartsOnConsultation ?? false;
  const tabActual = prefs.consultationBoardInitialTab ?? null;
  const [starts, setStarts] = React.useState(startsActual);
  const [tab, setTab] = React.useState<string>(tabActual ?? AS_IS);
  const tabValue = tab === AS_IS ? null : tab;
  const defRes = useResource<TableroDefinicion>(
    () => (centro ? getDefinicion(CONSULTATION_BOARD, centro) : Promise.resolve({ statuses: [], transitions: [], columns: [], subtypes: [] } as unknown as TableroDefinicion)),
    [centro],
  );
  const estados = defRes.state.kind === "ok" ? defRes.state.data.statuses : [];

  useSaveSection("frontdesk-start", starts !== startsActual, async () => {
    await updateFrontdeskStartsOnConsultation(persona.id, starts, centro);
  });
  useSaveSection("consulta-tab", tabValue !== tabActual, async () => {
    await updateConsultationBoardInitialTab(persona.id, tabValue, centro);
  });

  return (
    <div className="space-y-4 border-t pt-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <Label>{t("frontdeskConsultaLabel")}</Label>
          <p className="text-xs text-muted-foreground">{t("frontdeskConsultaAyuda")}</p>
        </div>
        <Switch checked={starts} onCheckedChange={setStarts} />
      </div>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <Label>{t("consultaInicialLabel")}</Label>
          <p className="text-xs text-muted-foreground">{t("consultaInicialAyuda")}</p>
        </div>
        <Select value={tab} onValueChange={setTab}>
          <SelectTrigger size="sm" className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={AS_IS}>{t("consultaInicialAsIs")}</SelectItem>
            {estados.map((e) => (
              <SelectItem key={e.slug} value={e.slug}>{tRoot.has(e.labelKey) ? tRoot(e.labelKey) : e.slug}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
