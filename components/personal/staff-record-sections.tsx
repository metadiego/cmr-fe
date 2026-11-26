"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import {
  updateFrontdeskStartsOnConsultation,
  updateConsultationBoardInitialTab,
  type Personal, type PersonalConPreferenciaFrontdesk,
} from "@/lib/api/personal";
import { getDefinicion, type TableroDefinicion } from "@/lib/api/tablero";
import { useResource } from "@/hooks/use-resource";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CONSULTATION_BOARD } from "@/lib/frontdesk/consultation-board";
import { useSaveSection } from "@/components/personal/save-group";

// Sections of a staff record (app/(app)/configuration/staff/page.tsx). `centro` is the PERSON's home
// clinic (`persona.clinicId`), never a screen clinic: every read and write here runs in that clinic.

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
