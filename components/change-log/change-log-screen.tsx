"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { listPersonal, type PersonalEnAlcance } from "@/lib/api/personal";
import { buscarPaciente, type PacienteBusqueda } from "@/lib/api/facturas";
import { useCan } from "@/hooks/use-can";
import { useClinicFilter } from "@/hooks/use-clinic-filter";
import { useResource } from "@/hooks/use-resource";
import { ChangeLogList } from "@/components/change-log/change-log-list";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// «Historial de cambios» at full screen (BE #529, /monitoring/change-log, change_log.read): who changed
// what, filtered by user, patient, dates and center, with undo where allowed.
const ALL = "__all__";
const today = () => new Date(Date.now() - 4 * 3_600_000).toISOString().slice(0, 10); // Puerto Rico (UTC-4, no DST)

export function ChangeLogScreen() {
  const t = useTranslations("changeLog");
  const { can, ready } = useCan();
  const filter = useClinicFilter("change_log.read");
  const [from, setFrom] = React.useState(today());
  const [to, setTo] = React.useState(today());
  const [staffId, setStaffId] = React.useState(ALL);
  const [q, setQ] = React.useState("");
  const [patient, setPatient] = React.useState<{ id: string; name: string } | null>(null);
  const staffRes = useResource(() => listPersonal({ limit: 200 }), []);
  const staff: PersonalEnAlcance[] = staffRes.state.kind === "ok" ? staffRes.state.data.items : [];
  const [found, setFound] = React.useState<PacienteBusqueda[]>([]);

  React.useEffect(() => {
    if (q.trim().length < 2) return;
    let alive = true;
    const id = setTimeout(() => buscarPaciente(q.trim()).then((r) => alive && setFound(r.slice(0, 8))).catch(() => {}), 250);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [q]);

  if (ready && !can("change_log.read")) return <PageContainer className="text-center text-sm text-muted-foreground">{t("noPermission")}</PageContainer>;

  // The clinics of the top bar (every readable one on «Ambos»), as the other lists.
  const centerIds = filter.choice ? [...filter.choice] : undefined;
  const listFilter = {
    from: from ? `${from}T00:00:00-04:00` : undefined,
    to: to ? `${to}T23:59:59-04:00` : undefined,
    actorStaffId: staffId !== ALL ? staffId : undefined,
    patientId: patient?.id,
    centerIds,
  };

  return (
    <PageContainer className="w-full px-6">
      <PageHeader title={t("title")} description={t("screenHint")} />
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t("filter.from")}
          <DatePicker value={from} onChange={setFrom} clearable className="h-8 w-[150px]" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t("filter.to")}
          <DatePicker value={to} onChange={setTo} clearable className="h-8 w-[150px]" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t("filter.user")}
          <Select value={staffId} onValueChange={setStaffId}>
            <SelectTrigger size="sm" className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("filter.allUsers")}</SelectItem>
              {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        <div className="relative flex flex-col gap-1 text-xs text-muted-foreground">
          {t("filter.patient")}
          {patient ? (
            <div className="flex h-8 items-center gap-2 rounded-md border px-2 text-sm text-foreground">
              {patient.name}
              <Button size="sm" variant="ghost" className="h-6 px-1" onClick={() => setPatient(null)}>×</Button>
            </div>
          ) : (
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("filter.patientHint")} className="h-8 w-[240px]" />
          )}
          {!patient && q.trim().length >= 2 && found.length > 0 && (
            <ul className="absolute top-full z-20 mt-1 w-[320px] rounded-md border bg-popover p-1 text-sm text-foreground shadow-md">
              {found.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="w-full rounded px-2 py-1 text-left hover:bg-muted"
                    onClick={() => {
                      setPatient({ id: p.id, name: p.displayName ?? [p.lastName, p.firstName].filter(Boolean).join(", ") });
                      setQ("");
                      setFound([]);
                    }}
                  >
                    {p.displayName ?? [p.lastName, p.firstName].filter(Boolean).join(", ")}
                    {p.medicalRecordNumber ? <span className="ml-2 text-xs text-muted-foreground">#{p.medicalRecordNumber}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {filter.loading ? null : <ChangeLogList filter={listFilter} showPatient pageSize={100} />}
    </PageContainer>
  );
}
