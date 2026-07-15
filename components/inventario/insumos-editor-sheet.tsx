"use client";

import { useTranslations } from "next-intl";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ComponentesEditor } from "@/components/inventario/componentes-editor";

// Insumos estimados de consumo de UN producto (cualquier tipo). Reusa ComponentesEditor en modo
// estimado=true. Se abre desde la fila del producto en ProductosAdmin. No bloquea venta ni stock.
export function InsumosEditorSheet({
  open,
  productoId,
  productoNombre,
  onOpenChange,
}: {
  open: boolean;
  productoId: string;
  productoNombre: string;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("inventario.insumos");
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{t("title")} — {productoNombre}</SheetTitle>
          <SheetDescription>{t("help")}</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          <ComponentesEditor productoId={productoId} estimado />
        </div>
      </SheetContent>
    </Sheet>
  );
}
