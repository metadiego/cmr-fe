"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  listResources,
  createResource,
  updateResource,
  deactivateResource,
  type Resource,
  type ResourceConcurrency,
} from "@/lib/api/resources";
import { listPersonal, getStaff, type Personal } from "@/lib/api/personal";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { useCentroPantalla, type CentroPantalla } from "@/hooks/use-centro-pantalla";
import { ConfigGuard } from "@/components/configuracion/config-guard";
import { CentroPantallaSelector } from "@/components/centro-pantalla-selector";
import { ServiceResourcesEditor } from "@/components/configuracion/service-resources-editor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Field } from "@/components/kit/form-dialog";
import { DataTable } from "@/components/ui/data-table";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page";

// Configuración → Recursos: el CUELLO de la agenda de terapias (cuartos, sillas, personas). Todo por API,
// nada quemado — sin esta pantalla el cuadro volvería a vivir en un script. DELETE = DESACTIVA (regla del
// dueño): la UI dice «Desactivar», nunca «Eliminar». Handoff HANDOFF-FE-agenda-de-terapias.
//
// Standalone page (/configuration/resources). The scheduling config hub (`AgendaConfig`) does not
// mount this: it shows the two sections as top-level tabs of its own via `ResourcesSection`, so the
// screen has ONE row of tabs instead of tabs nested inside a tab.
export function ResourcesConfig() {
  const t = useTranslations("resources");
  const estado = useCentroPantalla("resources.read", "resources.config");
  return (
    <ConfigGuard permiso="resources.read">
      <PageHeader title={t("title")} description={t("description")} actions={<CentroPantallaSelector estado={estado} />} />
      <Tabs defaultValue="resources">
        <TabsList className="mb-4">
          <TabsTrigger value="resources">{t("tabResources")}</TabsTrigger>
          <TabsTrigger value="consumption">{t("tabConsumo")}</TabsTrigger>
        </TabsList>
        <TabsContent value="resources">
          <ResourcesSection estado={estado} section="resources" />
        </TabsContent>
        <TabsContent value="consumption">
          <ResourcesSection estado={estado} section="consumption" />
        </TabsContent>
      </Tabs>
    </ConfigGuard>
  );
}

// One section of resource configuration for the centre picked in `estado`: the resource list, or
// how much of each resource every service consumes. The caller owns the centre selector and the guard.
export function ResourcesSection({
  estado,
  section,
}: {
  estado: CentroPantalla;
  section: "resources" | "consumption";
}) {
  const t = useTranslations("resources");
  if (estado.cargando) return null;
  if (!estado.centroActivo) return <p className="text-sm text-muted-foreground">{t("elegirCentro")}</p>;
  return section === "resources" ? (
    <ResourcesList centroId={estado.fetchCentroId} puedeEscribir={estado.puedeEscribir} />
  ) : (
    <ServiceResourcesEditor centroId={estado.fetchCentroId} puedeEscribir={estado.puedeEscribir} />
  );
}

