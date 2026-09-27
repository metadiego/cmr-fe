import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";

import type { Servicio } from "@/lib/api/servicios";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// "Add therapy": compact select of the services not chosen yet. Extracted out of
// therapy-day-scheduler.tsx to keep that file under its DEBT line ceiling (eslint.config.mjs).
export function AddTherapySelect({
  servicios,
  onAdd,
  label,
}: {
  servicios: Servicio[];
  onAdd: (id: string) => void;
  label: string;
}) {
  if (servicios.length === 0) return null;
  return (
    <Select value="" onValueChange={onAdd}>
      <SelectTrigger className="h-8 w-auto gap-1 border-dashed text-xs">
        <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {servicios.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            <span className="inline-flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: s.color ?? "#4a90d9" }} />
              {s.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
