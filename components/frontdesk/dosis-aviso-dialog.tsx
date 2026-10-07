"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";

export interface DosisAviso {
  clave: string;
  valor: string;
  etiqueta: string;
  prev: string;
  eligiendo: string;
  comprado: { nombre: string; n: number }[];
}

// Cartel CENTRADO (no bloqueante) cuando se elige una dosis que el paciente NO compró teniendo
// dosis compradas pendientes. Extraído de fila-sesion.tsx: esto es solo la presentación, la lógica
// de cada botón (revertir el reflejo / aplicar igual y avisar el descuido) vive en el padre.
export function DosisAvisoDialog({
  aviso,
  onClose,
  onUsarComprada,
  onAplicarIgual,
}: {
  aviso: DosisAviso | null;
  onClose: () => void;
  onUsarComprada: () => void;
  onAplicarIgual: () => void;
}) {
  const t = useTranslations("frontdesk");
  return (
    <AlertDialog open={!!aviso} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("dosis.avisoNoComprada.titulo")}</AlertDialogTitle>
          <AlertDialogDescription>{t("dosis.avisoNoComprada.desc")}</AlertDialogDescription>
        </AlertDialogHeader>
        {aviso && (
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("dosis.avisoNoComprada.compro")}
              </div>
              <ul className="mt-1 space-y-0.5">
                {aviso.comprado.map((c2, i) => (
                  <li key={i} className="font-medium">
                    {c2.n > 0 ? t("dosis.avisoNoComprada.compradoItem", { nombre: c2.nombre, n: c2.n }) : c2.nombre}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("dosis.avisoNoComprada.eligiendo")}
              </div>
              <div className="mt-1 font-semibold text-warning-foreground">{aviso.eligiendo}</div>
            </div>
          </div>
        )}
        <AlertDialogFooter>
          <Button variant="outline" onClick={onUsarComprada}>{t("dosis.avisoNoComprada.usarComprada")}</Button>
          <Button onClick={onAplicarIgual}>{t("dosis.avisoNoComprada.aplicarIgual")}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
