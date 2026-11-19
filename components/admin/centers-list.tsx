"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { getCenters, createCenter, type Centro } from "@/lib/api/centers";
import { apiErrorMessage } from "@/lib/api/errors";
import { useCan } from "@/hooks/use-can";
import { DatosFiscalesDialog } from "@/components/admin/datos-fiscales-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTable } from "@/components/ui/data-table";
import { missingFields } from "@/lib/forms/missing";
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { useSubmit } from "@/components/kit/use-submit";
import { useDialogForm } from "@/components/kit/use-dialog-form";

type State =
  | { kind: "loading" }
  | { kind: "ok"; centers: Centro[] }
  | { kind: "fail"; message: string };

export function CentersList() {
  const t = useTranslations("admin");
  const { can } = useCan();
  const canFiscal = can("centro.fiscal.write");
  const [state, setState] = React.useState<State>({ kind: "loading" });
  const [createOpen, setCreateOpen] = React.useState(false);
  const [fiscalCentro, setFiscalCentro] = React.useState<Centro | null>(null);

  const load = React.useCallback(async () => {
    try {
      const centers = await getCenters();
      setState({ kind: "ok", centers });
    } catch (err) {
      setState({ kind: "fail", message: apiErrorMessage(err) });
    }
  }, []);

  React.useEffect(() => {
    let active = true;
    getCenters()
      .then((centers) => active && setState({ kind: "ok", centers }))
      .catch(
        (err) => active && setState({ kind: "fail", message: apiErrorMessage(err) }),
      );
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          {t("centers.create")}
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
        (state.centers.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("centers.empty")}</p>
        ) : (
          <DataTable>
            <TableHeader>
              <TableRow>
                <TableHead>{t("centers.name")}</TableHead>
                <TableHead>{t("centers.code")}</TableHead>
                <TableHead>{t("centers.address")}</TableHead>
                <TableHead>{t("centers.active")}</TableHead>
                {canFiscal && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.centers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="font-mono">{c.code}</TableCell>
                  <TableCell>{c.address ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={c.active === false ? "outline" : "secondary"}>
                      {String(c.active ?? true)}
                    </Badge>
                  </TableCell>
                  {canFiscal && (
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setFiscalCentro(c)}>
                        {t("fiscal.edit")}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        ))}

      <CreateCenterDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={load}
      />

      <DatosFiscalesDialog
        centro={fiscalCentro}
        open={!!fiscalCentro}
        onOpenChange={(o) => !o && setFiscalCentro(null)}
        onSaved={load}
      />
    </div>
  );
}

function CreateCenterDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}) {
  const t = useTranslations("admin");
  const [form, update] = useDialogForm(
    () => ({ nombre: "", codigo: "", direccion: "" }),
    open,
  );
  const missing = missingFields([
    [t("centers.name"), !!form.nombre.trim()],
    [t("centers.code"), !!form.codigo.trim()],
  ]);

  const { submitting, submit } = useSubmit(
    () =>
      createCenter({
        name: form.nombre.trim(),
        code: form.codigo.trim(),
        address: form.direccion.trim() || undefined,
      }),
    {
      onSuccess: (c) => {
        toast.success(t("centers.success", { name: c.name }));
        onOpenChange(false);
        onCreated?.();
      },
    },
  );

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title={t("centers.createTitle")}
      description={t("centers.createDescription")}
      // A center cannot be deleted or renamed from here once created: Enter never fires it, only the button.
      onSubmit={() => {}}
      actions={[{ label: t("centers.submit"), onClick: () => submit() }]}
      submitting={submitting}
      missing={missing}
      submittingLabel={t("centers.submitting")}
      cancelLabel={t("cancel")}
    >
      <Field label={t("centers.name")} htmlFor="create-center-name" required>
        <Input
          id="create-center-name"
          value={form.nombre}
          onChange={(e) => update({ nombre: e.target.value })}
        />
      </Field>
      <Field label={t("centers.code")} htmlFor="create-center-code" required>
        <Input
          id="create-center-code"
          value={form.codigo}
          onChange={(e) => update({ codigo: e.target.value })}
        />
      </Field>
      <Field label={t("centers.address")} htmlFor="create-center-address">
        <Input
          id="create-center-address"
          value={form.direccion}
          onChange={(e) => update({ direccion: e.target.value })}
        />
      </Field>
    </FormDialog>
  );
}
