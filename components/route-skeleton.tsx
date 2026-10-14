"use client";

import { useTranslations } from "next-intl";

import { ControlSkeleton, LoadingRegion, TableRowsSkeleton, type CellShape } from "@/components/kit/skeletons";
import { MonthCalendar, LegendSkeleton } from "@/components/agenda/month-calendar";
import { TableroDinamico } from "@/components/agenda/tablero-dinamico";
import { BoardSkeleton, ServiceTabsSkeleton } from "@/components/frontdesk/frontdesk-skeleton";
import { InvoiceDetailSkeleton } from "@/components/facturacion/invoice-detail-skeleton";
import { PatientDeskSkeleton } from "@/components/patient-desk/patient-desk-skeleton";
import { KpiTilesSkeleton } from "@/components/agenda/tablero-dinamico-skeleton";
import { DataTable } from "@/components/ui/data-table";
import { TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageContainer } from "@/components/ui/page";
import { DEFAULT_INVOICE_COLUMNS } from "@/lib/facturacion/invoice-board-defaults";
import { Skeleton } from "@/components/ui/skeleton";

// What the authenticated area shows while SessionGate waits for /auth/me — before any page has
// mounted. It picks the skeleton of the page being opened (docs/specs/2026-10-10-skeletons-de-carga.md),
// so the hand-off to that page's own loading state is seamless; unknown routes get a toolbar + list.
// The shell's top bar already names the page, so no title here.
export function RouteSkeleton({ pathname }: { pathname: string }) {
  const at = (route: string) => pathname === route || pathname.startsWith(route + "/");

  if (at("/boards/frontdesk") || at("/boards/servicios")) {
    return (
      <PageContainer>
        <ServiceTabsSkeleton />
        <Toolbar left={["w-full sm:max-w-sm", "w-40", "w-44"]} right={["w-24", "w-24"]} />
        <BoardSkeleton />
      </PageContainer>
    );
  }
  if (at("/boards/patient-desk")) {
    return (
      <PageContainer>
        <Toolbar left={["w-full sm:max-w-sm", "w-40", "w-64"]} right={["w-24", "w-24"]} />
        <PatientDeskSkeleton />
      </PageContainer>
    );
  }
  if (at("/boards")) return <GenericBoardSkeleton />;
  if (at("/scheduling/appointments") || at("/scheduling/calendar")) return <MonthSkeleton />;
  if (pathname === "/patients") return <PatientListSkeleton />;
  if (pathname === "/billing/invoices" || pathname === "/billing/consultations") return <InvoiceListSkeleton />;
  // An invoice itself (/billing/invoices/<id>), not its sub-pages nor the new-sale form.
  if (/^\/billing\/invoices\/(?!new$)[^/]+$/.test(pathname)) return <InvoiceDetailSkeleton />;
  return <ListSkeleton />;
}

/** A toolbar row: filter controls on the left, actions pushed right (widths = the real controls'). */
function Toolbar({ left, right = [] }: { left: string[]; right?: string[] }) {
  return (
    <div aria-hidden className="flex flex-wrap items-center gap-2">
      {left.map((w, i) => (
        <ControlSkeleton key={i} className={w} />
      ))}
      <div className="ml-auto flex items-center gap-2">
        {right.map((w, i) => (
          <ControlSkeleton key={i} className={w} />
        ))}
      </div>
    </div>
  );
}

// generic-board.tsx: date + centre | live + "add", KPI tiles, dynamic table.
function GenericBoardSkeleton() {
  const t = useTranslations("tableroBoard");
  return (
    <PageContainer>
      <Toolbar left={["w-40", "w-48"]} right={["w-32"]} />
      <KpiTilesSkeleton allLabel={t("all")} />
      <TableroDinamico columnas={[]} filas={[]} loading />
    </PageContainer>
  );
}

// medicas/servicios calendars and the staff calendar: tabs, month toolbar, month grid + aside.
function MonthSkeleton() {
  const t = useTranslations("agenda");
  const now = new Date();
  return (
    <PageContainer>
      <Skeleton aria-hidden className="h-10 w-72 rounded-lg" />
      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <Toolbar left={["w-9", "w-9", "w-16", "w-52", "w-52"]} right={["w-24"]} />
          <MonthCalendar
            year={now.getFullYear()}
            month0={now.getMonth()}
            weekdays={[0, 1, 2, 3, 4, 5, 6].map((i) => t(`dow.${i}`))}
            eventsByDate={new Map()}
            festivos={[]}
            loading
            onDayClick={() => {}}
            onEventClick={() => {}}
          />
        </div>
        <LoadingRegion className="flex flex-col gap-4">
          <Skeleton className="h-9 w-full" />
          <LegendSkeleton />
        </LoadingRegion>
      </div>
    </PageContainer>
  );
}


// facturacion-con-tabs.tsx + facturas-list-view.tsx: tabs, search | status + date range + "today" chip, table.
function InvoiceListSkeleton() {
  const tRoot = useTranslations();
  return (
    <PageContainer>
      <Skeleton aria-hidden className="mb-4 h-10 w-80 rounded-lg" />
      <Toolbar left={["w-full sm:max-w-sm"]} right={["h-8 w-[170px]", "h-8 w-[150px]", "h-8 w-[150px]", "h-6 w-12 rounded-full"]} />
      <ListTable
        columns={[
          { shape: "short", label: "#" },
          ...DEFAULT_INVOICE_COLUMNS.map((c) => ({ shape: c.shape, label: tRoot(c.labelKey) })),
          { shape: "icon", label: tRoot("fac.col.acciones") },
        ]}
      />
    </PageContainer>
  );
}

// app/(app)/patients/page.tsx: search + centre scope | "new", then its fixed columns.
function PatientListSkeleton() {
  const t = useTranslations("patients");
  return (
    <PageContainer>
      <Toolbar left={["w-full sm:max-w-sm", "w-[190px]"]} right={["w-36"]} />
      <ListTable
        columns={[
          { shape: "short", label: "#" },
          { shape: "short", label: t("columns.record") },
          { shape: "long", label: t("columns.name") },
          { shape: "text", label: t("columns.docId") },
          { shape: "text", label: t("columns.phone") },
          { shape: "long", label: t("columns.email") },
          { shape: "badge", label: t("columns.status") },
          { shape: "button", label: "" },
        ]}
      />
    </PageContainer>
  );
}

const LIST_COLUMNS: CellShape[] = ["short", "long", "text", "text", "long", "badge", "button"];

// Any other page: the common toolbar + list layout (ListToolbar + DataTable).
function ListSkeleton() {
  return (
    <PageContainer>
      <Toolbar left={["w-full sm:max-w-sm", "w-48"]} right={["w-28"]} />
      <ListTable columns={LIST_COLUMNS.map((shape) => ({ shape }))} />
    </PageContainer>
  );
}

// A column's header is its real name when the page's columns are known in code; a bar only on the
// generic fallback, where the page (and so its columns) is unknown.
function ListTable({ columns }: { columns: { shape: CellShape; label?: string }[] }) {
  return (
    <DataTable>
      <TableHeader>
        <TableRow>
          {columns.map((c, i) => (
            <TableHead key={i}>{c.label ?? <Skeleton aria-hidden className="h-3 w-16" />}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRowsSkeleton columns={columns.map((c) => c.shape)} rows={10} />
      </TableBody>
    </DataTable>
  );
}
