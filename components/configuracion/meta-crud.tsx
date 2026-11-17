"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { DataTable, type Column } from "@/components/kit/data-table";
import { FormDialog } from "@/components/kit/form-dialog";
import { useSubmit } from "@/components/kit/use-submit";
import { Button } from "@/components/ui/button";

export type Draft = Record<string, unknown>;

// Generic list + create/edit/delete section for a metadata entity (estados,
// transiciones, subtipos, columnas del catálogo). Each caller supplies its
// display columns, its form fields, and the CRUD fns — no repeated boilerplate.
export function MetaCrud<T extends { id: string }>({
  title,
  addLabel,
  load,
  deps = [],
  getRowKey,
  columns,
  initialDraft,
  toDraft,
  fields,
  missing,
  create,
  update,
  remove,
  readOnly = false,
}: {
  title: string;
  addLabel: string;
  load: () => Promise<T[]>;
  deps?: React.DependencyList;
  getRowKey: (r: T) => React.Key;
  columns: Column<T>[];
  initialDraft: Draft;
  toDraft: (r: T) => Draft;
  fields: (draft: Draft, patch: (p: Draft) => void) => React.ReactNode;
  /** Labels of the required fields still empty in `draft`, in on-screen order (missingFields). */
  missing?: (draft: Draft) => string[];
  create: (draft: Draft) => Promise<unknown>;
  update: (id: string, draft: Draft) => Promise<unknown>;
  remove?: (id: string) => Promise<unknown>;
  // Hides "add" + "edit"/"delete" row actions — for a permission-gated caller whose
  // viewer can only READ this list. Default false keeps every existing caller unchanged.
  readOnly?: boolean;
}) {
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const { state, reload } = useResource<T[]>(load, deps);

  const [editing, setEditing] = React.useState<T | "new" | null>(null);
  const [draft, setDraft] = React.useState<Draft>(initialDraft);

  function openNew() {
    setDraft(initialDraft);
    setEditing("new");
  }
  function openEdit(row: T) {
    setDraft(toDraft(row));
    setEditing(row);
  }
  const patch = (p: Draft) => setDraft((d) => ({ ...d, ...p }));

  const { submitting, submit } = useSubmit(
    async () => {
      // The dialog is only mounted while `editing` is set.
      if (editing === "new") await create(draft);
      else if (editing) await update(editing.id, draft);
      else throw new Error("MetaCrud: submit with no row being edited");
    },
    {
      successMessage: tc("saved"),
      onSuccess: () => {
        setEditing(null);
        reload();
      },
    },
  );

  async function del(row: T) {
    if (!remove) return;
    try {
      await remove(row.id);
      toast.success(tc("saved"));
      reload();
    } catch (err) {
      toastError(err, tRoot);
    }
  }

  const cols: Column<T>[] = readOnly
    ? columns
    : [
        ...columns,
        {
          key: "__acc",
          header: "",
          align: "right",
          cell: (r) => (
            <span className="flex justify-end gap-3">
              <button type="button" className="text-sm text-primary hover:underline" onClick={() => openEdit(r)}>
                {tc("edit")}
              </button>
              {remove && (
                <button type="button" className="text-sm text-muted-foreground hover:text-destructive" onClick={() => del(r)}>
                  {tc("delete")}
                </button>
              )}
            </span>
          ),
        },
      ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        {!readOnly && <Button size="sm" variant="outline" onClick={openNew}>{addLabel}</Button>}
      </div>
      <DataTable
        columns={cols}
        state={state}
        getRowKey={getRowKey}
        onReload={reload}
        labels={{ loading: tc("loading"), empty: tc("empty"), retry: tc("retry") }}
      />
      {editing && (
        <FormDialog
          open
          onOpenChange={(o) => !o && setEditing(null)}
          title={title}
          onSubmit={() => submit()}
          submitting={submitting}
          missing={missing?.(draft)}
        >
          {fields(draft, patch)}
        </FormDialog>
      )}
    </div>
  );
}
