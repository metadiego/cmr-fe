import { TablerosList } from "@/components/configuracion/tableros-list";
import { ConfigGuard } from "@/components/configuracion/config-guard";

// Constructor de Tableros — configuración DELICADA (solo admin). La URL directa también se cierra con la
// guarda; el BE exige `tablero.config`. Handoff configuracion-delicada-solo-admin.
export default function TablerosConfigPage() {
  return (
    <ConfigGuard permiso="tablero.config">
      <TablerosList />
    </ConfigGuard>
  );
}
