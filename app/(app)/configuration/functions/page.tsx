"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";

import {
  createFunction,
  getFunctions,
  updateFunction,
  type CatalogFunction,
  type FunctionKind,
  type FunctionPlace,
} from "@/lib/api/functions";
import { getServicios, type Servicio } from "@/lib/api/servicios";
import { functionLabel, groupFunctions } from "@/lib/personal/functions";
import { slugify } from "@/lib/frontdesk/nurse-status-tipo-form";
import { missingFields } from "@/lib/forms/missing";
import { useResource } from "@/hooks/use-resource";
import { ConfigGuard } from "@/components/configuracion/config-guard";
import { Panel, EmptyState, ErrorState, LoadingPanel, RecordTable, Th, Td } from "@/components/kit/panel";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormSheet } from "@/components/kit/form-sheet";
import { Field } from "@/components/kit/field";
import { useSubmit } from "@/components/kit/use-submit";

const PLACES: FunctionPlace[] = ["in_person", "any_center"];

// Configuración › Funciones (cmr-be handoff rol-de-acceso-funciones-y-horario §2.1): the catalog of
// what people do — services and tasks — each «Presencial» or «Para cualquier centro». Full access only
// (rbac.create / rbac.update). No delete: a function is hidden with `active:false` and whoever holds it
// keeps it. `kind` and the service never change after creation (the BE answers 400).
export default function FunctionsConfigPage() {
  const t = useTranslations("functionsConfig");
  const { state, reload } = useResource<CatalogFunction[]>(() => getFunctions(true));
  const [editing, setEditing] = React.useState<CatalogFunction | "new" | null>(null);
  const list = state.kind === "ok" ? state.data : [];
  const { tasks, services } = groupFunctions(list);

  return (
    <ConfigGuard permiso="rbac.update">
      <PageContainer>
        <PageHeader
          title={t("title")}
          description={t("help")}
          actions={
            <Button size="sm" onClick={() => setEditing("new")}>
              <HugeiconsIcon icon={Add01Icon} className="size-4" />
              {t("new")}
            </Button>
          }
        />
        {state.kind === "loading" && <LoadingPanel rows={6} />}
        {state.kind === "fail" && <ErrorState message={state.message} />}
        {state.kind === "ok" && (
          <div className="grid gap-6 xl:grid-cols-2">
            <FunctionsTable title={t("tasks")} rows={tasks} onEdit={setEditing} onChanged={reload} />
            <FunctionsTable title={t("services")} rows={services} onEdit={setEditing} onChanged={reload} />
          </div>
        )}
        {editing && (
          <FunctionSheet
            fn={editing === "new" ? null : editing}
            existing={list}
            onClose={() => setEditing(null)}
            onSaved={() => { setEditing(null); reload(); }}
          />
        )}
      </PageContainer>
    </ConfigGuard>
  );
}

function FunctionsTable({
  title, rows, onEdit, onChanged,
}: {
  title: string;
  rows: CatalogFunction[];
  onEdit: (f: CatalogFunction) => void;
  onChanged: () => void;
}) {
  const t = useTranslations("functionsConfig");
  const tRoot = useTranslations();
  const toggle = useSubmit((f: CatalogFunction, active: boolean) => updateFunction(f.slug, { active }), {
    successMessage: t("updated"),
    onSuccess: onChanged,
  });

  return (
    <Panel title={title}>
      {rows.length === 0 ? (
        <EmptyState>{t("empty")}</EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <RecordTable
            head={
              <tr>
                <Th>{t("name")}</Th>
                <Th>{t("place")}</Th>
                <Th right>{t("order")}</Th>
                <Th>{t("active")}</Th>
                <Th />
              </tr>
            }
          >
            {rows.map((f) => (
              <tr key={f.slug} className={f.active ? undefined : "opacity-60"}>
                <Td>
                  <div className="font-medium">{functionLabel(f, tRoot)}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">{f.slug}</div>
                </Td>
                <Td>
                  <span className="text-sm">{tRoot(`staffFunctions.place.${f.place}`)}</span>
                </Td>
                <Td className="text-right tabular-nums">{f.sortOrder}</Td>
                <Td>
                  <Switch
                    checked={f.active}
                    disabled={toggle.submitting}
                    onCheckedChange={(v) => toggle.submit(f, v)}
                    aria-label={t("active")}
                  />
                </Td>
                <Td className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => onEdit(f)}>{t("edit")}</Button>
                </Td>
              </tr>
            ))}
          </RecordTable>
        </div>
      )}
    </Panel>
  );
}

