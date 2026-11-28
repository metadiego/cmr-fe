"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { UserAccountIcon, UserAdd01Icon } from "@hugeicons/core-free-icons";

import { listPersonalAll, type Personal, type PersonalConPreferenciaFrontdesk, type PersonalEnAlcance } from "@/lib/api/personal";
import { FichaEditor, StaffActiveButton } from "@/components/personal/ficha-editor";
import { SaveGroup } from "@/components/personal/save-group";
import { showsConsultaPreferences } from "@/lib/personal/responsibilities";
import { holdsFunction } from "@/lib/personal/functions";
import { getFunctions, getStaffFunctions, type CatalogFunction, type StaffFunction } from "@/lib/api/functions";
import { getCenters, type Centro } from "@/lib/api/centers";
import { StaffFunctionsSection } from "@/components/personal/staff-functions-section";
import { StaffSchedule } from "@/components/personal/staff-schedule";
import { StaffDayChanges } from "@/components/personal/staff-day-changes";
import { HomeCenterField } from "@/components/personal/home-center-field";
import { NuevoPersonalDialog } from "@/components/personal/nuevo-personal-dialog";
import { StaffList } from "@/components/personal/staff-list";
import { FrontdeskConsultaPreferencia } from "@/components/personal/staff-record-sections";
import { StaffPositionsSection } from "@/components/personal/staff-positions-section";
import { DarAccesoDialog } from "@/components/personal/give-access-dialog";
import { getPositions, type Position } from "@/lib/api/positions";
import { getProfiles, type Perfil } from "@/lib/api/profiles";
import { InviteDialog } from "@/components/admin/invite-dialog";
import { UserAccessPanel } from "@/components/admin/user-access-panel";
import { ACCESS_FILTERS, accessOf, countByAccess, filterByAccess, type AccessFilter } from "@/lib/personal/staff-access";
import { useMe, isAdmin } from "@/hooks/use-me";
import { cn } from "@/lib/utils";
import { getEhrRoles, listEhrStaffLinks, type EhrRole, type EhrStaffLink } from "@/lib/api/ehr-integration";
import { getCentrosDondePuedo } from "@/lib/api/centers";
import { staffFullName as nombreDe } from "@/lib/personal/staff-name";
import { EhrLinkSection } from "@/components/personal/ehr-link-section";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { useClinicFilter } from "@/hooks/use-clinic-filter";
import { useFillViewportHeight } from "@/hooks/use-fill-viewport-height";
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
  const tAdmin = useTranslations("admin");
  const filter = useClinicFilter("personal.read");
  const create = useCreateClinic("personal.create", filter.choice);
  const [verInactivos, setVerInactivos] = React.useState(false);
  const [nuevoOpen, setNuevoOpen] = React.useState(false);
  // Staff and Users are one list: every login has a staff record. An admin also loads the logins
  // (managing access needs full access in the BE) to show their status and manage them on the record.
  const me = useMe();
  const admin = me.kind === "ok" && isAdmin(me.me);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [access, setAccess] = React.useState<AccessFilter>("all");
  const profilesRes = useResource<Perfil[]>(() => (admin ? getProfiles() : Promise.resolve([])), [admin]);
  const profilesById = React.useMemo(
    () => new Map((profilesRes.state.kind === "ok" ? profilesRes.state.data : []).map((p) => [p.id, p])),
    [profilesRes.state],
  );
  const listRes = useResource<PersonalEnAlcance[]>(
    () => listPersonalAll({ onlyInactive: verInactivos }, filter.choice),
    [filter.choiceKey, verInactivos],
  );
  const personal = React.useMemo(
    () => (listRes.state.kind === "ok" ? listRes.state.data : []),
    [listRes.state],
  );
  // Catálogo de cargos del BE: one closed list, the same in every clinic.
  const positionsRes = useResource<Position[]>(() => getPositions());
  const positions = positionsRes.state.kind === "ok" ? positionsRes.state.data : [];
  // La cuenta del EHR no es por centro (una persona, una cuenta) pero el BE la guarda contra el centro
  // donde se creó: se piden TODOS los centros donde el que mira tiene ehr-integration.read (verificado
  // en vivo 2026-10-01). Tolerante al fallo: sin BE, sencillamente no hay vínculos que mostrar.
  const ehrCentrosRes = useResource<Awaited<ReturnType<typeof getCentrosDondePuedo>>>(
    () => getCentrosDondePuedo("ehr-integration.read").catch(() => []),
    [],
  );
  const ehrCenterIds = ehrCentrosRes.state.kind === "ok" ? ehrCentrosRes.state.data.map((c) => c.id) : undefined;
  // Functions catalog (inactive ones too: a person may still hold one) and the centers the record's
  // sections need: every center, where the viewer reads staff, where they edit it.
  const functionsRes = useResource<CatalogFunction[]>(() => getFunctions(true));
  const functionCatalog = React.useMemo(() => (functionsRes.state.kind === "ok" ? functionsRes.state.data : []), [functionsRes.state]);
  const functionsError = functionsRes.state.kind === "fail" ? functionsRes.state.message : null;
  const centersRes = useResource<Centro[]>(() => getCenters());
  const staffReadRes = useResource(() => getCentrosDondePuedo("staff.read").catch(() => []));
  const staffUpdateRes = useResource(() => getCentrosDondePuedo("staff.update").catch(() => []));
  const scope = React.useMemo(
    () => ({
      all: centersRes.state.kind === "ok" ? centersRes.state.data : [],
      read: staffReadRes.state.kind === "ok" ? staffReadRes.state.data : [],
      update: staffUpdateRes.state.kind === "ok" ? staffUpdateRes.state.data : [],
    }),
    [centersRes.state, staffReadRes.state, staffUpdateRes.state],
  );
  const ehrCenterKey = ehrCenterIds?.join(",");
  const ehrLinksRes = useResource<EhrStaffLink[]>(
    () => (ehrCenterIds ? listEhrStaffLinks(undefined, ehrCenterIds).catch(() => []) : Promise.resolve([])),
    [ehrCenterKey],
  );
  const ehrLinks = ehrLinksRes.state.kind === "ok" ? ehrLinksRes.state.data : [];

  const [q, setQ] = React.useState("");
  const [selId, setSelId] = React.useState<string>("");
  // On desktop the screen fits the window: the list and the record each scroll inside their card,
  // the page itself does not. On narrow screens (no height) the page scrolls as usual.
  const gridRef = React.useRef<HTMLDivElement>(null);
  const fillHeight = useFillViewportHeight(gridRef);

  // Responsibilities offered: every tag in use by real staff (there is no separate catalogue).

  const accessCounts = countByAccess(personal, profilesById);
  const filtrados = filterByAccess(personal, access, profilesById)
    .filter((p) => {
      const n = q.trim().toLowerCase();
      return !n || nombreDe(p).toLowerCase().includes(n) || (p.jobTitle ?? "").toLowerCase().includes(n);
    })
    .sort((a, b) => nombreDe(a).localeCompare(nombreDe(b)));
  // "Assign now" after an invite opens the new login's staff record once the list has it.
  const [openProfileId, setOpenProfileId] = React.useState<string | null>(null);
  const invited = openProfileId ? personal.find((p) => p.profileId === openProfileId) : undefined;
  if (invited) {
    setOpenProfileId(null);
    setSelId(invited.id);
  }
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
      <div
        ref={gridRef}
        style={fillHeight ? { height: fillHeight } : undefined}
        className="grid grid-cols-1 gap-6 lg:grid-cols-[20rem_1fr] lg:grid-rows-[minmax(0,1fr)]"
      >
        {/* Lista */}
        <aside className="flex min-h-0 flex-col gap-3 rounded-xl border bg-card p-3 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {create.canCreate && <Button size="sm" onClick={() => setNuevoOpen(true)}>{t("nuevo")}</Button>}
              {admin && (
                <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}>
                  <HugeiconsIcon icon={UserAdd01Icon} data-icon="inline-start" />
                  {tAdmin("users.invite")}
                </Button>
              )}
            </div>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" checked={verInactivos} onChange={(e) => { setVerInactivos(e.target.checked); setSelId(""); }} className="size-3.5" />
              {t("verInactivos")}
            </label>
          </div>
          <div role="group" aria-label={t("accessFilter")} className="flex flex-wrap items-center gap-0.5 rounded-lg bg-muted p-0.5">
            {ACCESS_FILTERS.filter((f) => f === "all" || f !== "suspended" || accessCounts.suspended > 0).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={access === f}
                onClick={() => { setAccess(f); setSelId(""); }}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
                  access === f && "bg-background text-foreground shadow-sm",
                )}
              >
                {t(`access.${f}`)}
                <span className="tabular-nums text-muted-foreground">{accessCounts[f]}</span>
              </button>
            ))}
          </div>
          <StaffList
            isSuspended={(p) => accessOf(p, profilesById) === "suspended"}
            people={filtrados}
            positions={positions}
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
        <section className="min-h-0">
          {sel ? (
            <FichaPersonal
              key={sel.id}
              persona={sel}
              positions={positions}
              functionCatalog={functionCatalog}
              functionsError={functionsError}
              scope={scope}
              positionsError={positionsRes.state.kind === "fail" ? positionsRes.state.message : null}
              ehrRoles={ehrRoles}
              ehrLink={ehrLinks.find((l) => l.staffId === sel.id)}
              profile={admin && sel.profileId ? profilesById.get(sel.profileId) : undefined}
              onProfileChanged={() => profilesRes.refresh()}
              ehrCenterIds={ehrCenterIds}
              centro={selClinic}
              centroNombre={filter.showColumn ? (sel.clinicName ?? filter.nameOf(selClinic)) : ""}
              onChanged={() => listRes.refresh()}
              onEhrChanged={() => ehrLinksRes.reload()}
            />
          ) : (
            <div className="flex h-full min-h-[40vh] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
              {t("elegirPersona")}
            </div>
          )}
        </section>
      </div>

      {admin && (
        <InviteDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          onInvited={() => { listRes.refresh(); profilesRes.refresh(); }}
          onRequestAssign={(p) => { setAccess("all"); setOpenProfileId(p.id); }}
        />
      )}

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

