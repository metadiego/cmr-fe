# Handoff BE → FE: "who did it" is the person (staff ID)

**Origin:** `cmr-be/docs/specs/supabase-project-migration.md` (move to a new Supabase project),
decision of 2026-11-02, **one person, one pointer**. BE branch `feat/supabase-move`. **It deploys
inside the cutover window together with this FE change**: neither ships alone.

## The rule

- The **staff record is the person** (`/auth/me` → `staffId`). Every login has exactly one.
- The **profile is that person's login** (`/auth/me` → `profileId`).
- The **login ID** (`/auth/me` → `id`, Supabase's `session.user.id`) is no longer stored anywhere
  except the audit log.

## What changes in the API

Every field that says **who did something** now holds the **staff ID**: invoices (`createdBy`,
`issuedBy`, `cancelledBy`), payments and refunds (`userId`, who voided), the cash reconciliation
and its **cashier roster** (`userId`), transfers, discount rules, reopenings, the alert creator
and resolver, panel notices, exports, `updatedBy` on printers and packages. Before, it held the
login ID or the profile ID, depending on the case. **Field names don't change.**

**Stays on the profile** (it belongs to the login, not to "who did it"): the board layout per user
and the alert inbox (recipients, read/acknowledged).

**Already like this, no change:** event `actorId` (appointments, frontdesk, nurse status) is the
staff ID, and the FE already sends `me.staffId`.

## What the FE has to change

| Where | Today | It becomes |
|---|---|---|
| `components/caja/cuadre-caja.tsx:142` | `meId={me?.id ?? null}` (login) | `meId={me?.staffId ?? null}`: the roster and the reconciliations come back keyed by staff ID; `c.userId === meId` (line 473 and `desglose-cajeros.tsx:53`) only matches that way |
| `components/calendario/calendario.tsx:86-88` | `esMio` compares `createdBy` against `profileId` or `id` | Compare against **`me.staffId`**. Remove the `profileId`/`id` comparisons once cutover is done |
| Any user picker that sends a "who" to the BE (filter by cashier, `creadoPor`/`actorId` in a body) | — | Send the **staff ID** of the selected item. Checked on 2026-11-02: today the FE sends none (beyond `me.staffId` in appointments/frontdesk) |

Alert **recipients** (`targets.usuarioIds`), if one is ever sent, are **profile IDs** (the inbox
belongs to the login).

**New 403 in Cash** (BE, final review of the move): a caller **without** `caja.ver_todos` and
**without a staff record** gets `403` on the day report, the reconciliation list, the cashier roster
and on opening a reconciliation, instead of (as before) every cashier's cash. It should not happen
after the cutover (every login has its person, and approving a login now creates it), but if it
does, the Cash screen must show the API's message ("No staff record for this login…") instead of an
empty screen or a generic error, so an admin knows to link that login to its staff record.

## How to check it

1. A cashier (not management) → Billing › Cash: sees their own reconciliation with the "mine"
   marker and appears in the roster.
2. Management picks a cashier: the reconciliation loads without falling back to "consolidated".
3. Calendar: an event you created can be edited by you and not by anyone else.
4. An invoice you issued today can be edited by you (the BE decides; the button shows up).
