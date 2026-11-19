"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { File01Icon } from "@hugeicons/core-free-icons";

import { getDayAttachments } from "@/lib/caja/day-attachments";
import type { CashReconciliationAttachmentListed } from "@/lib/api/caja";

// Settlements escaneado del cuadre TOTAL del día (owner, 14-nov-2026): solo lectura — mezcla de TODOS
// los cuadres del día, para que tesorería los vea aquí sin tener que entrar cuadre por cuadre. Subir
// un adjunto nuevo sigue siendo desde el cuadre por división/cajero (components/caja/cuadre-attachments.tsx);
// esta pantalla no tiene un solo reconciliationId propio al que adjuntar.
export function CuadreAttachmentsDia({ fecha, centroId }: { fecha: string; centroId?: string | null }) {
  const t = useTranslations("caja.attachments");
  const format = useFormatter();
  const [items, setItems] = React.useState<CashReconciliationAttachmentListed[] | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    getDayAttachments(fecha, centroId)
      .then((list) => active && setItems(list))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [fecha, centroId]);

  if (failed || (items && items.length === 0)) return null;

  return (
    <div className="space-y-2 rounded-lg border bg-card p-4">
      <p className="text-sm font-semibold">{t("title")}</p>
      {!items ? (
        <p className="text-sm text-muted-foreground">…</p>
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
