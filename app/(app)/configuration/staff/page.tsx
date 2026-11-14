"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { UserAccountIcon } from "@hugeicons/core-free-icons";

import { listPersonalAll, getCargos, type Personal, type PersonalEnAlcance, type CargoCatalogo } from "@/lib/api/personal";
import { FichaEditor } from "@/components/personal/ficha-editor";
import { NuevoPersonalDialog } from "@/components/personal/nuevo-personal-dialog";
import { StaffList } from "@/components/personal/staff-list";
import { CentrosDePersona, FrontdeskConsultaPreferencia } from "@/components/personal/staff-record-sections";
import { DarAccesoDialog } from "@/components/personal/give-access-dialog";
import { getRoles, type Rol } from "@/lib/api/rbac";
import { getEhrRoles, listEhrStaffLinks, type EhrRole, type EhrStaffLink } from "@/lib/api/ehr-integration";
import { getCentrosDondePuedo } from "@/lib/api/centers";
import { staffFullName as nombreDe } from "@/lib/personal/staff-name";
import { EhrLinkSection } from "@/components/personal/ehr-link-section";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { useClinicFilter } from "@/hooks/use-clinic-filter";
import { useCreateClinic } from "@/hooks/use-create-clinic";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MedicoDisponibilidad } from "@/components/personal/medico-disponibilidad";
import { MedicoAgenda, MedicoPacientes, MedicoProduccion } from "@/components/personal/medico-hub-tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PageContainer, PageHeader } from "@/components/ui/page";

// Ficha de personal: TODO en una pantalla, sin saltar. Lista a la izquierda, ficha de la persona a la
// derecha (identidad, cargo/capacidades y «Dar acceso al sistema»). Handoff ficha-de-personal-todo-en-una-pantalla.
// The list shows every clinic where the viewer holds personal.read (handoff clinic-read-scope), one row
// per person, with a clinic filter; the record and every action on it run in the PERSON's home clinic.

