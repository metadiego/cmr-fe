"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { getCajeros, type CajaDivision } from "@/lib/api/caja";

// «You billed today in the OTHER cash count». Consulta and General are separate sheets, each listing
// only who billed THAT division that day. A Consulta cashier opening the General count (7-nov-2026,
// Caguas: Laesi saw only Michelle and no sheet to sign) found nobody she knew. This says where her sheet is.
const OTHER: Record<CajaDivision, { division: CajaDivision; href: string }> = {
  general: { division: "consulta", href: "/billing/consultations/cash" },
  consulta: { division: "general", href: "/billing/invoices/cash" },
};

export function OtherDivisionHint({ division, fecha, meId }: { division: CajaDivision; fecha: string; meId: string | null }) {
  const t = useTranslations("caja.otherDivision");
  const [show, setShow] = React.useState(false);
  const other = OTHER[division];
  React.useEffect(() => {
    if (!meId) return;
    let alive = true;
    Promise.all([getCajeros(undefined, fecha, division), getCajeros(undefined, fecha, other.division)])
      .then(([here, there]) => {
        if (alive) setShow(!here.some((c) => c.userId === meId) && there.some((c) => c.userId === meId));
      })
      .catch(() => alive && setShow(false));
    return () => {
      alive = false;
    };
  }, [division, fecha, meId, other.division]);
  if (!show) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
      <span>{t(other.division === "consulta" ? "inConsulta" : "inGeneral")}</span>
      <Link href={other.href} className="font-semibold underline">
        {t(other.division === "consulta" ? "goConsulta" : "goGeneral")}
      </Link>
    </div>
  );
}
