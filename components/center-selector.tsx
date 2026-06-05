"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useMe } from "@/hooks/use-me";
import { getMyCentros, type Centro } from "@/lib/api/centers";
import { getActiveCentro, setActiveCentro } from "@/lib/tenant";
import { apiErrorMessage } from "@/lib/api/errors";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Active-center picker for operativo users with more than one center. Sets the
// X-Tenant-ID cookie and reloads so every request uses the new tenant. Hidden
// for single-center / admin / master (allowedClinicIds <= 1).
export function CenterSelector() {
  const me = useMe();
  const t = useTranslations("nav");
  const [centros, setCentros] = React.useState<Centro[]>([]);

  const show = me.kind === "ok" && me.me.allowedClinicIds.length > 1;

  React.useEffect(() => {
    if (!show) return;
    let active = true;
    getMyCentros()
      .then((list) => active && setCentros(list))
      .catch((err) => active && toast.error(apiErrorMessage(err)));
    return () => {
      active = false;
    };
  }, [show]);

  if (!show) return null;

  const current =
    getActiveCentro() ??
    (me.kind === "ok" ? me.me.activeClinicId : null) ??
    "";

  function onChange(id: string) {
    setActiveCentro(id);
    // Full reload so all in-flight components refetch under the new tenant.
    window.location.reload();
  }

  return (
    <Select value={current} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-40" aria-label={t("center")}>
        <SelectValue placeholder={t("center")} />
      </SelectTrigger>
      <SelectContent>
        {centros.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
