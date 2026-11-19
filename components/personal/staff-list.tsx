"use client";

import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon } from "@hugeicons/core-free-icons";

import type { PersonalEnAlcance } from "@/lib/api/personal";
import { staffFullName } from "@/lib/personal/staff-name";
import { clinicNamesOf } from "@/lib/personal/staff-clinics";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

// The people column of the staff screen: one row per person across every clinic shown. With more than
// one clinic on screen (`showClinics`), each row carries the clinics the person serves in as badges
// (`servesInCenters`, else the home clinic `clinicName`).
export function StaffList({
  people, selectedId, onSelect, q, onQChange, loading, loaded, showClinics, isSuspended,
}: {
  /** True for a person whose login is suspended (known to an admin only). */
  isSuspended?: (p: PersonalEnAlcance) => boolean;
  people: PersonalEnAlcance[];
  selectedId: string;
  onSelect: (id: string) => void;
  q: string;
  onQChange: (q: string) => void;
  loading: boolean;
  loaded: boolean;
  showClinics: boolean;
}) {
  const t = useTranslations("personalFicha");
  const tRoot = useTranslations();
  const cargoLabel = (slug: string) => (tRoot.has(`personal.cargo.${slug}`) ? tRoot(`personal.cargo.${slug}`) : slug);
  return (
    <>
      <div className="relative">
        <HugeiconsIcon icon={Search01Icon} className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => onQChange(e.target.value)} placeholder={t("buscar")} className="h-9 pl-8" />
      </div>
      {loading && <p className="text-sm text-muted-foreground">{t("cargando")}</p>}
      <ul className="max-h-[70vh] min-h-0 flex-1 space-y-1 overflow-auto lg:max-h-none">
        {people.map((p) => {
          const on = p.id === selectedId;
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onSelect(p.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                  on ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                )}
              >
                <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium", on ? "bg-primary-foreground/20" : "bg-primary/10 text-primary")}>
                  {(p.name?.[0] ?? "") + (p.lastName?.[0] ?? "")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{staffFullName(p)}</span>
                  <span className={cn("block truncate text-xs", on ? "text-primary-foreground/70" : "text-muted-foreground")}>
                    {p.jobTitle ? cargoLabel(p.jobTitle) : t("sinCargo")}{p.profileId ? (isSuspended?.(p) ? ` · ${t("suspendida")}` : "") : ` · ${t("sinCuenta")}`}
                  </span>
                  {showClinics && <ClinicBadges person={p} selected={on} />}
                </span>
              </button>
            </li>
          );
        })}
        {people.length === 0 && loaded && (
          <li className="px-2 py-6 text-center text-sm text-muted-foreground">{t("vacio")}</li>
        )}
      </ul>
    </>
  );
}

function ClinicBadges({ person, selected }: { person: PersonalEnAlcance; selected: boolean }) {
  const t = useTranslations("personalFicha");
  const names = clinicNamesOf(person);
  if (names.length === 0) return null;
  return (
    <span className="mt-1 flex flex-wrap gap-1" aria-label={t("centrosColumna")}>
      {names.map((n) => (
        <Badge key={n} variant="outline" className={cn("px-1.5 py-0 text-[10px]", selected && "border-primary-foreground/40 text-primary-foreground")}>
          {n}
        </Badge>
      ))}
    </span>
  );
}
