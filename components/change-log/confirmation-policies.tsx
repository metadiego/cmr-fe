"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { listConfirmationPolicies, setConfirmationPolicy, type ConfirmationPolicy } from "@/lib/api/change-log";
import { getMyCentros, type Centro } from "@/lib/api/centers";
import { toastError } from "@/lib/api/errors";
import { useCan } from "@/hooks/use-can";
import { useResource } from "@/hooks/use-resource";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { PageContainer, PageHeader } from "@/components/ui/page";

// «Confirmaciones» (BE #529): which guarded actions ask «¿Aceptar o no?» before writing, per center.
// One row per action, one column per center, a switch. confirmation_policies.manage.
export function ConfirmationPolicies() {
  const t = useTranslations("confirmation.policies");
  const tRoot = useTranslations();
  const { can, ready } = useCan();
  const centersRes = useResource<Centro[]>(() => getMyCentros(), []);
  const centers = centersRes.state.kind === "ok" ? centersRes.state.data : [];
  const [rows, setRows] = React.useState<ConfirmationPolicy[] | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const ids = centers.map((c) => c.id).join(",");

  React.useEffect(() => {
    if (!ids) return;
    let alive = true;
    listConfirmationPolicies(ids.split(","))
      .then((r) => alive && setRows(r))
      .catch((e) => alive && toastError(e, tRoot));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  async function toggle(p: ConfirmationPolicy, clinicId: string, required: boolean) {
    const k = `${p.key}|${clinicId}`;
    setBusy(k);
    try {
      await setConfirmationPolicy(p.key, required, [clinicId]);
      setRows((rs) =>
        (rs ?? []).map((r) => (r.key !== p.key ? r : { ...r, centers: r.centers.map((c) => (c.clinicId === clinicId ? { ...c, required, isDefault: false } : c)) })),
      );
      toast.success(t("saved"));
    } catch (e) {
      toastError(e, tRoot);
    } finally {
      setBusy(null);
    }
  }

  if (ready && !can("confirmation_policies.manage")) return <PageContainer className="text-center text-sm text-muted-foreground">{t("noPermission")}</PageContainer>;

  return (
    <PageContainer className="w-full px-6">
      <PageHeader title={t("title")} description={t("hint")} />
      {!rows ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : (
        <div className="overflow-x-auto rounded-lg ring-1 ring-foreground/10">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left text-[11px] tracking-wide text-muted-foreground uppercase">
                <th className="px-3 py-2 font-semibold">{t("action")}</th>
                {centers.map((c) => <th key={c.id} className="px-3 py-2 text-center font-semibold">{c.name}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((p) => (
                <tr key={p.key} className="hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <div className="font-medium">{tRoot.has(p.labelKey) ? tRoot(p.labelKey) : p.key}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">{p.key}</div>
                  </td>
                  {centers.map((c) => {
                    const cell = p.centers.find((x) => x.clinicId === c.id);
                    const on = cell ? cell.required : p.requiredByDefault;
                    return (
                      <td key={c.id} className="px-3 py-2 text-center">
                        <div className="inline-flex items-center gap-2">
                          <Switch checked={on} disabled={busy === `${p.key}|${c.id}`} onCheckedChange={(v) => toggle(p, c.id, v)} aria-label={`${p.key} ${c.name}`} />
                          {cell?.isDefault !== false && <Badge variant="outline" className="text-[10px]">{t("default")}</Badge>}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageContainer>
  );
}
