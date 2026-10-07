"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";

import {
  getPriorityFlagTypes,
  createPriorityFlagType,
  updatePriorityFlagType,
  type PriorityFlagType,
} from "@/lib/api/pacientes";
import {
  resolvePriorityFlagIcon,
  resolvePriorityFlagColorClass,
  PRIORITY_FLAG_ICON_KEYS,
  PRIORITY_FLAG_COLOR_KEYS,
} from "@/lib/pacientes/priority-flags";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { ConfigGuard } from "@/components/configuracion/config-guard";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Admin del catálogo de banderas de prioridad del paciente (oxígeno, silla de ruedas…). Catálogo
// GLOBAL (no por centro) — ver HANDOFF-banderas-de-prioridad-del-paciente.md. Sin DELETE físico:
// un tipo ya asignado a algún paciente se desactiva (active:false), nunca se borra.
export default function PriorityFlagsAdminPage() {
  const t = useTranslations("configuracion.prioridadFlags");
  const tRoot = useTranslations();
  const { state, reload } = useResource<PriorityFlagType[]>(() => getPriorityFlagTypes(), []);
  const [editing, setEditing] = React.useState<PriorityFlagType | "new" | null>(null);

  return (
    <ConfigGuard permiso="pacientes.prioridad_flags.admin">
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

        {state.kind === "loading" && <p className="text-sm text-muted-foreground">{tRoot("common.loading")}</p>}
        {state.kind === "fail" && <p className="text-sm text-destructive">{state.message}</p>}
        {state.kind === "ok" && state.data.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        )}
        {state.kind === "ok" && state.data.length > 0 && (
          <div className="divide-y rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
            {state.data.map((f) => (
              <FlagRow key={f.id} flag={f} onEdit={() => setEditing(f)} onChanged={reload} />
            ))}
          </div>
        )}

        {editing && (
          <FlagFormSheet
            flag={editing === "new" ? null : editing}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              reload();
            }}
          />
        )}
      </PageContainer>
    </ConfigGuard>
  );
}

function FlagRow({
  flag,
  onEdit,
  onChanged,
}: {
  flag: PriorityFlagType;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const t = useTranslations("configuracion.prioridadFlags");
  const tRoot = useTranslations();
  const [busy, setBusy] = React.useState(false);
  const icon = resolvePriorityFlagIcon(flag.icon);
  const cls = resolvePriorityFlagColorClass(flag.color);
  const label = tRoot.has(flag.labelKey) ? tRoot(flag.labelKey) : flag.slug;

  async function toggleActive(v: boolean) {
    setBusy(true);
    try {
      await updatePriorityFlagType(flag.id, { active: v });
      toast.success(t("updated"));
      onChanged();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className={"inline-flex size-8 shrink-0 items-center justify-center rounded-full ring-1 " + cls}>
        <HugeiconsIcon icon={icon} className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{flag.slug} · {flag.labelKey}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onEdit}>{t("edit")}</Button>
      <Switch checked={flag.active} disabled={busy} onCheckedChange={toggleActive} aria-label={t("active")} />
    </div>
  );
}

function FlagFormSheet({
  flag,
  onClose,
  onSaved,
}: {
  flag: PriorityFlagType | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("configuracion.prioridadFlags");
  const tRoot = useTranslations();
  const [slug, setSlug] = React.useState(flag?.slug ?? "");
  const [labelKey, setLabelKey] = React.useState(flag?.labelKey ?? "");
  const [icon, setIcon] = React.useState(flag?.icon ?? PRIORITY_FLAG_ICON_KEYS[0]);
  const [color, setColor] = React.useState(flag?.color ?? PRIORITY_FLAG_COLOR_KEYS[0]);
  const [busy, setBusy] = React.useState(false);

  async function save() {
    setBusy(true);
    try {
      if (flag) {
        await updatePriorityFlagType(flag.id, { labelKey, icon, color });
        toast.success(t("updated"));
      } else {
        await createPriorityFlagType({ slug: slug.trim(), labelKey: labelKey.trim(), icon, color });
        toast.success(t("created"));
      }
      onSaved();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="space-y-4 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{flag ? t("edit") : t("new")}</SheetTitle>
        </SheetHeader>

        <div className="space-y-1.5 px-4">
          <Label htmlFor="pf-slug">{t("slug")}</Label>
          <Input id="pf-slug" value={slug} disabled={!!flag} onChange={(e) => setSlug(e.target.value)} />
          <p className="text-xs text-muted-foreground">{t("slugHint")}</p>
        </div>

        <div className="space-y-1.5 px-4">
          <Label htmlFor="pf-labelkey">{t("labelKey")}</Label>
          <Input id="pf-labelkey" value={labelKey} onChange={(e) => setLabelKey(e.target.value)} />
          <p className="text-xs text-muted-foreground">{t("labelKeyHint")}</p>
        </div>

        <div className="space-y-1.5 px-4">
          <Label>{t("icon")}</Label>
          <Select value={icon} onValueChange={setIcon}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRIORITY_FLAG_ICON_KEYS.map((k) => (
                <SelectItem key={k} value={k}>{k}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 px-4">
          <Label>{t("color")}</Label>
          <Select value={color} onValueChange={setColor}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRIORITY_FLAG_COLOR_KEYS.map((k) => (
                <SelectItem key={k} value={k}>{t(`colorName.${k}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <SheetFooter>
          <Button onClick={save} disabled={busy || !slug.trim() || !labelKey.trim()}>
            {tRoot("common.save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
