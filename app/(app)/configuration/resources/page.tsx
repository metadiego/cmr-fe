"use client";

import { ResourcesConfig } from "@/components/configuracion/resources-config";
import { PageContainer } from "@/components/ui/page";

// Configuración → Recursos, standalone (bookmarks/enlaces viejos). La pantalla vive ahora también
// como pestaña de /scheduling/slots (AgendaConfig) para no brincar de sección al configurar citas
// médicas y servicio juntos — ver components/configuracion/resources-config.tsx.
export default function ResourcesPage() {
  return (
    <PageContainer>
      <ResourcesConfig />
    </PageContainer>
  );
}
