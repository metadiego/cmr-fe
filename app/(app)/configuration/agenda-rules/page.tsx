"use client";

import { useTranslations } from "next-intl";

import { AgendaRulesAdmin } from "@/components/configuracion/agenda-rules-admin";
import { ConfigGuard } from "@/components/configuracion/config-guard";
import { useCentroGate } from "@/hooks/use-centro-gate";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";

// Configuración → Qué bloquea al agendar (BE #547, handoff .personal/handoff-avisar-nunca-bloquear.md
// §5): una regla por centro. "Ambos" no aplica — una llamada es de un solo centro (tenant.oneCenterOnly).
export default function AgendaRulesPage() {
  const t = useTranslations("configuracion.agendaRules");
  const tRoot = useTranslations();
  const gate = useCentroGate();

  return (
    <ConfigGuard permiso="preferences.read">
      <PageContainer>
        <PageHeader title={t("title")} description={t("help")} />
        {gate.necesitaPicker && (
          <div className="mb-4 flex flex-wrap gap-2">
            {gate.centros.map((c) => (
              <Button key={c.id} variant="outline" size="sm" onClick={() => gate.pick(c.id)}>
                {c.name}
              </Button>
            ))}
          </div>
        )}
        {!gate.centro ? (
          <p className="text-sm text-muted-foreground">{tRoot("configuracion.panel.elegirCentro")}</p>
        ) : (
          <AgendaRulesAdmin centro={gate.centro} />
        )}
      </PageContainer>
    </ConfigGuard>
  );
}
