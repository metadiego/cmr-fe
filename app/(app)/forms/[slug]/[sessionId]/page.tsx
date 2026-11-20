import { notFound } from "next/navigation";

import { SheetEditor } from "@/components/format-sheet/sheet-editor";
import { isFillableSheet } from "@/lib/format-sheet/sheet";

// One visit's sheet on the iPad (/forms/glp1_adherencia/<sessionId>): the URL the patient-desk QR and
// «Enviar al iPad» open. Saving needs formats.fill in the visit's center (checked by the BE).
export default async function SheetPage({ params }: { params: Promise<{ slug: string; sessionId: string }> }) {
  const { slug, sessionId } = await params;
  if (!isFillableSheet(slug)) notFound();
  return <SheetEditor slug={slug} sessionId={sessionId} />;
}
