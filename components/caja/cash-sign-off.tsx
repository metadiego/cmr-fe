"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkBadge01Icon, Alert02Icon } from "@hugeicons/core-free-icons";

import { acknowledgeCashSignature, getCashSignatures, signCashSheet } from "@/lib/api/caja";
import { getCentroPreferences } from "@/lib/api/preferences";
import { ApiError } from "@/lib/api/types";
import { apiErrorMessage, toastError } from "@/lib/api/errors";
import { money } from "@/lib/caja/totales";
import {
  alreadySignedBy,
  readSignOffStatement,
  signatureBlocks,
  type CashSignature,
  type PrintedSignature,
  type SiblingSheet,
  type SignatureBlock,
  type SignedFigures,
  type SignOffRole,
} from "@/lib/caja/sign-off";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// «Firmar y aceptar» a cash sheet (BE #486, handoff docs/specs/cash-sign-off-handoff.md). Signing is a
// STAMP — name, date and time, and the figures accepted — and never needs the sheet closed (the owner
// does not close: late phone sales move it). The hook loads the signatures and puts them into words for
// the screen AND the printed sheet; the panel shows them with the buttons.

export type CashSignOffOptions = {
  /** The saved sheet, if there is one yet. */
  sheetId: string | null;
  /** Opens (or resumes) the sheet and returns its id: signing needs one. */
  ensureSheet: () => Promise<string>;
  /** A single cashier's sheet (Cajero + Gerente) vs consolidated / day total (one block per cashier). */
  isCashierSheet: boolean;
  /** The sheet's figures as they are NOW (lib/caja/sign-off.ts figuresOfReport). */
  now: SignedFigures;
  meId: string | null;
  canSignCashier: boolean;
  canSignSupervisor: boolean;
  centerId?: string | null;
  /** Consolidated / total: the cashier sheets it sums, and how to read one's current figures. */
  siblings?: () => Promise<SiblingSheet[]>;
  siblingNow?: (sib: SiblingSheet) => Promise<SignedFigures>;
  /** After signing (the sheet may have just been created). */
  onSigned?: () => void;
};

type Loaded = {
  sheetId: string | null;
  own: CashSignature[];
  siblings: Array<SiblingSheet & { signatures: CashSignature[]; now: SignedFigures | null }>;
};

