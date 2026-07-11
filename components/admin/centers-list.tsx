"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { getCenters, createCenter, type Centro } from "@/lib/api/centers";
import { apiErrorMessage } from "@/lib/api/errors";
import { useCan } from "@/hooks/use-can";
import { DatosFiscalesDialog } from "@/components/admin/datos-fiscales-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
          <Table>
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
                  <TableCell className="font-medium">{c.nombre}</TableCell>
                  <TableCell className="font-mono">{c.codigo}</TableCell>
                  <TableCell>{c.direccion ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={c.activo === false ? "outline" : "secondary"}>
                      {String(c.activo ?? true)}
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
          </Table>
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
  const [nombre, setNombre] = React.useState("");
  const [codigo, setCodigo] = React.useState("");
  const [direccion, setDireccion] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  // Reset on close (handler, not effect) so the next open is fresh.
  function handleOpenChange(next: boolean) {
    if (!next) {
      setNombre("");
      setCodigo("");
      setDireccion("");
    }
    onOpenChange(next);
  }

  async function onSubmit() {
    if (!nombre.trim() || !codigo.trim()) return;
    setSubmitting(true);
    try {
      const c = await createCenter({
        nombre: nombre.trim(),
        codigo: codigo.trim(),
        direccion: direccion.trim() || undefined,
      });
      toast.success(t("centers.success", { name: c.nombre }));
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("centers.createTitle")}</DialogTitle>
          <DialogDescription>{t("centers.createDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("centers.name")}</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("centers.code")}</Label>
            <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("centers.address")}</Label>
            <Input
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button
            onClick={onSubmit}
            disabled={submitting || !nombre.trim() || !codigo.trim()}
          >
            {submitting ? t("centers.submitting") : t("centers.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
