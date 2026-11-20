import { notFound } from "next/navigation";

import { SheetHome } from "@/components/format-sheet/sheet-home";
import { isFillableSheet } from "@/lib/format-sheet/sheet";

// The iPad's home for a sheet filled on screen (/forms/glp1_adherencia): the day's visits, search, live
// «Enviar al iPad». The BE gates every read with formats.read in the visit's center.
export default async function SheetHomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isFillableSheet(slug)) notFound();
  return <SheetHome slug={slug} />;
}
