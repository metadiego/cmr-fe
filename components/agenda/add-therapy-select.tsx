"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";

import type { Servicio } from "@/lib/api/servicios";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// "Add therapy": una casilla por terapia, varias de un tirón (como el legado) — pedido del dueño
// 9-nov, handoff relayed via cmr-be-6e. Antes era un `Select` de un solo pick que se cerraba en cada
// clic. Marcar/desmarcar aquí es lo mismo que la tarjeta de la izquierda: ambos llaman a `onToggle`.
// Extracted out of therapy-day-scheduler.tsx to keep that file under its DEBT line ceiling.
export function AddTherapySelect({
  servicios,
  selectedIds,
  onToggle,
  label,
}: {
  servicios: Servicio[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  label: string;
}) {
  if (servicios.length === 0) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1 border-dashed text-xs">
          <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1.5" align="start">
        <ul className="max-h-72 space-y-0.5 overflow-y-auto">
          {servicios.map((s) => (
            <li key={s.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
                <Checkbox checked={selectedIds.has(s.id)} onCheckedChange={() => onToggle(s.id)} />
                <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color ?? "#4a90d9" }} />
                <span className="truncate">{s.name}</span>
              </label>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
