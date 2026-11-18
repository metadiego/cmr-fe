"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  listOverrides,
  createOverride,
  deleteOverride,
  type Override,
} from "@/lib/api/preferences";
import { getCenters, type Centro } from "@/lib/api/centers";
import type { ThemeConfig } from "@/lib/theme/config";
import { apiErrorMessage } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTable } from "@/components/ui/data-table";
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { useSubmit } from "@/components/kit/use-submit";
import { useConfirm } from "@/components/kit/confirm-host";
import { useDialogForm } from "@/components/kit/use-dialog-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ThemeEditor } from "@/components/theme/theme-editor";

const GLOBAL = "__global__";

type State =
  | { kind: "loading" }
  | { kind: "ok"; overrides: Override[] }
  | { kind: "fail"; message: string };

// Corporate override (#51): the master imposes a theme that wins over user/center
// without deleting them, scoped (global/center) and time-bounded (vigencia). The
// BE resolves precedence; this only manages the override layer (super_admin).
export function OverrideSettings() {
  const t = useTranslations("admin.override");
  const [state, setState] = React.useState<State>({ kind: "loading" });
  const [centers, setCenters] = React.useState<Centro[]>([]);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const confirm = useConfirm();

  const centerName = React.useCallback(
    (id?: string | null) => centers.find((c) => c.id === id)?.name ?? id,
    [centers],
  );

  const load = React.useCallback(async () => {
    try {
      const overrides = await listOverrides();
      setState({ kind: "ok", overrides });
    } catch (err) {
      setState({ kind: "fail", message: apiErrorMessage(err) });
    }
  }, []);

  React.useEffect(() => {
    let active = true;
    listOverrides()
      .then((overrides) => active && setState({ kind: "ok", overrides }))
      .catch(
        (err) =>
          active && setState({ kind: "fail", message: apiErrorMessage(err) }),
      );
    getCenters()
      .then((list) => active && setCenters(list))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // `asking` stops a second click / Enter auto-repeat from queueing a second confirm prompt.
  const asking = React.useRef(false);
  async function onDelete(o: Override) {
    if (asking.current) return;
    asking.current = true;
    const ok = await confirm({
      title: t("removeTitle"),
      description: t("removeBody", { name: o.name || t("global") }),
      confirmLabel: t("remove"),
      destructive: true,
    }).finally(() => (asking.current = false));
    if (!ok) return;
    setBusyId(o.id);
    try {
      await deleteOverride(o.id);
      toast.success(t("removed"));
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  function vigencia(o: Override): string {
    if (!o.validFrom && !o.validUntil) return t("permanent");
    return `${o.validFrom ?? "…"} → ${o.validUntil ?? "…"}`;
  }

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("help")}</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          {t("create")}
        </Button>
      </div>

      {state.kind === "loading" && (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      )}
      {state.kind === "fail" && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.message}
        </p>
      )}
      {state.kind === "ok" &&
        (state.overrides.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <DataTable>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("scope")}</TableHead>
                <TableHead>{t("vigencia")}</TableHead>
                <TableHead className="text-right">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.overrides.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">
                    {o.name || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {o.centerId ? centerName(o.centerId) : t("global")}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {vigencia(o)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDelete(o)}
                      disabled={busyId === o.id}
                    >
                      {t("remove")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        ))}

      <CreateOverrideDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        centers={centers}
        onCreated={load}
      />
    </section>
  );
}

function CreateOverrideDialog({
  open,
  onOpenChange,
  centers,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  centers: Centro[];
  onCreated: () => void;
}) {
  const t = useTranslations("admin.override");
  const tc = useTranslations("admin");
  // Every field is optional (an empty theme is a valid override); reset on every open.
  const [form, update] = useDialogForm(
    () => ({ nombre: "", scope: GLOBAL as string, desde: "", hasta: "", config: {} as ThemeConfig }),
    open,
  );

  const { submitting, submit } = useSubmit(
    () =>
      createOverride({
        config: form.config,
        name: form.nombre.trim() || undefined,
        centerId: form.scope === GLOBAL ? undefined : form.scope,
        validFrom: form.desde || undefined,
        validUntil: form.hasta || undefined,
      }),
    {
      successMessage: t("created"),
      onSuccess: () => {
        onOpenChange(false);
        onCreated();
      },
      onError: (err) => {
        toast.error(apiErrorMessage(err));
        return true;
      },
    },
  );

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title={t("createTitle")}
      description={t("createHelp")}
      // The scope defaults to global (every center): Enter never creates it, only the button.
      onSubmit={() => {}}
      actions={[{ label: t("createSubmit"), onClick: () => submit() }]}
      submitting={submitting}
      submittingLabel={t("creating")}
      cancelLabel={tc("cancel")}
    >
      <Field label={t("name")} htmlFor="override-name">
        <Input
          id="override-name"
          value={form.nombre}
          onChange={(e) => update({ nombre: e.target.value })}
          placeholder={t("namePlaceholder")}
        />
      </Field>

      <Field label={t("scope")} htmlFor="override-scope">
        <Select value={form.scope} onValueChange={(v) => update({ scope: v })}>
          <SelectTrigger id="override-scope" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={GLOBAL}>{t("global")}</SelectItem>
            {centers.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name} ({c.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("from")}>
          <DatePicker value={form.desde} onChange={(v) => update({ desde: v })} clearable />
        </Field>
        <Field label={t("to")}>
          <DatePicker value={form.hasta} onChange={(v) => update({ hasta: v })} clearable />
        </Field>
      </div>

      <Field label={t("theme")}>
        <ThemeEditor value={form.config} onChange={(c) => update({ config: c })} />
      </Field>
    </FormDialog>
  );
}
