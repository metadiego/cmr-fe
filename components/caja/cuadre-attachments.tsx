"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Attachment01Icon, File01Icon } from "@hugeicons/core-free-icons";

import {
  CASH_ATTACHMENT_MAX_BYTES,
  CASH_ATTACHMENT_TYPES,
  getCashAttachmentUploadUrl,
  listCashAttachments,
  registerCashAttachment,
  uploadCashAttachmentFile,
  type CashAttachmentContentType,
  type CashReconciliationAttachmentListed,
} from "@/lib/api/caja";
import { toastError } from "@/lib/api/errors";
import { CuadreScanButton } from "@/components/caja/cuadre-scan-button";
import { Button } from "@/components/ui/button";

// Settlements escaneado del cuadre (BE PR #516, handoff .personal/handoff-cuadre-adjuntar-settlements.md):
// sub-recurso del cuadre, aditivo — no toca el cierre ni CuadreCaja. El gerente subiendo por un cajero
// que no sabe usar el teléfono es el camino NORMAL: el botón sale igual para cualquiera con acceso a
// este cuadre, el BE decide quién puede de verdad (uploadedByName siempre dice quién subió de verdad).
export function CuadreAttachments({
  reconciliationId,
  centroId,
}: {
  reconciliationId: string;
  centroId?: string | null;
}) {
  const t = useTranslations("caja.attachments");
  const tRoot = useTranslations();
  const format = useFormatter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [items, setItems] = React.useState<CashReconciliationAttachmentListed[] | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [gen, setGen] = React.useState(0);

  React.useEffect(() => {
    let active = true;
    listCashAttachments(reconciliationId, centroId)
      .then((r) => active && setItems(r))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [reconciliationId, centroId, gen]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again right after
    if (!file) return;
    if (!(CASH_ATTACHMENT_TYPES as readonly string[]).includes(file.type)) {
      toast.error(t("typeNotAllowed"));
      return;
    }
    if (file.size > CASH_ATTACHMENT_MAX_BYTES) {
      toast.error(t("tooLarge"));
      return;
    }
    const contentType = file.type as CashAttachmentContentType;
    setUploading(true);
    try {
      const { uploadUrl, path } = await getCashAttachmentUploadUrl(reconciliationId, contentType, centroId);
      await uploadCashAttachmentFile(uploadUrl, file);
      await registerCashAttachment(reconciliationId, { path, contentType }, centroId);
      toast.success(t("uploaded"));
      setGen((g) => g + 1);
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{t("title")}</p>
        <div className="flex items-center gap-2">
          <CuadreScanButton reconciliationId={reconciliationId} centroId={centroId} onScanned={() => setGen((g) => g + 1)} />
          <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
            <HugeiconsIcon icon={Attachment01Icon} className="size-4" />
            {uploading ? t("uploading") : t("add")}
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={CASH_ATTACHMENT_TYPES.join(",")}
          capture="environment"
          className="hidden"
          onChange={onPick}
        />
      </div>
      {failed ? (
        <p className="text-sm text-destructive">{t("loadError")}</p>
      ) : !items ? (
        <p className="text-sm text-muted-foreground">{tRoot("common.loading")}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((a) => (
            <li key={a.id} className="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-sm">
              {a.url ? (
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-1 items-center gap-2 hover:underline">
                  <HugeiconsIcon icon={File01Icon} className="size-4 shrink-0" />
                  <span className="truncate">{format.dateTime(new Date(a.createdAt), "dateAndTime")}</span>
                </a>
              ) : (
                <span className="flex min-w-0 flex-1 items-center gap-2 text-muted-foreground">
                  <HugeiconsIcon icon={File01Icon} className="size-4 shrink-0" />
                  <span className="truncate">{t("unavailable")}</span>
                </span>
              )}
              <span className="shrink-0 text-xs text-muted-foreground">
                {t("uploadedBy", { name: a.uploadedByName ?? t("uploadedByUnknown") })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Consolidated / not-yet-opened: no single reconciliationId to attach to. Lists the day's cashiers
// with how many settlements each already has (one listCashAttachments per cuadre — no bulk endpoint,
// and a day's cashier count is small) and a button that hands scope back to the caller (onPick),
// same pattern as CashSignOffPanel's onSignMine. Handoff: owner couldn't find the button at all on
// the consolidated view (it rendered nothing, buried at the bottom of CuadreDetalle).
export function CuadreAttachmentsOverview({
  cuadres,
  cajeros,
  centroId,
  onPick,
}: {
  cuadres: Array<{ id: string; userId: string | null }>;
  cajeros: Array<{ userId: string; name: string }>;
  centroId?: string | null;
  onPick: (userId: string) => void;
}) {
  const t = useTranslations("caja.attachments");
  const [counts, setCounts] = React.useState<Record<string, number>>({});

  const rows = React.useMemo(
    () => cuadres.filter((c): c is { id: string; userId: string } => !!c.userId),
    [cuadres],
  );

  React.useEffect(() => {
    let active = true;
    Promise.all(
      rows.map((r) =>
        listCashAttachments(r.id, centroId)
          .then((items) => [r.userId, items.length] as const)
          .catch(() => [r.userId, 0] as const),
      ),
    ).then((pairs) => {
      if (active) setCounts(Object.fromEntries(pairs));
    });
    return () => {
      active = false;
    };
  }, [rows, centroId]);

  if (rows.length === 0) return null;

  return (
    <div className="space-y-2 rounded-lg border bg-card p-4">
      <p className="text-sm font-semibold">{t("title")}</p>
      <p className="text-sm text-muted-foreground">{t("pickCashier")}</p>
      <ul className="space-y-1.5">
        {rows.map((r) => {
          const n = counts[r.userId] ?? 0;
          return (
            <li key={r.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-sm">
              <span className="truncate">{cajeros.find((c) => c.userId === r.userId)?.name ?? r.userId}</span>
              <span className="flex shrink-0 items-center gap-2">
                {n > 0 && <span className="text-xs text-muted-foreground">{t("count", { n })}</span>}
                <Button type="button" size="sm" variant="outline" onClick={() => onPick(r.userId)}>
                  <HugeiconsIcon icon={Attachment01Icon} className="size-4" />
                  {t("add")}
                </Button>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