function FunctionSheet({
  fn, existing, onClose, onSaved,
}: {
  fn: CatalogFunction | null;
  existing: CatalogFunction[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("functionsConfig");
  const tRoot = useTranslations();
  const [kind, setKind] = React.useState<FunctionKind>(fn?.kind ?? "task");
  const [serviceSlug, setServiceSlug] = React.useState(fn?.serviceSlug ?? "");
  const [name, setName] = React.useState(fn?.name ?? "");
  const [place, setPlace] = React.useState<FunctionPlace>(fn?.place ?? "in_person");
  const [sortOrder, setSortOrder] = React.useState(String(fn?.sortOrder ?? existing.length));
  // Services are per center but share their slug: one option per slug, minus those that already have a function.
  const servicesRes = useResource<Servicio[]>(() => (fn || kind !== "service" ? Promise.resolve([]) : getServicios()), [fn, kind]);
  const taken = new Set(existing.map((f) => f.serviceSlug).filter(Boolean));
  const serviceOptions = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of servicesRes.state.kind === "ok" ? servicesRes.state.data : []) {
      if (s.slug && !taken.has(s.slug) && !seen.has(s.slug)) seen.set(s.slug, s.name);
    }
    return [...seen].sort((a, b) => a[1].localeCompare(b[1]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicesRes.state, existing]);

  const slug = fn?.slug ?? (kind === "service" ? serviceSlug : slugify(name));
  const slugTaken = !fn && !!slug && existing.some((f) => f.slug === slug);
  const order = Number(sortOrder);
  const orderInvalid = sortOrder.trim() !== "" && (!Number.isInteger(order) || order < 0);
  const missing = missingFields([
    ...(!fn && kind === "service" ? ([[t("service"), !!serviceSlug]] as [string, boolean][]) : []),
    [t("name"), !!name.trim()],
  ]);
  const reason = slugTaken ? t("slugTaken", { slug }) : orderInvalid ? t("orderInvalid") : null;

  const { submitting, submit } = useSubmit(
    async () => {
      const sort = sortOrder.trim() === "" ? undefined : order;
      if (fn) {
        await updateFunction(fn.slug, { name: name.trim(), place, ...(sort !== undefined ? { sortOrder: sort } : {}) });
      } else {
        await createFunction({
          slug, name: name.trim(), kind, place,
          ...(kind === "service" ? { serviceSlug } : {}),
          ...(sort !== undefined ? { sortOrder: sort } : {}),
        });
      }
    },
    { successMessage: fn ? t("updated") : t("created"), onSuccess: onSaved },
  );

  return (
    <FormSheet
      open
      onOpenChange={(v) => !v && onClose()}
      size="sm"
      title={fn ? t("editTitle", { name: functionLabel(fn, tRoot) }) : t("new")}
      missing={missing}
      reason={reason}
      blocked={slugTaken || orderInvalid}
      submitting={submitting}
      onSubmit={() => submit()}
    >
      <Field label={t("kind")} htmlFor="fn-kind" hint={fn ? t("kindFixed") : undefined}>
        <Select value={kind} onValueChange={(v) => setKind(v as FunctionKind)} disabled={!!fn}>
          <SelectTrigger id="fn-kind" className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="task">{t("kindTask")}</SelectItem>
            <SelectItem value="service">{t("kindService")}</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      {kind === "service" && !fn && (
        <Field label={t("service")} htmlFor="fn-service" required>
          <Select
            value={serviceSlug}
            onValueChange={(v) => { setServiceSlug(v); if (!name.trim()) setName(serviceOptions.find(([s]) => s === v)?.[1] ?? ""); }}
          >
            <SelectTrigger id="fn-service" className="w-full"><SelectValue placeholder={t("pickService")} /></SelectTrigger>
            <SelectContent>
              {serviceOptions.map(([s, n]) => <SelectItem key={s} value={s}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      )}
      <Field label={t("name")} htmlFor="fn-name" required hint={!fn && slug ? t("slugPreview", { slug }) : undefined}>
        <Input id="fn-name" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label={t("place")} htmlFor="fn-place" hint={t("placeHint")}>
        <Select value={place} onValueChange={(v) => setPlace(v as FunctionPlace)}>
          <SelectTrigger id="fn-place" className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PLACES.map((p) => <SelectItem key={p} value={p}>{tRoot(`staffFunctions.place.${p}`)}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label={t("order")} htmlFor="fn-order" error={orderInvalid ? t("orderInvalid") : null}>
        <Input id="fn-order" inputMode="numeric" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="tabular-nums" />
      </Field>
    </FormSheet>
  );
}