type CenterScope = { all: Centro[]; read: { id: string; name: string }[]; update: { id: string; name: string }[] };

function FichaPersonal({
  persona, positions, functionCatalog, functionsError, scope, positionsError, ehrRoles, ehrLink, ehrCenterIds, profile, onProfileChanged, centro, centroNombre, onChanged, onEhrChanged,
}: {
  /** The person's login, when the viewer is an admin (only an admin manages access). */
  profile: Perfil | undefined;
  onProfileChanged: () => void;
  persona: Personal;
  /** The position catalog (`GET /positions`). */
  positions: Position[];
  /** The functions catalog (`GET /functions?includeInactive=true`). */
  functionCatalog: CatalogFunction[];
  /** Why the functions catalog did not load. */
  functionsError: string | null;
  /** Every center, and where the viewer holds staff.read / staff.update. */
  scope: CenterScope;
  /** Why the catalog did not load, if it failed. */
  positionsError: string | null;
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
  const me = useMe();
  const viewerIsAdmin = me.kind === "ok" && isAdmin(me.me);
  // Hub de USUARIO en la MISMA pantalla (sin ir «más adentro»): la ficha, y —solo para quien hace
  // consultas, es decir tiene la capacidad «medico»— su agenda, pacientes y producción. La disponibilidad
  // (horarios, días libres, permisos, vacaciones) es para TODO usuario por igual. Ver hub-de-usuario-medicos.
  // What the person does = their Functions (no longer job title / capabilities).
  const functionsRes = useResource<StaffFunction[]>(() => getStaffFunctions(persona.id, centro), [persona.id, centro]);
  const [savedFunctions, setSavedFunctions] = React.useState<StaffFunction[] | null>(null);
  const heldFunctions = savedFunctions ?? (functionsRes.state.kind === "ok" ? functionsRes.state.data : null);
  const editableIds = React.useMemo(() => new Set(scope.update.map((c) => c.id)), [scope.update]);
  const canEditRecord = !!centro && editableIds.has(centro);
  const functionSlugs = React.useMemo(() => functionCatalog.map((f) => f.slug), [functionCatalog]);
  const activeCenters = scope.all.filter((c) => c.active !== false);
  const esMedico = holdsFunction(heldFunctions, "doctor");
  const puedeAgenda = esMedico && can("citas.read");
  const puedePacientes = esMedico && can("pacientes.read");
  const puedeProduccion = esMedico && can("citas.read");

  return (
    <div className="h-full space-y-6 overflow-y-auto rounded-xl border bg-card p-6 shadow-xs">
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
          <TabsTrigger value="horario">{tRoot("staffSchedule.tab")}</TabsTrigger>
          {puedeAgenda && <TabsTrigger value="agenda">{tRoot("medicoHub.tabs.agenda")}</TabsTrigger>}
          {puedePacientes && <TabsTrigger value="pacientes">{tRoot("medicoHub.tabs.patients")}</TabsTrigger>}
          {puedeProduccion && <TabsTrigger value="produccion">{tRoot("medicoHub.tabs.production")}</TabsTrigger>}
        </TabsList>

        <TabsContent value="ficha" className="pt-2">
          {/* One "Save" for every section below (save-group.tsx); deactivate is its own action. */}
          <SaveGroup onSaved={() => { onChanged(); onProfileChanged(); }} footerStart={<StaffActiveButton persona={persona} centro={centro} onChanged={onChanged} />}>
            <div className="space-y-6">
              <FichaEditor persona={persona} centro={centro} isDoctor={esMedico} />

              {centro && (
                <HomeCenterField staffId={persona.id} current={centro} centers={scope.all} editable={editableIds} />
              )}

              {/* What the person does: services and tasks, no center. */}
              <StaffFunctionsSection
                staffId={persona.id}
                catalog={functionCatalog}
                catalogError={functionsError ?? (functionsRes.state.kind === "fail" ? functionsRes.state.message : null)}
                held={heldFunctions}
                canEdit={canEditRecord}
                centro={centro}
                onSaved={(now) => { setSavedFunctions(now); onChanged(); }}
              />

              {/* What the person can open, per center: administrators only. */}
              {viewerIsAdmin && (
                <StaffPositionsSection persona={persona} catalog={positions} functionSlugs={functionSlugs} catalogError={positionsError ?? functionsError} centro={centro} />
              )}

              {/* Front-desk preferences, only for front-desk staff (or whoever already has one set). */}
              {showsConsultaPreferences(holdsFunction(heldFunctions, "front_desk"), persona as PersonalConPreferenciaFrontdesk) && (
                <FrontdeskConsultaPreferencia persona={persona} centro={centro} />
              )}

              {/* System access */}
              <div className="border-t pt-4">
                <Label className="mb-2 block">{t("acceso")}</Label>
                {profile ? (
                  <UserAccessPanel profile={profile} onChanged={onProfileChanged} />
                ) : persona.profileId ? (
                  <div className="flex flex-wrap items-center gap-3 rounded-md border border-success/30 bg-success/10 text-success px-3 py-2 text-sm">
                    <HugeiconsIcon icon={UserAccountIcon} className="size-4 text-success" />
                    <span>{persona.email || t("conCuenta")}</span>
                  </div>
                ) : viewerIsAdmin ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">{t("sinCuentaAyuda")}</span>
                    <Button size="sm" onClick={() => setDarAcceso(true)}>{t("darAcceso")}</Button>
                  </div>
                ) : (
                  // Giving system access is access management: an administrator's call (cmr-be).
                  <span className="text-sm text-muted-foreground">{tRoot("staffPositions.giveAccessNeedsAdmin")}</span>
                )}
              </div>

              {/* EHR account: on every record (owner, 01-oct-2026): any job title may need it. */}
              <EhrLinkSection persona={persona} roles={ehrRoles} link={ehrLink} centerIds={ehrCenterIds} centro={centro} onChanged={onEhrChanged} />
            </div>
          </SaveGroup>
        </TabsContent>

        <TabsContent value="horario" className="space-y-6 pt-2">
          <StaffSchedule staffId={persona.id} readCenters={scope.read} editableCenters={scope.update} />
          <StaffDayChanges staffId={persona.id} homeCenter={centro} centers={activeCenters} canEdit={canEditRecord} />
          <MedicoDisponibilidad doctorId={persona.id} centro={centro} />
        </TabsContent>
        {puedeAgenda && <TabsContent value="agenda" className="pt-2"><MedicoAgenda doctorId={persona.id} /></TabsContent>}
        {puedePacientes && <TabsContent value="pacientes" className="pt-2"><MedicoPacientes doctorId={persona.id} centro={centro} /></TabsContent>}
        {puedeProduccion && <TabsContent value="produccion" className="pt-2"><MedicoProduccion doctorId={persona.id} centro={centro} /></TabsContent>}
      </Tabs>

      {darAcceso && (
        <DarAccesoDialog
          persona={persona}
          centro={centro}
          onClose={() => setDarAcceso(false)}
          onDone={() => { setDarAcceso(false); onChanged(); onProfileChanged(); }}
        />
      )}
    </div>
  );
}
