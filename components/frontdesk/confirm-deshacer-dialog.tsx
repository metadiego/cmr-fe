"use client";

import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Confirmación BLOQUEANTE para "deshacer" un paso sellado del flujo de frontdesk (fila-sesion.tsx).
// Reemplaza un toast descartable con botón de acción adentro: un solo click apurado en el toast ya
// disparaba la reversión sin leerlo, y así se perdió una asistencia real por error (06-nov-2026).
export function ConfirmDeshacerDialog({
  paso,
  onConfirm,
  onClose,
}: {
  paso: { labelKey: string } | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("frontdesk");
  const tRoot = useTranslations();
  return (
    <AlertDialog open={!!paso} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deshacerPregunta", { paso: paso ? tRoot(paso.labelKey) : "" })}</AlertDialogTitle>
          <AlertDialogDescription>{t("deshacerAviso")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tRoot("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{t("deshacer")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