// Contenido de la ficha de Personal SIN contenedor/encabezado, para poder montarlo tanto en su ruta propia
// como dentro de la pestaña «Personal» de «Personal y accesos» (handoff personal-y-accesos-una-sola-pagina).
export function StaffPanel() {
  const t = useTranslations("personalFicha");
  const filter = useClinicFilter("personal.read");
  const create = useCreateClinic("personal.create", filter.choice);
  const [verInactivos, setVerInactivos] = React.useState(false);
  const [nuevoOpen, setNuevoOpen] = React.useState(false);
  const listRes = useResource<PersonalEnAlcance[]>(
    () => listPersonalAll({ onlyInactive: verInactivos }, filter.choice),
    [filter.choiceKey, verInactivos],
  );
  const personal = React.useMemo(
    () => (listRes.state.kind === "ok" ? listRes.state.data : []),
    [listRes.state],
  );
  const rolesRes = useResource<Rol[]>(() => getRoles());
  const roles = rolesRes.state.kind === "ok" ? rolesRes.state.data : [];
  // Catálogo de cargos del BE: one closed list, the same in every clinic.
  const cargosRes = useResource<CargoCatalogo[]>(() => getCargos());
  const cargoCatalogo = cargosRes.state.kind === "ok" ? cargosRes.state.data : [];
  // La cuenta del EHR no es por centro (una persona, una cuenta) pero el BE la guarda contra el centro
  // donde se creó: se piden TODOS los centros donde el que mira tiene ehr-integration.read (verificado
  // en vivo 2026-10-01). Tolerante al fallo: sin BE, sencillamente no hay vínculos que mostrar.
  const ehrCentrosRes = useResource<Awaited<ReturnType<typeof getCentrosDondePuedo>>>(
    () => getCentrosDondePuedo("ehr-integration.read").catch(() => []),
    [],
  );
  const ehrCenterIds = ehrCentrosRes.state.kind === "ok" ? ehrCentrosRes.state.data.map((c) => c.id) : undefined;
  const ehrCenterKey = ehrCenterIds?.join(",");
  const ehrLinksRes = useResource<EhrStaffLink[]>(
    () => (ehrCenterIds ? listEhrStaffLinks(undefined, ehrCenterIds).catch(() => []) : Promise.resolve([])),
    [ehrCenterKey],
  );
  const ehrLinks = ehrLinksRes.state.kind === "ok" ? ehrLinksRes.state.data : [];

  const [q, setQ] = React.useState("");
  const [selId, setSelId] = React.useState<string>("");

  // Capacidades: derivadas de los valores REALES del personal (no hay catálogo aparte en el handoff).
  const capacidadOpciones = React.useMemo(
    () => [...new Set(personal.flatMap((p) => p.capabilities ?? []))].sort(),
    [personal],
  );

  const filtrados = personal
    .filter((p) => {
      const n = q.trim().toLowerCase();
      return !n || nombreDe(p).toLowerCase().includes(n) || (p.jobTitle ?? "").toLowerCase().includes(n);
    })
    .sort((a, b) => nombreDe(a).localeCompare(nombreDe(b)));
  const sel = personal.find((p) => p.id === selId) ?? null;
  // The selected person's home clinic: the record, its EHR roles and every write run there.
  const selClinic = sel?.clinicId ?? undefined;
  const ehrRolesRes = useResource<EhrRole[]>(
    () => (selClinic ? getEhrRoles(selClinic).catch(() => []) : Promise.resolve([])),
    [selClinic],
  );
  const ehrRoles = ehrRolesRes.state.kind === "ok" ? ehrRolesRes.state.data : [];

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[20rem_1fr]">
        {/* Lista */}
        <aside className="flex flex-col gap-3 self-start rounded-md bg-card p-3 shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {create.canCreate && <Button size="sm" onClick={() => setNuevoOpen(true)}>{t("nuevo")}</Button>}
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" checked={verInactivos} onChange={(e) => { setVerInactivos(e.target.checked); setSelId(""); }} className="size-3.5" />
              {t("verInactivos")}
            </label>
          </div>
          <StaffList
            people={filtrados}
            selectedId={selId}
            onSelect={setSelId}
            q={q}
            onQChange={setQ}
            loading={listRes.state.kind === "loading"}
            loaded={listRes.state.kind === "ok"}
            showClinics={filter.showColumn}
          />
          {listRes.state.kind === "fail" && <p className="text-sm text-destructive">{listRes.state.message}</p>}
        </aside>

        {/* Ficha */}
        <section>
          {sel ? (
            <FichaPersonal
              key={sel.id}
              persona={sel}
              cargoCatalogo={cargoCatalogo}
              capacidadOpciones={capacidadOpciones}
              roles={roles}
              ehrRoles={ehrRoles}
              ehrLink={ehrLinks.find((l) => l.staffId === sel.id)}
              ehrCenterIds={ehrCenterIds}
              centro={selClinic}
              centroNombre={filter.showColumn ? (sel.clinicName ?? filter.nameOf(selClinic)) : ""}
              onChanged={() => listRes.reload()}
              onEhrChanged={() => ehrLinksRes.reload()}
            />
          ) : (
            <div className="flex min-h-[40vh] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
              {t("elegirPersona")}
            </div>
          )}
        </section>
      </div>

      {nuevoOpen && (
        <NuevoPersonalDialog
          centers={create.centers}
          defaultClinicId={create.defaultClinicId}
          showClinic={filter.showColumn}
          onClose={() => setNuevoOpen(false)}
          onCreated={(id) => { setNuevoOpen(false); setVerInactivos(false); listRes.reload(); setSelId(id); }}
        />
      )}
    </>
  );
}


// Ruta propia de Personal (se mantiene). «Personal y accesos» monta StaffPanel en su primera pestaña.
export default function PersonalPage() {
  const t = useTranslations("personalFicha");
  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <StaffPanel />
    </PageContainer>
  );
}

