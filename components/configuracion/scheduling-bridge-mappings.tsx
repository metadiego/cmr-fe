"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import {
  listDoctorMappings,
  createDoctorMapping,
  updateDoctorMapping,
  deleteDoctorMapping,
  listAgentMappings,
  createAgentMapping,
  updateAgentMapping,
  deleteAgentMapping,
  type DoctorMapping,
  type AgentMapping,
} from "@/lib/api/scheduling-bridge";
import { listPersonal, type Personal } from "@/lib/api/personal";
import { useResource } from "@/hooks/use-resource";
import { MetaCrud } from "@/components/configuracion/meta-crud";
import { Field } from "@/components/kit/form-dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function staffName(p: Personal): string {
  return [p.name, p.lastName].filter(Boolean).join(" ");
}

const NO_STAFF: Personal[] = [];
// El techo de paginación es SISTÉMICO (PaginationQueryDto, @Max(100)) — verificado en vivo,
// limit:200 tira 400 "limit must not be greater than 100". Para no truncar el roster de un centro
// con más de 100 personas, se recorren las páginas hasta agotar `pagination.total`.
const STAFF_PAGE_LIMIT = 100;

async function fetchAllStaff(centroId?: string): Promise<Personal[]> {
  const out: Personal[] = [];
  let page = 1;
  for (;;) {
    const { items, pagination } = await listPersonal({ page, limit: STAFF_PAGE_LIMIT }, centroId);
    out.push(...items);
    if (out.length >= pagination.total || items.length === 0) break;
    page += 1;
  }
  return out;
}

// Fetched ONCE per table (not per row) and shared by the column display + the
// add/edit dialog's picker, to avoid an N+1 fetch across mapping rows.
function useStaffRoster(centroId?: string) {
  const { state } = useResource(() => fetchAllStaff(centroId), [centroId]);
  const staff = state.kind === "ok" ? state.data : NO_STAFF;
  const byId = React.useMemo(() => new Map(staff.map((p) => [p.id, p])), [staff]);
  return { staff, byId };
}

// A row was never touched since the automatic seed if it has no edit history —
// the API doesn't carry an explicit "provisional" flag (handoff gap), so this
// is an inferred heuristic, not a BE-guaranteed signal.
function looksUnedited(row: { createdAt: string; updatedAt: string }): boolean {
  return row.createdAt === row.updatedAt;
}

export function DoctorMappingsTable({ centroId, puedeEscribir }: { centroId?: string; puedeEscribir: boolean }) {
  const t = useTranslations("schedulingBridge.doctorMappings");
  const { staff, byId } = useStaffRoster(centroId);

  return (
    <MetaCrud<DoctorMapping>
      title={t("title")}
      addLabel={t("add")}
      load={() => listDoctorMappings(centroId)}
      deps={[centroId]}
      getRowKey={(r) => r.id}
      initialDraft={{ externalName: "", staffId: "" }}
      toDraft={(r) => ({ externalName: r.externalName, staffId: r.staffId })}
      canSubmit={(d) => !!(d.externalName as string)?.trim() && !!d.staffId}
      create={(d) => createDoctorMapping({ externalName: (d.externalName as string).trim(), staffId: d.staffId as string }, centroId)}
      update={(id, d) => updateDoctorMapping(id, { externalName: (d.externalName as string).trim(), staffId: d.staffId as string }, centroId)}
      remove={puedeEscribir ? (id) => deleteDoctorMapping(id, centroId) : undefined}
      readOnly={!puedeEscribir}
      columns={[
        { key: "externalName", header: t("externalName"), cell: (r) => <span className="font-mono text-sm">{r.externalName}</span> },
        { key: "staff", header: t("doctor"), cell: (r) => <span className="text-sm">{byId.get(r.staffId) ? staffName(byId.get(r.staffId)!) : r.staffId}</span> },
      ]}
      fields={(draft, patch) => (
        <>
          <Field label={t("externalName")}>
            <Input value={(draft.externalName as string) ?? ""} onChange={(e) => patch({ externalName: e.target.value })} />
          </Field>
          <Field label={t("doctor")}>
            <Select value={(draft.staffId as string) ?? ""} onValueChange={(id) => patch({ staffId: id })}>
              <SelectTrigger className="w-full"><SelectValue placeholder={t("selectDoctor")} /></SelectTrigger>
              <SelectContent>
                {staff.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{staffName(p)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </>
      )}
    />
  );
}

export function AgentMappingsTable({ centroId, puedeEscribir }: { centroId?: string; puedeEscribir: boolean }) {
  const t = useTranslations("schedulingBridge.agentMappings");
  const { staff, byId } = useStaffRoster(centroId);

  return (
    <MetaCrud<AgentMapping>
      title={t("title")}
      addLabel={t("add")}
      load={() => listAgentMappings(centroId)}
      deps={[centroId]}
      getRowKey={(r) => r.id}
      initialDraft={{ externalCode: "", staffId: "" }}
      toDraft={(r) => ({ externalCode: r.externalCode, staffId: r.staffId })}
      canSubmit={(d) => !!(d.externalCode as string)?.trim() && !!d.staffId}
      create={(d) => createAgentMapping({ externalCode: (d.externalCode as string).trim().toUpperCase(), staffId: d.staffId as string }, centroId)}
      update={(id, d) => updateAgentMapping(id, { externalCode: (d.externalCode as string).trim().toUpperCase(), staffId: d.staffId as string }, centroId)}
      remove={puedeEscribir ? (id) => deleteAgentMapping(id, centroId) : undefined}
      readOnly={!puedeEscribir}
      columns={[
        {
          key: "externalCode",
          header: t("externalCode"),
          cell: (r) => (
            <span className="flex items-center gap-2">
              <span className="font-mono text-sm">{r.externalCode}</span>
              {looksUnedited(r) && <Badge variant="warning">{t("provisional")}</Badge>}
            </span>
          ),
        },
        { key: "staff", header: t("agent"), cell: (r) => <span className="text-sm">{byId.get(r.staffId) ? staffName(byId.get(r.staffId)!) : r.staffId}</span> },
      ]}
      fields={(draft, patch) => (
        <>
          <Field label={t("externalCode")}>
            <Input
              value={(draft.externalCode as string) ?? ""}
              onChange={(e) => patch({ externalCode: e.target.value })}
              className="font-mono uppercase"
              maxLength={2}
            />
          </Field>
          <Field label={t("agent")}>
            <Select value={(draft.staffId as string) ?? ""} onValueChange={(id) => patch({ staffId: id })}>
              <SelectTrigger className="w-full"><SelectValue placeholder={t("selectAgent")} /></SelectTrigger>
              <SelectContent>
                {staff.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{staffName(p)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </>
      )}
    />
  );
}
