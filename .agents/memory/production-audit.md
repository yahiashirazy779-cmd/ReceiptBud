---
name: Production readiness audit findings
description: All bugs found and fixed in the full production audit of ReceiptBud
---

## Fixed Issues (by severity)

### Critical — Runtime crashes
- **subscriptions.tsx**: `useGetMyProfile` was imported but never called in the `Subscriptions` component. `profile?.currency` was referenced in the stats section, causing a runtime crash when any active subscriptions existed. Fix: add `const { data: profile } = useGetMyProfile();` inside the component.

### High — Broken functionality
- **settings.tsx**: "Edit Profile" button had no onClick. Fix: destructure `openUserProfile` from `useClerk()` and call it.
- **home.tsx**: Notification bell (Bell icon) had no onClick. Fix: wrapped in `<Link href="/subscriptions">`.
- **settings.tsx**: Notifications switch used `defaultChecked` (hardcoded true). Fix: made controlled state persisted in localStorage.

### Medium — Null safety / crash risk
- **lib/currency.ts**: `formatCurrency(null, ...)` would call `.toFixed(2)` on null and crash. Fix: guard `amount == null || isNaN(amount)` → return `${sym}0.00`.
- **scan.tsx**: `item.price?.toFixed(2)` rendered `undefined` in UI when price missing. Fix: `item.price != null ? item.price.toFixed(2) : "—"`.

### Medium — Dead code / import cleanup
- **analytics.tsx**: `ArrowUp` and `getCurrencySymbol` imported but never used. Removed.
- **home.tsx**: `CreditCard` imported but never used. Removed.

### Medium — Layout/overflow
- **scan.tsx**: Line item `item.name` lacked `truncate` class, could overflow flex container. Fixed.
- **analytics.tsx**: Category name in "Top Categories" list lacked `truncate`/`min-w-0`. Fixed.
- **subscriptions.tsx**: `pb-24` hardcoded instead of `pb-nav md:pb-8`. Fixed.

### Low — UX / polish
- **not-found.tsx**: 404 page had no navigation back. Added "Go Home" button with proper styling.
- **budgets.tsx**: "Monthly Limit ($)" label implied USD. Changed to "Monthly Limit".
- **bud-mascot.tsx**: SVG used kebab-case `stop-color` instead of React camelCase `stopColor`. Fixed — eliminates the console warning in production.

## What NOT to change
- Daily tips, motivational strings, color arrays — intentional hardcoded content, not bugs.
- Subscription emoji fallback `📦` — intentional default.
- CURRENCIES/CATEGORIES constants in subscriptions.tsx — intentional local list.
- Chat page Gemini model error — pre-existing backend config issue, not a frontend bug.

**Why:** These were audited but correctly identified as intentional design choices, not bugs.
