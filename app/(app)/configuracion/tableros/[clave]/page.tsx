import { TableroEditorAdmin } from "@/components/configuracion/tablero-editor-admin";
import { ConfigGuard } from "@/components/configuracion/config-guard";

// Edit one vertical: General / Columnas / Estados / Transiciones / Subtipos / Publicar.
// Configuración DELICADA (solo admin): guarda `tablero.config`. Handoff configuracion-delicada-solo-admin.
export default async function TableroEditPage({
  params,
}: {
  params: Promise<{ clave: string }>;
}) {
  const { clave } = await params;
  return (
    <ConfigGuard permiso="tablero.config">
      <TableroEditorAdmin clave={clave} />
    </ConfigGuard>
  );
}
