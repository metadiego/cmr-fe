"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  updateDatosFiscales,
  type Centro,
  type DatosFiscalesPayload,
} from "@/lib/api/centers";
import { apiErrorMessage } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Los 10 campos editables (mapean 1:1 a UpdateDatosFiscalesDto). La dirección se
// pre-llena y se envía como `direccionFiscal` (el GET la lee como `direccion`).
type Form = {
  nombreLegal: string;
  nombreComercial: string;
  registroFiscal: string;
  registroFiscalLabel: string;
  telefono: string;
  direccionFiscal: string;
  zip: string;
  web: string;
  pieFactura: string;
  logoUrl: string;
};

function fromCentro(c: Centro): Form {
  return {
    nombreLegal: c.nombreLegal ?? "",
    nombreComercial: c.nombreComercial ?? "",
    registroFiscal: c.registroFiscal ?? "",
    registroFiscalLabel: c.registroFiscalLabel ?? "",
    telefono: c.telefono ?? "",
    direccionFiscal: c.direccionFiscal ?? "",
    zip: c.zip ?? "",
    web: c.web ?? "",
    pieFactura: c.pieFactura ?? "",
    logoUrl: c.logoUrl ?? "",
  };
}

// Editor de datos fiscales (definición de empresa) por centro. Lo que se imprime
// en la factura: razón social, registro fiscal, dirección, pie, logo, etc.
// RBAC lo gatea el llamador (centro.fiscal.write). PUT parcial /datos-fiscales.
export function DatosFiscalesDialog({
  centro,
  open,
  onOpenChange,
  onSaved,
}: {
  centro: Centro | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}) {
  const t = useTranslations("admin.fiscal");
  const tc = useTranslations("admin");
  const [form, setForm] = React.useState<Form>(() =>
    centro ? fromCentro(centro) : ({} as Form),
  );
  const [submitting, setSubmitting] = React.useState(false);

  // Re-seed when the target center changes / dialog reopens.
  const [prevId, setPrevId] = React.useState(centro?.id);
  if (centro && centro.id !== prevId) {
    setPrevId(centro.id);
    setForm(fromCentro(centro));
  }

  function set<K extends keyof Form>(k: K, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function onSubmit() {
    if (!centro) return;
    setSubmitting(true);
    try {
      // Enviar solo campos con contenido; trim. (Patch parcial: lo vacío no se toca.)
      const payload: DatosFiscalesPayload = {};
      (Object.keys(form) as (keyof Form)[]).forEach((k) => {
        const v = form[k].trim();
        if (v) (payload as Record<string, string>)[k] = v;
      });
      await updateDatosFiscales(centro.id, payload);
      toast.success(t("saved"));
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const FIELDS: { key: keyof Form; area?: boolean }[] = [
    { key: "nombreLegal" },
    { key: "nombreComercial" },
    { key: "registroFiscal" },
    { key: "registroFiscalLabel" },
    { key: "telefono" },
    { key: "direccionFiscal" },
    { key: "zip" },
    { key: "web" },
    { key: "logoUrl" },
    { key: "pieFactura", area: true },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title", { name: centro?.nombre ?? "" })}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map(({ key, area }) => (
            <div
              key={key}
              className={"space-y-1.5 " + (area ? "sm:col-span-2" : "")}
            >
              <Label>{t(`field.${key}`)}</Label>
              {area ? (
                <Textarea
                  value={form[key]}
                  onChange={(e) => set(key, e.target.value)}
                  rows={3}
                />
              ) : (
                <Input
                  value={form[key]}
                  onChange={(e) => set(key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button onClick={onSubmit} disabled={submitting || !centro}>
            {submitting ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
