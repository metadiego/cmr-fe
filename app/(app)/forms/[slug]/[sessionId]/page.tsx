import { SheetEditor } from "@/components/format-sheet/sheet-editor";

// One visit's sheet (/forms/glp1_adherencia/<sessionId>): the URL "Llenar en pantalla", the QR, and
// the nursing panel's "Formatos" all open. Saving needs formats.fill in the visit's center (checked
// by the BE). Whether `slug` is actually fillable on screen (GET /formats' own `fillable`, cmr-be
// #665) is checked client-side inside SheetEditor — this server component has no browser session to
// call the API with.
export default async function SheetPage({ params }: { params: Promise<{ slug: string; sessionId: string }> }) {
  const { slug, sessionId } = await params;
  return <SheetEditor slug={slug} sessionId={sessionId} />;
}
