"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";

import { getStaff, getPersonalCentros, type Personal, type CentroDePersonal } from "@/lib/api/personal";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { colorFromString } from "@/components/clientes/helpers";
import { MedicoDisponibilidad } from "@/components/personal/medico-disponibilidad";
import { MedicoAgenda, MedicoPacientes, MedicoProduccion } from "@/components/personal/medico-hub-tabs";

// Hub del médico (hermano del hub del paciente): TODO lo del médico desde una pantalla — su ficha, su
// agenda, sus pacientes, su disponibilidad (horarios/ausencias/festivos) y su producción. Cada pestaña
// llama SOLO a su endpoint y se pinta según permiso. Handoff ficha-del-medico-hub.
export default function MedicoHubPage() {
  const t = useTranslations("medicoHub");
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { state } = useResource<Personal>(() => getStaff(id), [id]);

  return (
    <PageContainer>
      <button
        onClick={() => router.push("/configuration/staff")}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
        {t("back")}
      </button>
      {state.kind === "loading" && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
      {state.kind === "fail" && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{state.message}</p>
      )}
      {state.kind === "ok" && <MedicoHub p={state.data} />}
    </PageContainer>
  );
}

function MedicoHub({ p }: { p: Personal }) {
  const t = useTranslations("medicoHub");
  const { can } = useCan();
  const centro = p.clinicId ?? undefined;
  const nombre = `${p.name}${p.lastName ? ` ${p.lastName}` : ""}`;
  const iniciales = nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  // Hub de USUARIO, todo centralizado. Disponibilidad (horarios, días libres, permisos, vacaciones) la
  // tiene TODO usuario por igual — verificado en el BE: /doctors/absences y /doctors/schedules aceptan un
  // usuario que NO es médico (201/204, reversible). La ÚNICA distinción del médico es que hace consultas:
  // por eso Agenda, Pacientes y Producción solo aparecen cuando la persona tiene la capacidad de médico.
  const esMedico = (p.capabilities ?? []).includes("medico");
  const puedeDisponibilidad = true; // toda persona del hub (ya gateado por personal.read para llegar aquí)
  const puedeAgenda = esMedico && can("citas.read");
  const puedePacientes = esMedico && can("pacientes.read");
  const puedeProduccion = esMedico && can("citas.read");

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Avatar className="size-16 text-lg">
          <AvatarFallback style={{ backgroundColor: colorFromString(p.id), color: "white" }}>{iniciales || "?"}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <PageHeader
            title={nombre}
            description={
              <span className="inline-flex flex-wrap items-center gap-2">
                {p.jobTitle && <span className="text-sm text-muted-foreground">{p.jobTitle}</span>}
                {p.active ? <Badge variant="secondary">{t("active")}</Badge> : <Badge variant="outline">{t("inactive")}</Badge>}
              </span>
            }
          />
        </div>
      </div>

      <Tabs defaultValue="resumen">
        <TabsList className="mb-4">
          <TabsTrigger value="resumen">{t("tabs.summary")}</TabsTrigger>
          {puedeAgenda && <TabsTrigger value="agenda">{t("tabs.agenda")}</TabsTrigger>}
          {puedePacientes && <TabsTrigger value="pacientes">{t("tabs.patients")}</TabsTrigger>}
          {puedeDisponibilidad && <TabsTrigger value="disponibilidad">{t("tabs.availability")}</TabsTrigger>}
          {puedeProduccion && <TabsTrigger value="produccion">{t("tabs.production")}</TabsTrigger>}
        </TabsList>

        <TabsContent value="resumen">
          <MedicoResumen p={p} centro={centro} />
        </TabsContent>
        {puedeAgenda && <TabsContent value="agenda"><MedicoAgenda doctorId={p.id} centro={centro} /></TabsContent>}
        {puedePacientes && <TabsContent value="pacientes"><MedicoPacientes doctorId={p.id} centro={centro} /></TabsContent>}
        {puedeDisponibilidad && <TabsContent value="disponibilidad"><MedicoDisponibilidad doctorId={p.id} centro={centro} /></TabsContent>}
        {puedeProduccion && <TabsContent value="produccion"><MedicoProduccion doctorId={p.id} centro={centro} /></TabsContent>}
      </Tabs>
    </div>
  );
}

function MedicoResumen({ p, centro }: { p: Personal; centro?: string }) {
  const t = useTranslations("medicoHub");
  const centrosRes = useResource<CentroDePersonal[]>(() => getPersonalCentros(p.id, centro), [p.id, centro]);
  const centros = centrosRes.state.kind === "ok" ? centrosRes.state.data.filter((c) => c.active) : [];
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <section className="rounded-md bg-card p-5 ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("profile")}</h2>
        <dl className="space-y-3 text-sm">
          <Row label={t("jobTitle")} value={p.jobTitle} />
          <Row label={t("capabilities")} value={(p.capabilities ?? []).join(", ") || null} />
        </dl>
      </section>
      <section className="rounded-md bg-card p-5 ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("centers")}</h2>
        {centros.length === 0 ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">{centros.map((c) => <Badge key={c.id} variant="secondary">{c.name}</Badge>)}</div>
        )}
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value?.trim() ? value : "—"}</dd>
    </div>
  );
}