export function useCashSignOff(o: CashSignOffOptions) {
  const t = useTranslations("caja.signOff");
  const tRoot = useTranslations();
  const format = useFormatter();
  const [loaded, setLoaded] = React.useState<Loaded | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [statement, setStatement] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);
  const opts = React.useRef(o);
  React.useEffect(() => {
    opts.current = o;
  });

  const { sheetId, centerId } = o;
  React.useEffect(() => {
    let alive = true;
    (async () => {
      const cur = opts.current;
      const own = sheetId ? await getCashSignatures(sheetId, centerId) : [];
      const sibs = cur.siblings ? await cur.siblings() : [];
      const siblings = await Promise.all(
        sibs.map(async (sib) => {
          const signatures = await getCashSignatures(sib.id, centerId).catch(() => [] as CashSignature[]);
          // Only a signed sheet needs its own figures (to tell whether it moved after signing).
          const signed = signatures.some((s) => s.role === "cashier" && !s.voidedAt);
          const now = signed && cur.siblingNow ? await cur.siblingNow(sib).catch(() => null) : null;
          return { ...sib, signatures, now };
        }),
      );
      if (alive) {
        setLoaded({ sheetId, own, siblings });
        setFailed(false);
      }
    })().catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [sheetId, centerId, tick]);

  // The center's text (preference caja.signOff.statement). Reading center preferences may be admin-only:
  // on failure the dialog shows the text of the last signature, else the default.
  React.useEffect(() => {
    if (!centerId) return;
    let alive = true;
    getCentroPreferences(centerId)
      .then((cfg) => alive && setStatement(readSignOffStatement(cfg)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [centerId]);

  const blocks: SignatureBlock[] = React.useMemo(
    () =>
      signatureBlocks({
        own: loaded?.own ?? [],
        now: o.now,
        isCashierSheet: o.isCashierSheet,
        siblings: loaded?.siblings,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loaded, o.isCashierSheet, o.now.dayTotal, o.now.salesCash, o.now.countedCash, o.now.difference],
  );

  const lastStatement = [...(loaded?.own ?? []), ...(loaded?.siblings.flatMap((s) => s.signatures) ?? [])]
    .filter((s) => !s.voidedAt)
    .sort((a, b) => (a.signedAt < b.signedAt ? 1 : -1))[0]?.statement;
  const effectiveStatement = statement ?? lastStatement ?? t("defaultStatement");

  const when = (iso: string) => format.dateTime(new Date(iso), "dateAndTime");
  const label = (b: SignatureBlock) =>
    b.role === "supervisor" ? t("supervisor") : b.cashierName ? t("cashierNamed", { name: b.cashierName }) : t("cashier");
  const words = (b: SignatureBlock) => ({
    label: label(b),
    line: b.signature ? t("acceptedBy", { name: b.signature.signerName, when: when(b.signature.signedAt) }) : undefined,
    warning:
      b.signature && b.changed
        ? t("otherFigures", { total: money(b.signature.figures.dayTotal), difference: money(b.signature.figures.difference) })
        : undefined,
    note:
      b.signature && b.acknowledged
        ? t("acknowledgedNote", {
            name: b.signature.acknowledgedByName ?? "—",
            when: b.signature.acknowledgedAt ? when(b.signature.acknowledgedAt) : "—",
          })
        : undefined,
  });
  const printed: PrintedSignature[] = blocks.map(words);

  async function sign(role: SignOffRole): Promise<boolean> {
    try {
      const id = loaded?.sheetId ?? (await opts.current.ensureSheet());
      await signCashSheet(id, role, centerId);
      toast.success(t("signed"));
      if (!loaded?.sheetId) opts.current.onSigned?.();
      setLoaded((l) => (l ? { ...l, sheetId: id } : l));
      setTick((n) => n + 1);
      return true;
    } catch (err) {
      const who = alreadySignedBy(err instanceof ApiError ? err : null);
      toast.error(who ? t("alreadySignedBy", { name: who.signedBy, when: who.signedAt ? when(who.signedAt) : "—" }) : apiErrorMessage(err));
      setTick((n) => n + 1);
      return false;
    }
  }

  // A manager acknowledges a correction of already-signed figures (BE #565): the 428 shield asks first.
  async function acknowledge(b: SignatureBlock, reason: string): Promise<boolean> {
    if (!b.signature || !b.sheetId) return false;
    try {
      await acknowledgeCashSignature(b.sheetId, b.signature.id, reason, centerId);
      toast.success(t("acknowledged"));
      setTick((n) => n + 1);
      return true;
    } catch (err) {
      toastError(err, tRoot);
      return false;
    }
  }

  return { blocks, printed, words, statement: effectiveStatement, failed, loading: !loaded && !failed, sign, acknowledge };
}

export type CashSignOff = ReturnType<typeof useCashSignOff>;

export function CashSignOffPanel({
  signOff,
  now,
  meId,
  canSignCashier,
  canSignSupervisor,
  onSignMine,
}: {
  signOff: CashSignOff;
  now: SignedFigures;
  meId: string | null;
  canSignCashier: boolean;
  canSignSupervisor: boolean;
  /** Consolidated view of someone who billed that day: open her own sheet to sign it. */
  onSignMine?: () => void;
}) {
  const t = useTranslations("caja.signOff");
  const [asking, setAsking] = React.useState<SignOffRole | null>(null);
  const [ackBlock, setAckBlock] = React.useState<SignatureBlock | null>(null);
  const [ackReason, setAckReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  // A role someone ELSE already signed has no button (the BE would answer 409); one I signed = «sign again».
  const live = (role: SignOffRole) =>
    signOff.blocks.find((b) => b.role === role && (role === "supervisor" || b.key === "cashier"))?.signature ?? null;
  const button = (role: SignOffRole, allowed: boolean) => {
    if (!allowed) return null;
    const s = live(role);
    if (s && s.staffId !== meId) return null;
    const text = s ? t("signAgain") : role === "cashier" ? t("signCashier") : t("signSupervisor");
    return (
      <Button key={role} size="sm" variant={role === "cashier" ? "default" : "outline"} disabled={signOff.loading} onClick={() => setAsking(role)}>
        <HugeiconsIcon icon={CheckmarkBadge01Icon} className="size-4" />
        {text}
      </Button>
    );
  };

  async function accept() {
    if (!asking) return;
    setBusy(true);
    const ok = await signOff.sign(asking);
    setBusy(false);
    if (ok) setAsking(null);
  }

  const figureRows: Array<[string, number]> = [
    [t("dayTotal"), now.dayTotal],
    [t("salesCash"), now.salesCash],
    [t("countedCash"), now.countedCash],
    [t("difference"), now.difference],
  ];

  return (
    <section className="rounded-md bg-card px-4 py-3 shadow-sm ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t("title")}</h3>
        <div className="flex flex-wrap gap-2">
          {onSignMine && (
            <Button size="sm" onClick={onSignMine}>
              <HugeiconsIcon icon={CheckmarkBadge01Icon} className="size-4" />
              {t("signMine")}
            </Button>
          )}
          {button("cashier", canSignCashier)}
          {button("supervisor", canSignSupervisor)}
        </div>
      </div>
      {signOff.failed && <p className="mt-2 text-xs text-destructive">{t("loadError")}</p>}
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {signOff.blocks.map((b) => {
          const w = signOff.words(b);
          return (
            <div key={b.key} className="rounded-md border px-3 py-2">
              <div className="text-xs text-muted-foreground">{w.label}</div>
              {w.line ? (
                <div className="mt-1 flex items-start gap-1.5 text-sm font-medium text-success-foreground">
                  <HugeiconsIcon icon={CheckmarkBadge01Icon} className="mt-0.5 size-4 shrink-0" />
                  <span>{w.line}</span>
                </div>
              ) : (
                <div className="mt-1 text-sm text-muted-foreground">{signOff.loading ? "…" : t("unsigned")}</div>
              )}
              {w.warning && (
                <div className="mt-1 flex items-start gap-1.5 text-xs font-medium text-destructive">
                  <HugeiconsIcon icon={Alert02Icon} className="mt-0.5 size-3.5 shrink-0" />
                  <span>{w.warning}</span>
                </div>
              )}
              {w.note && <div className="mt-1 text-xs text-muted-foreground">{w.note}</div>}
              {b.changed && canSignSupervisor && (
                <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={() => { setAckReason(""); setAckBlock(b); }}>
                  {t("acknowledge")}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={!!ackBlock} onOpenChange={(v) => !v && !busy && setAckBlock(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("acknowledge")}</DialogTitle>
            <DialogDescription>{t("acknowledgeHint")}</DialogDescription>
          </DialogHeader>
          <Textarea value={ackReason} onChange={(e) => setAckReason(e.target.value)} rows={3} maxLength={500} placeholder={t("acknowledgeReason")} />
          <DialogFooter>
            <Button variant="ghost" disabled={busy} onClick={() => setAckBlock(null)}>{t("cancel")}</Button>
            <Button
              disabled={busy || ackReason.trim().length < 3}
              onClick={async () => {
                if (!ackBlock) return;
                setBusy(true);
                const ok = await signOff.acknowledge(ackBlock, ackReason.trim());
                setBusy(false);
                if (ok) setAckBlock(null);
              }}
            >
              {t("acknowledge")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!asking} onOpenChange={(v) => !v && !busy && setAsking(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{asking === "supervisor" ? t("signSupervisor") : t("dialogTitle")}</DialogTitle>
            <DialogDescription>{t("dialogHint")}</DialogDescription>
          </DialogHeader>
          <p className="rounded-md bg-muted px-3 py-2 text-sm">{signOff.statement}</p>
          <table className="w-full text-sm">
            <tbody>
              {figureRows.map(([k, v]) => (
                <tr key={k} className="border-b last:border-0">
                  <td className="py-1.5 text-muted-foreground">{k}</td>
                  <td className="py-1.5 text-right font-mono tabular-nums">{money(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <DialogFooter>
            <Button variant="ghost" disabled={busy} onClick={() => setAsking(null)}>
              {t("cancel")}
            </Button>
            <Button disabled={busy} onClick={accept}>
              {busy ? t("signing") : t("accept")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
