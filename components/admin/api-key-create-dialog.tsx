"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons";

import { createApiKey, type CreatedApiKey } from "@/lib/api/api-keys";
import { getPermisos, type Permiso } from "@/lib/api/rbac";
import type { Centro } from "@/lib/api/centers";
import { ALL_CENTERS, apiKeyFormMissing, type ApiKeyForm } from "@/lib/api-keys/create-missing";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { RequiredLegend } from "@/components/kit/required-mark";
import { useSubmit } from "@/components/kit/use-submit";



// New API key. Step 1: what it is for and what it may do. Step 2: the key itself, shown ONCE (the BE
// keeps only a hash), with a copy button. Creating a key grants access, so Enter does not submit:
// only the button does (rule 8). The BE refuses a center key with full access or access-management
// permissions, and any permission the creator lacks; its message is shown as is.
export function ApiKeyCreateDialog({ centers, onClose, onCreated }: { centers: Centro[]; onClose: () => void; onCreated: () => void }) {
  const t = useTranslations("admin.apiKeys.create");
  const tc = useTranslations("common");
  const catalog = useResource<Permiso[]>(() => getPermisos());
  const [form, setForm] = React.useState<ApiKeyForm>({ name: "", centerId: ALL_CENTERS, fullAccess: false, permissions: [], expiresAt: "" });
  const [q, setQ] = React.useState("");
  const [created, setCreated] = React.useState<CreatedApiKey | null>(null);
  const update = (patch: Partial<ApiKeyForm>) => setForm((f) => ({ ...f, ...patch }));
  const allCenters = form.centerId === ALL_CENTERS;

  const missing = apiKeyFormMissing(form, { name: t("name"), permissions: t("permissions") });
  const { submitting, submit } = useSubmit(
    () =>
      createApiKey({
        name: form.name.trim(),
        scope: allCenters ? "admin" : "clinic",
        ...(allCenters ? {} : { clinicId: form.centerId }),
        permissions: allCenters && form.fullAccess ? ["*"] : form.permissions,
        ...(form.expiresAt ? { expiresAt: form.expiresAt } : {}),
      }),
    { onSuccess: (k) => { setCreated(k); onCreated(); } },
  );

  if (created) return <CreatedKeyDialog created={created} onClose={onClose} />;

  const perms = catalog.state.kind === "ok" ? catalog.state.data : [];
  const needle = q.trim().toLowerCase();
  const shown = perms.filter((p) => !needle || p.slug.includes(needle) || (p.description ?? "").toLowerCase().includes(needle));
  const toggle = (slug: string, on: boolean) =>
    update({ permissions: on ? [...form.permissions, slug] : form.permissions.filter((s) => s !== slug) });

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="xl"
      title={t("title")}
      description={t("description")}
      onSubmit={() => {}}
      actions={[{ label: t("submit"), onClick: () => submit() }]}
      submitting={submitting}
      submittingLabel={tc("loading")}
      cancelLabel={tc("cancel")}
      missing={missing}
    >
      <RequiredLegend />
      <Field label={t("name")} htmlFor="api-key-name" required hint={t("nameHint")}>
        <Input id="api-key-name" value={form.name} onChange={(e) => update({ name: e.target.value })} autoFocus />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("center")} htmlFor="api-key-center">
          <Select value={form.centerId} onValueChange={(v) => update({ centerId: v, fullAccess: v === ALL_CENTERS && form.fullAccess })}>
            <SelectTrigger id="api-key-center" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CENTERS}>{t("allCenters")}</SelectItem>
              {centers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("expires")} htmlFor="api-key-expires" hint={t("expiresHint")}>
          <Input id="api-key-expires" type="date" value={form.expiresAt} onChange={(e) => update({ expiresAt: e.target.value })} />
        </Field>
      </div>
      {allCenters && (
        <label htmlFor="api-key-full" className="flex items-start gap-3 rounded-md border px-3 py-2 text-sm">
          <Switch id="api-key-full" checked={form.fullAccess} onCheckedChange={(v) => update({ fullAccess: v })} />
          <span>
            <span className="font-medium">{t("fullAccess")}</span>
            <span className="block text-xs text-muted-foreground">{t("fullAccessHint")}</span>
          </span>
        </label>
      )}
      {!(allCenters && form.fullAccess) && (
        <Field label={t("permissions")} htmlFor="api-key-perm-search" required hint={t("permissionsHint", { n: form.permissions.length })}>
          <Input
            id="api-key-perm-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
            placeholder={t("searchPermissions")}
          />
          <div className="mt-2 max-h-64 overflow-y-auto rounded-md border">
            {shown.map((p) => (
              <label key={p.slug} htmlFor={`api-key-perm-${p.slug}`} className="flex items-center gap-3 border-b px-3 py-1.5 text-sm last:border-b-0 hover:bg-muted/30">
                <Checkbox id={`api-key-perm-${p.slug}`} checked={form.permissions.includes(p.slug)} onCheckedChange={(v) => toggle(p.slug, v === true)} />
                <code className="font-mono text-xs">{p.slug}</code>
                {p.description && <span className="truncate text-xs text-muted-foreground">{p.description}</span>}
              </label>
            ))}
          </div>
        </Field>
      )}
    </FormDialog>
  );
}

function CreatedKeyDialog({ created, onClose }: { created: CreatedApiKey; onClose: () => void }) {
  const t = useTranslations("admin.apiKeys.created");
  const [copied, setCopied] = React.useState(false);
  async function copy() {
    await navigator.clipboard.writeText(created.plainKey);
    setCopied(true);
  }
  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={t("title", { name: created.name })}
      description={t("description")}
      onSubmit={onClose}
      submitLabel={t("done")}
    >
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 rounded-md border bg-muted px-3 py-2 font-mono text-xs break-all select-all">{created.plainKey}</code>
        <Button type="button" variant="outline" size="sm" onClick={() => void copy()}>
          <HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} className="size-4" />
          {copied ? t("copied") : t("copy")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("warning")}</p>
    </FormDialog>
  );
}
