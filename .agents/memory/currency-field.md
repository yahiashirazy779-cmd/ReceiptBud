---
name: Receipt currency field
description: How currency is stored, propagated, and displayed throughout ReceiptBud
---

## Rule
The `receipts` table has a `currency TEXT NOT NULL DEFAULT 'USD'` column added via drizzle push.
The AI scan returns `currency` (ISO 4217 code) in its JSON; `scan.tsx` spreads it into `handleSave`; the backend stores it.

## Currency utility
`artifacts/receipt-bud/src/lib/currency.ts` is the single source of truth:
- `getCurrencySymbol(code)` — maps ISO code → display symbol
- `formatCurrency(amount, code)` — returns `"€12.50"` style string
- `CURRENCY_LIST` — 29-item array for pickers

## How currency is displayed
- **Per-receipt amounts** (history, receipt-detail, home list items): `formatCurrency(receipt.total, receipt.currency)`
- **Profile-level totals** (home dashboard, analytics, budget bar): `formatCurrency(amount, profile?.currency || "USD")`
- **Settings**: functional currency picker calls `updateProfile.mutate({ data: { currency: code } })`
- `userProfilesTable.currency` already existed (default "USD") — no schema change needed there

## Zod schemas (generated, hand-edited)
`currency` added as `.optional().default("USD")` to all response shapes in `lib/api-zod/src/generated/api.ts`
and as optional in `CreateReceiptBody`. Also added to the TypeScript interface types.

**Why:** Zod schemas can't be re-generated from openapi (no codegen script wired up), so edits are manual.
