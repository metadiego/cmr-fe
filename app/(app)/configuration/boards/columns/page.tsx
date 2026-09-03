import { TableroEditor } from "@/components/tablero/tablero-editor";

// Generic column builder. ?tablero=<key> (default "citas" = Atención board).
export default async function ColumnasConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ tablero?: string }>;
}) {
  const { tablero } = await searchParams;
  return <TableroEditor tablero={tablero || "citas"} />;
}