function ResourcesList({ centroId, puedeEscribir }: { centroId?: string; puedeEscribir: boolean }) {
  const t = useTranslations("resources");
  const tRoot = useTranslations();
  const { state, reload } = useResource<Resource[]>(() => listResources(centroId), [centroId]);
  const [editing, setEditing] = React.useState<Resource | "new" | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const concLabel = (c: ResourceConcurrency) => t(`concurrency.${c}`);

  async function toggleActivo(r: Resource) {
    setBusyId(r.id);
    try {
      if (r.active) await deactivateResource(r.id, centroId);
      else await updateResource(r.id, { active: true }, centroId);
      toast.success(r.active ? t("deactivated") : t("activated"));
      reload();
    } catch (e) {
      toastError(e, tRoot);
    } finally {
      setBusyId(null);
    }
  }

  if (state.kind === "loading") return <p className="text-sm text-muted-foreground">{tRoot("common.loading")}</p>;
  if (state.kind === "fail") return <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.message}</p>;

  return (
    <section className="space-y-4">
      {puedeEscribir && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setEditing("new")}>{t("add")}</Button>
        </div>
      )}
      <DataTable>
        <TableHeader>
          <TableRow>
            <TableHead>{t("colName")}</TableHead>
            <TableHead>{t("colKind")}</TableHead>
            <TableHead className="text-right">{t("colCapacity")}</TableHead>
            <TableHead>{t("colConcurrency")}</TableHead>
            <TableHead>{t("colServices")}</TableHead>
            <TableHead className="text-right">{t("colMaxMin")}</TableHead>
            <TableHead>{t("colStaff")}</TableHead>
            <TableHead>{t("colStatus")}</TableHead>
            {puedeEscribir && <TableHead className="text-right">{t("colActions")}</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {state.data.map((r) => (
            <TableRow key={r.id} className={r.active ? "" : "opacity-50"}>
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell className="text-muted-foreground">{r.kind}</TableCell>
              <TableCell className="text-right tabular-nums">{r.capacity}</TableCell>
              <TableCell>{concLabel(r.concurrency)}</TableCell>
              <TableCell className="text-muted-foreground">
                {!r.services?.length ? (
                  "—"
                ) : (
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
                    {r.services.map((s) => (
                      <span key={s.serviceId} className="whitespace-nowrap">
                        {s.name} <span className="tabular-nums">{s.minutes}</span>
                        {s.per === "area" ? t("perArea") : ""}
                      </span>
                    ))}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">{r.maxMinutesPerPatient ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">
                {r.effectiveStaffRole ?? "—"}
                {r.blocksStaffAgenda && <Badge variant="warning" className="ml-2">{t("blocksAgenda")}</Badge>}
              </TableCell>
              <TableCell>
                <Badge variant={r.active ? "success" : "outline"}>{r.active ? t("active") : t("inactive")}</Badge>
              </TableCell>
              {puedeEscribir && (
                <TableCell className="space-x-2 text-right">
                  <Button size="sm" variant="outline" onClick={() => setEditing(r)}>{t("edit")}</Button>
                  <Button size="sm" variant="outline" onClick={() => toggleActivo(r)} disabled={busyId === r.id}>
                    {r.active ? t("deactivate") : t("activate")}
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
          {state.data.length === 0 && (
            <TableRow><TableCell colSpan={puedeEscribir ? 8 : 7} className="py-6 text-center text-sm text-muted-foreground">{t("empty")}</TableCell></TableRow>
          )}
        </TableBody>
      </DataTable>

      {editing && (
        <ResourceDialog
          resource={editing === "new" ? null : editing}
          centroId={centroId}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      )}
    </section>
  );
}

type Form = {
  slug: string; name: string; labelKey: string; kind: string;
  capacity: string; concurrency: ResourceConcurrency; maxMinutesPerPatient: string;
  staffRole: string; staffId: string; blocksStaffAgenda: boolean;
};
const EMPTY: Form = {
  slug: "", name: "", labelKey: "", kind: "room",
  capacity: "1", concurrency: "sequential", maxMinutesPerPatient: "",
  staffRole: "", staffId: "", blocksStaffAgenda: false,
};

function ResourceDialog({ resource, centroId, onClose, onSaved }: {
  resource: Resource | null; centroId?: string; onClose: () => void; onSaved: () => void;
}) {
  const t = useTranslations("resources");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const [form, setForm] = React.useState<Form>(() =>
    resource
      ? {
          slug: resource.slug, name: resource.name, labelKey: resource.labelKey ?? "", kind: resource.kind,
          capacity: String(resource.capacity), concurrency: resource.concurrency,
          maxMinutesPerPatient: resource.maxMinutesPerPatient != null ? String(resource.maxMinutesPerPatient) : "",
          staffRole: resource.staffRole ?? "", staffId: resource.staffId ?? "", blocksStaffAgenda: resource.blocksStaffAgenda,
        }
      : EMPTY,
  );
  const [busy, setBusy] = React.useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const puedeGuardar = form.slug.trim() && form.name.trim() && Number(form.capacity) > 0;

  async function guardar() {
    if (!puedeGuardar || busy) return;
    setBusy(true);
    try {
      const payload = {
        slug: form.slug.trim(), name: form.name.trim(), labelKey: form.labelKey.trim() || null,
        kind: form.kind, capacity: Number(form.capacity), concurrency: form.concurrency,
        maxMinutesPerPatient: form.maxMinutesPerPatient.trim() ? Number(form.maxMinutesPerPatient) : null,
        staffRole: form.staffRole.trim() || null,
        staffId: form.staffId.trim() || null, blocksStaffAgenda: form.blocksStaffAgenda,
      };
      if (resource) await updateResource(resource.id, payload, centroId);
      else await createResource(payload, centroId);
      toast.success(resource ? t("updated") : t("created"));
      onSaved();
    } catch (e) {
      toastError(e, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{resource ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>{t("createHelp")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("fName")}><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label={t("fSlug")}><Input value={form.slug} onChange={(e) => set("slug", e.target.value)} className="font-mono" placeholder="laser_rooms" /></Field>
          <Field label={t("fKind")}>
            <Select
              value={form.kind}
              onValueChange={(v) =>
                setForm((f) =>
                  // Leaving "person": staffId/blocksStaffAgenda are meaningless for a room/chair/machine
                  // and must not ride along silently — otherwise a room could save with a real staffId
                  // and blocksStaffAgenda:true from before the kind change, telling the scheduler to
                  // block an unrelated person's agenda for a room booking. Found by adversarial review
                  // before merging (2026-09-27) — impossible before this PR (staffId was always null).
                  v === "person" ? { ...f, kind: v } : { ...f, kind: v, staffId: "", blocksStaffAgenda: false },
                )
              }
            >
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="room">{t("kind.room")}</SelectItem>
                <SelectItem value="chair">{t("kind.chair")}</SelectItem>
                <SelectItem value="person">{t("kind.person")}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("fCapacity")}><Input type="number" min={1} value={form.capacity} onChange={(e) => set("capacity", e.target.value)} /></Field>
          <div className="sm:col-span-2 grid gap-1.5">
            <Field label={t("fConcurrency")}>
              <Select value={form.concurrency} onValueChange={(v) => set("concurrency", v as ResourceConcurrency)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sequential">{t("concurrency.sequential")}</SelectItem>
                  <SelectItem value="simultaneous">{t("concurrency.simultaneous")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {/* La regla que va al revés: hay que explicarla en pantalla. */}
            <p className="text-xs text-muted-foreground">{t(`concurrency.help.${form.concurrency}`)}</p>
          </div>
          <Field label={t("fMaxMin")}><Input type="number" min={0} value={form.maxMinutesPerPatient} onChange={(e) => set("maxMinutesPerPatient", e.target.value)} placeholder={t("fMaxMinPlaceholder")} /></Field>
          <Field label={t("fStaffRole")}><Input value={form.staffRole} onChange={(e) => set("staffRole", e.target.value)} placeholder="tecnico" /></Field>
          {/* Solo cuando el recurso ES una persona (kind: person, p. ej. la doctora de EMPOWER): antes no
              había forma de elegirla, así que `staffId` siempre se guardaba null y el bloqueo de agenda
              (staffBlocks) nunca se activaba. Handoff HANDOFF-FE-staff-picker-recursos-persona. */}
          {form.kind === "person" && (
            <Field label={t("fStaffId")}>
              <StaffSelectField value={form.staffId} onChange={(v) => set("staffId", v)} centroId={centroId} />
            </Field>
          )}
        </div>
        {/* Solo tiene sentido para un recurso que ES una persona (la doctora de EMPOWER) — antes se
            mostraba siempre, para cualquier kind, aunque staffId nunca se pudiera elegir. */}
        {form.kind === "person" && (
          <div className="mt-2 flex items-start justify-between gap-4 rounded-md bg-muted/30 p-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">{t("fBlocksAgenda")}</p>
              <p className="text-xs text-muted-foreground">{t("fBlocksAgendaHelp")}</p>
            </div>
            <Switch checked={form.blocksStaffAgenda} onCheckedChange={(v) => set("blocksStaffAgenda", v)} />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>{tc("cancel")}</Button>
          <Button onClick={guardar} disabled={!puedeGuardar || busy}>{busy ? tc("saving") : tc("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const NONE = "__none__";

// Selector de personal para un recurso `kind: person` (p. ej. la doctora de EMPOWER): antes no existía
// ningún control para esto, así que `staffId` siempre se guardaba `null` y `staffBlocks` (el bloqueo de
// agenda al agendar) nunca se activaba — el campo ya existía y ya se validaba en el BE, solo faltaba la
// UI. No se limita a médicos (`getMedicos`): el modelo de recursos-persona es genérico a propósito.
// Mismo patrón que components/clientes/medico-select-field.tsx. Handoff
// HANDOFF-FE-staff-picker-recursos-persona.
function StaffSelectField({
  value,
  onChange,
  centroId,
}: {
  value: string;
  onChange: (v: string) => void;
  centroId?: string;
}) {
  const t = useTranslations("resources");
  const { state } = useResource<Personal[]>(
    // 100 = el tope real del BE (verificado en vivo: pedir 200 devuelve 400 "limit must not be greater
    // than 100"), no un número elegido a ojo.
    () => listPersonal({ limit: 100 }, centroId).then((r) => r.items),
    [centroId],
  );
  const personal = state.kind === "ok" ? state.data : [];
  // Ya elegido pero no en la lista del centro activo (p. ej. persona activa en otro centro, ver
  // updatePersonalCentros): se conserva por id en vez de perderse en silencio al guardar sin tocar este
  // campo. Se resuelve su nombre real con una llamada aparte — un id crudo como etiqueta no le dice a
  // nadie quién es esa persona.
  const esForaneo = !!value && !personal.some((p) => p.id === value);
  const foraneoRes = useResource<Personal | null>(
    () => (esForaneo ? getStaff(value) : Promise.resolve(null)),
    [esForaneo, value],
  );
  const foraneo =
    esForaneo && foraneoRes.state.kind === "ok" && foraneoRes.state.data
      ? { id: value, label: [foraneoRes.state.data.name, foraneoRes.state.data.lastName].filter(Boolean).join(" ") }
      : esForaneo
        ? { id: value, label: value }
        : null;
  return (
    <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
      <SelectTrigger className="w-full"><SelectValue placeholder={t("fStaffIdPlaceholder")} /></SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{t("fStaffIdPlaceholder")}</SelectItem>
        {foraneo && <SelectItem value={foraneo.id}>{foraneo.label}</SelectItem>}
        {personal.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {[p.name, p.lastName].filter(Boolean).join(" ")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
