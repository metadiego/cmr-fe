"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { getActiveCentro } from "@/lib/tenant";
import { getServicios, type Servicio } from "@/lib/api/servicios";
import { type Paciente } from "@/lib/api/pacientes";
import { useResource } from "@/hooks/use-resource";
import { PacienteSelect } from "@/components/citas/paciente-select";
import { TherapyDayPlanner, type PlannerService } from "@/components/agenda/therapy-day-planner";
import { Checkbox } from "@/components/ui/checkbox";
import { PageContainer, PageHeader } from "@/components/ui/page";

// Ruta APARTE para «programar el día del paciente», para quien la prefiera separada del Citar. Monta el
// MISMO componente reutilizable (TherapyDayPlanner) que el Citar del frontdesk — se edita una vez y sirve
// en los dos sitios. Handoff HANDOFF-FE-agenda-de-terapias (Pantalla 2).
export default function TherapyDayPage() {
  const t = useTranslations("therapyPlanner");
  const centro = getActiveCentro() ?? undefined;
  const [paciente, setPaciente] = React.useState<Paciente | null>(null);
  const [sel, setSel] = React.useState<Set<string>>(new Set());

  const servRes = useResource<Servicio[]>(() => getServicios(centro), [centro]);
  const servicios = servRes.state.kind === "ok" ? servRes.state.data : [];
  const chosen: PlannerService[] = servicios.filter((s) => sel.has(s.id)).map((s) => ({ id: s.id, name: s.name }));

  const nombre = paciente ? (paciente.displayName || [paciente.firstName, paciente.lastName].filter(Boolean).join(" ").trim()) : "";

  function toggle(id: string) {
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  return (
    <PageContainer>
      <PageHeader title={t("title")} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[22rem_1fr]">
        <aside className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("pickPatient")}</label>
            <PacienteSelect value={paciente} onChange={(p) => { setPaciente(p); setSel(new Set()); }} />
          </div>
          {paciente && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("pickServices")}</label>
              <ul className="max-h-[60vh] space-y-1 overflow-auto rounded-md ring-1 ring-foreground/10 p-2">
                {servicios.map((s) => (
                  <li key={s.id}>
                    <label className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent">
                      <Checkbox checked={sel.has(s.id)} onCheckedChange={() => toggle(s.id)} />
                      <span className="min-w-0 truncate">{s.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        <section className="rounded-md bg-card p-5 ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
          {!paciente ? (
            <p className="text-sm text-muted-foreground">{t("choosePatientFirst")}</p>
          ) : chosen.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noServices")}</p>
          ) : (
            <TherapyDayPlanner
              patient={{ id: paciente.id, name: nombre, record: paciente.medicalRecordNumber }}
              services={chosen}
              centro={centro}
            />
          )}
        </section>
      </div>
    </PageContainer>
  );
}
