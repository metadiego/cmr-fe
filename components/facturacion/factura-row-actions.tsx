"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";

import { anularFactura, type Factura } from "@/lib/api/facturas";
import { toastError } from "@/lib/api/errors";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Row actions for the invoice list. Gated by state + RBAC:
//  - Ver/Imprimir → detail (always). Editar → detail (borrador only).
//  - Anular → POST /facturas/:id/anular (emitida only, RBAC factura.anular, motivo).
// Devolución is a detail-page feature (item selection) — next increment.
export function FacturaRowActions({
  factura,
  centroId,
  onChanged,
}: {
  factura: Factura;
  centroId?: string;
  onChanged?: () => void;
}) {
  const t = useTranslations("facturacionList.actions");
  const tRoot = useTranslations();
  const router = useRouter();
  const { can } = useCan();

  const [anularOpen, setAnularOpen] = React.useState(false);
  const [motivo, setMotivo] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const estado = String(factura.estado ?? "");
  const esBorrador = estado === "borrador";
  const esEmitida = estado === "emitida";
  const puedeAnular = esEmitida && can("factura.anular");

  const href = centroId
    ? `/facturacion/${factura.id}?centro=${centroId}`
    : `/facturacion/${factura.id}`;

  async function anular() {
    if (!motivo.trim() || busy) return;
    setBusy(true);
    try {
      await anularFactura(factura.id, motivo.trim(), centroId);
      setAnularOpen(false);
      setMotivo("");
      onChanged?.();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" aria-label={t("menu")}>
            <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => router.push(href)}>
            {esBorrador ? t("edit") : t("view")}
          </DropdownMenuItem>
          {puedeAnular && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={(e) => {
                  e.preventDefault();
                  setAnularOpen(true);
                }}
              >
                {t("void")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={anularOpen} onOpenChange={setAnularOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("voidTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("voidBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder={t("voidReason")}
            aria-label={t("voidReason")}
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{tRoot("common.cancel")}</AlertDialogCancel>
            <Button variant="destructive" disabled={!motivo.trim() || busy} onClick={anular}>
              {t("void")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
