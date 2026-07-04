import { TableroEditorAdmin } from "@/components/configuracion/tablero-editor-admin";

// Edit one vertical: General / Columnas / Estados / Transiciones / Subtipos / Publicar.
export default async function TableroEditPage({
  params,
}: {
  params: Promise<{ clave: string }>;
}) {
  const { clave } = await params;
  return <TableroEditorAdmin clave={clave} />;
}
