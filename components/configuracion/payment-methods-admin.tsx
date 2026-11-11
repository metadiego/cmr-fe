"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { actualizarFormaPago, crearFormaPago, desactivarFormaPago, getFormasPago, type FormaPago } from "@/lib/api/facturas";
import { toastError } from "@/lib/api/errors";
import { formaPagoLabel } from "@/lib/facturacion/forma-pago-label";
import { useMe, isAdmin } from "@/hooks/use-me";
import { useResource } from "@/hooks/use-resource";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer, PageHeader } from "@/components/ui/page";

// Configuración → Formas de pago: the catalog the cashier picks from. «Efectivo» counts in the cash
// count; «Lleva dinero» off (Exonerada) = never offered as a payment and never added to the cash count
// (BE #564). Admin edits; everyone with factura.read sees it. Deactivate, never delete.
export function PaymentMethodsAdmin() {
  const t = useTranslations("paymentMethods");
  const tRoot = useTranslations();
  const me = useMe();
  const admin = me.kind === "ok" && isAdmin(me.me);
  const { state, reload } = useResource<FormaPago[]>(() => getFormasPago(), []);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [nuevo, setNuevo] = React.useState({ name: "", slug: "" });

  async function patch(f: FormaPago, body: Parameters<typeof actualizarFormaPago>[1]) {
    setBusy(f.id);
    try {
      await actualizarFormaPago(f.id, body);
      toast.success(t("saved"));
      reload();
    } catch (e) {
      toastError(e, tRoot);
    } finally {
      setBusy(null);
    }
  }
  async function crear() {
    const name = nuevo.name.trim();
    const slug = (nuevo.slug.trim() || name).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (!name || !slug) return;
    setBusy("new");
    try {
      await crearFormaPago({ name, slug, labelKey: `formaPago.${slug}`, isCash: false, carriesMoney: true });
      setNuevo({ name: "", slug: "" });
      toast.success(t("created"));
      reload();
    } catch (e) {
      toastError(e, tRoot);
    } finally {
      setBusy(null);
    }
  }
  async function desactivar(f: FormaPago) {
    if (!window.confirm(t("deactivateConfirm", { name: f.name }))) return;
    setBusy(f.id);
    try {
      await desactivarFormaPago(f.id);
      reload();
    } catch (e) {
      toastError(e, tRoot);
    } finally {
      setBusy(null);
    }
  }

  const rows = state.kind === "ok" ? state.data : [];
  return (
    <PageContainer className="w-full px-6">
      <PageHeader title={t("title")} description={t("hint")} />
      {state.kind === "loading" ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : (
        <div className="overflow-x-auto rounded-lg ring-1 ring-foreground/10">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left text-[11px] tracking-wide text-muted-foreground uppercase">
                <th className="px-3 py-2 font-semibold">{t("col.name")}</th>
                <th className="px-3 py-2 font-semibold">{t("col.slug")}</th>
                <th className="px-3 py-2 text-center font-semibold" title={t("tip.isCash")}>{t("col.isCash")}</th>
                <th className="px-3 py-2 text-center font-semibold" title={t("tip.carriesMoney")}>{t("col.carriesMoney")}</th>
                <th className="px-3 py-2 text-center font-semibold">{t("col.active")}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((f) => (
                <tr key={f.id} className={f.active === false ? "text-muted-foreground" : undefined}>
                  <td className="px-3 py-2 font-medium">
                    {formaPagoLabel(tRoot, f.slug, f.name)}
                    {f.carriesMoney === false && <Badge variant="outline" className="ml-2 text-[10px]">{t("noMoney")}</Badge>}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{f.slug}</td>
                  <td className="px-3 py-2 text-center">
                    <Switch checked={f.isCash} disabled={!admin || busy === f.id} onCheckedChange={(v) => patch(f, { isCash: v })} aria-label={t("col.isCash")} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Switch checked={f.carriesMoney !== false} disabled={!admin || busy === f.id} onCheckedChange={(v) => patch(f, { carriesMoney: v })} aria-label={t("col.carriesMoney")} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Switch checked={f.active !== false} disabled={!admin || busy === f.id} onCheckedChange={(v) => (v ? patch(f, { active: true }) : desactivar(f))} aria-label={t("col.active")} />
                  </td>
                  <td className="px-3 py-2" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {admin && (
        <div className="flex flex-wrap items-end gap-2">
          <Input value={nuevo.name} onChange={(e) => setNuevo((n) => ({ ...n, name: e.target.value }))} placeholder={t("newName")} className="h-9 w-56" />
          <Input value={nuevo.slug} onChange={(e) => setNuevo((n) => ({ ...n, slug: e.target.value }))} placeholder={t("newSlug")} className="h-9 w-40 font-mono" />
          <Button size="sm" disabled={!nuevo.name.trim() || busy === "new"} onClick={crear}>{t("add")}</Button>
        </div>
      )}
    </PageContainer>
  );
}
