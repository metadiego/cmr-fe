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
import { Label } from "@/components/ui/label";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

  const centerName = React.useCallback(
    (id?: string | null) => centers.find((c) => c.id === id)?.nombre ?? id,
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

  async function onDelete(o: Override) {
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
    if (!o.vigenteDesde && !o.vigenteHasta) return t("permanent");
    return `${o.vigenteDesde ?? "…"} → ${o.vigenteHasta ?? "…"}`;
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
                    {o.nombre || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {o.centroId ? centerName(o.centroId) : t("global")}
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
  const [nombre, setNombre] = React.useState("");
  const [scope, setScope] = React.useState<string>(GLOBAL);
  const [desde, setDesde] = React.useState("");
  const [hasta, setHasta] = React.useState("");
  const [config, setConfig] = React.useState<ThemeConfig>({});
  const [submitting, setSubmitting] = React.useState(false);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setNombre("");
      setScope(GLOBAL);
      setDesde("");
      setHasta("");
      setConfig({});
    }
    onOpenChange(next);
  }

  async function onSubmit() {
    setSubmitting(true);
    try {
      await createOverride({
        config,
        nombre: nombre.trim() || undefined,
        centroId: scope === GLOBAL ? undefined : scope,
        vigenteDesde: desde || undefined,
        vigenteHasta: hasta || undefined,
      });
      toast.success(t("created"));
      handleOpenChange(false);
      onCreated();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("createTitle")}</DialogTitle>
          <DialogDescription>{t("createHelp")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("name")}</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder={t("namePlaceholder")}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t("scope")}</Label>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={GLOBAL}>{t("global")}</SelectItem>
                {centers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre} ({c.codigo})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("from")}</Label>
              <Input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("to")}</Label>
              <Input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("theme")}</Label>
            <ThemeEditor value={config} onChange={setConfig} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting ? t("creating") : t("createSubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
