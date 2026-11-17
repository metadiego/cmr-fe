import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";

// Layout genérico (sin lógica del dominio) del formulario de paciente — extraído de
// paciente-form-sheet.tsx para hacerle lugar a campos nuevos sin subir su ceiling de DEBT.
export function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: Parameters<typeof HugeiconsIcon>[0]["icon"];
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {icon ? <HugeiconsIcon icon={icon} strokeWidth={2} className="size-3.5" /> : null}
        {title}
      </h3>
      {children}
    </section>
  );
}

export function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}