function FichaPersonal({
  persona, cargoCatalogo, capacidadOpciones, roles, ehrRoles, ehrLink, ehrCenterIds, centro, centroNombre, onChanged, onEhrChanged,
}: {
  persona: Personal;
  cargoCatalogo: CargoCatalogo[];
  capacidadOpciones: string[];
  roles: Rol[];
  ehrRoles: EhrRole[];
  ehrLink: EhrStaffLink | undefined;
  ehrCenterIds: string[] | undefined;
  /** The person's home clinic (`persona.clinicId`): the record is read and written there. */
  centro?: string;
  /** Its name, shown when the screen spans more than one clinic; "" otherwise. */
  centroNombre: string;
  onChanged: () => void;
  onEhrChanged: () => void;
}) {
  const t = useTranslations("personalFicha");
  const tRoot = useTranslations();
  const { can } = useCan();
  const [darAcceso, setDarAcceso] = React.useState(false);
  // Hub de USUARIO en la MISMA pantalla (sin ir «más adentro»): la ficha, y —solo para quien hace
  // consultas, es decir tiene la capacidad «medico»— su agenda, pacientes y producción. La disponibilidad
  // (horarios, días libres, permisos, vacaciones) es para TODO usuario por igual. Ver hub-de-usuario-medicos.
  const esMedico = (persona.capabilities ?? []).includes("medico");
  const puedeAgenda = esMedico && can("citas.read");
  const puedePacientes = esMedico && can("pacientes.read");
  const puedeProduccion = esMedico && can("citas.read");

  return (
    <div className="space-y-6 rounded-md bg-card p-6 shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10">
      {/* Identidad */}
      <div className="flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
          {(persona.name?.[0] ?? "") + (persona.lastName?.[0] ?? "")}
        </span>
        <div className="min-w-0">
          <div className="truncate text-lg font-semibold">{nombreDe(persona)}</div>
          <div className="truncate text-sm text-muted-foreground">{persona.email || (persona.profileId ? t("conCuenta") : t("sinCuenta"))}</div>
          {centroNombre && <div className="truncate text-xs text-muted-foreground">{t("centroOrigen", { nombre: centroNombre })}</div>}
        </div>
      </div>

      {/* Todo el hub del usuario, aquí mismo, en secciones. Sin saltar de pantalla. */}
      <Tabs defaultValue="ficha">
        <TabsList className="mb-2 flex flex-wrap">
          <TabsTrigger value="ficha">{t("tabFicha")}</TabsTrigger>
          <TabsTrigger value="disponibilidad">{tRoot("medicoHub.tabs.availability")}</TabsTrigger>
          {puedeAgenda && <TabsTrigger value="agenda">{tRoot("medicoHub.tabs.agenda")}</TabsTrigger>}
          {puedePacientes && <TabsTrigger value="pacientes">{tRoot("medicoHub.tabs.patients")}</TabsTrigger>}
          {puedeProduccion && <TabsTrigger value="produccion">{tRoot("medicoHub.tabs.production")}</TabsTrigger>}
        </TabsList>

        <TabsContent value="ficha" className="space-y-6 pt-2">
          {/* Ficha completa: identidad + cargo + capacidades + color + baja/reactivar (handoff personal-crud-completo). */}
          <FichaEditor persona={persona} cargoCatalogo={cargoCatalogo} capacidadOpciones={capacidadOpciones} centro={centro} onChanged={onChanged} />

          {/* Centros de servicio: donde la persona sale en los desplegables. El BE devuelve TODOS los centros
              con un `activo` por cada uno (ya resuelto, sin replicar reglas). Marca/desmarca y guarda. */}
          <CentrosDePersona persona={persona} centro={centro} />

          {/* Aterrizar en Consulta al entrar a Frontdesk (handoff aterrizar-en-consulta-handoff-fe):
              BE PR #386 EN REVISIÓN, sin desplegar a esta fecha — el interruptor guarda su propio PUT,
              separado de cargo/capacidades, para que un 400 de "campo desconocido" de hoy no toque nada
              más. Mientras el BE no despliegue, esto no hace nada observable (el campo no existe). */}
          <FrontdeskConsultaPreferencia persona={persona} centro={centro} />

          {/* Acceso al sistema */}
          <div className="border-t pt-4">
            <Label className="mb-2 block">{t("acceso")}</Label>
            {persona.profileId ? (
              <div className="flex flex-wrap items-center gap-3 rounded-md border border-success/30 bg-success/10 text-success px-3 py-2 text-sm">
                <HugeiconsIcon icon={UserAccountIcon} className="size-4 text-success" />
                <span>{persona.email || t("conCuenta")}{persona.profileId ? ` · ${t("aprobado")}` : ""}</span>
                <Link href="/admin" className="ml-auto text-xs font-medium text-primary hover:underline">{t("verUsuario")}</Link>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">{t("sinCuentaAyuda")}</span>
                <Button size="sm" onClick={() => setDarAcceso(true)}>{t("darAcceso")}</Button>
              </div>
            )}
          </div>

          {/* Vincular con el EHR: en TODA ficha, sin excepción (decisión del dueño, 01-oct-2026) —
              cualquier cargo puede necesitar la cuenta, no se gatea por capacidad/rol. */}
          <EhrLinkSection persona={persona} roles={ehrRoles} link={ehrLink} centerIds={ehrCenterIds} centro={centro} onChanged={onEhrChanged} />
        </TabsContent>

        <TabsContent value="disponibilidad" className="pt-2">
          <MedicoDisponibilidad doctorId={persona.id} centro={centro} />
        </TabsContent>
        {puedeAgenda && <TabsContent value="agenda" className="pt-2"><MedicoAgenda doctorId={persona.id} /></TabsContent>}
        {puedePacientes && <TabsContent value="pacientes" className="pt-2"><MedicoPacientes doctorId={persona.id} centro={centro} /></TabsContent>}
        {puedeProduccion && <TabsContent value="produccion" className="pt-2"><MedicoProduccion doctorId={persona.id} centro={centro} /></TabsContent>}
      </Tabs>

      {darAcceso && (
        <DarAccesoDialog
          persona={persona}
          roles={roles}
          centro={centro}
          onClose={() => setDarAcceso(false)}
          onDone={() => { setDarAcceso(false); onChanged(); }}
        />
      )}
    </div>
  );
}
