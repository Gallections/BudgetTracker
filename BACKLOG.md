# PocketLedger — Feature Backlog

Features not yet implemented, ordered roughly by priority.

---

## 🔴 High Priority

### ~~1. Currency Conversion (amount_in_base_currency)~~
**Status:** ✅ Done
`useExchangeRates`, `currencyConvert.ts`, API key support, and 24-hour cache are all in place.
`amount_in_base_currency` is currently set equal to `amount` everywhere — no real conversion happens.
**Files to fix:** `components/ConfirmationSheet.tsx`, `components/EditTransactionSheet.tsx`
**API key:** `EXCHANGE_RATE_API_KEY` env var (placeholder until key provided)

### 2. Voice Entry (native dev build)
**Status:** Stub only — `isSpeechRecognitionSupported = false`
The mic UI exists on the Home tab. Requires an Expo development build (not Expo Go).
`expo-speech-recognition` is already installed; `useSpeechRecognition.ts` needs to be wired up.
**Files to fix:** `hooks/useSpeechRecognition.ts`, `app/(tabs)/index.tsx`

---

## 🟡 Medium Priority

### 3. Budget Alerts / Notifications
**Status:** Not implemented
Budgets are stored and shown as progress gauges on the Dashboard, but nothing warns the user when approaching or exceeding a budget.
Options: in-app alert on Dashboard load, or push notifications via `expo-notifications`.

### 4. Recurring Expense Auto-Posting
**Status:** Not implemented
Recurring expenses are used only to estimate monthly costs. They don't auto-create transactions.
Could be implemented as a prompt on app launch ("You have 2 recurring expenses due — log them now?").

### 5. Bill Reminders
**Status:** Visual only
The overdue indicator (amber bar) on the Expenses tab is visual only. No notification or reminder fires when a recurring expense is overdue.

### 6. Outstanding Balance on Recurring Expenses
**Status:** DB field exists, UI ignores it
`outstanding_balance` column exists in `regular_expenses` table. The Add/Edit sheet captures it but nothing displays or uses it (e.g. debt payoff tracking).

---

## 🟢 Lower Priority / Nice to Have

### 7. Savings Goals
**Status:** Not implemented
Allow users to define a savings goal (name, target amount, target date). Track progress against a chosen savings account or across all accounts.

### 8. Month-over-Month Spending Report
**Status:** Partial (6-month trend chart exists)
A more detailed breakdown: top merchants, biggest category shifts, savings rate percentage.

### 9. Transaction Tags
**Status:** Not implemented
Free-form tags on transactions beyond category (e.g. "work", "reimbursable", "tax-deductible").

### 10. Cloud Backup
**Status:** Not implemented
Export to iCloud Drive / Google Drive instead of (or in addition to) the current share-sheet approach.

### 11. CSV Import
**Status:** Not implemented
Import transactions from a CSV file (e.g. from a bank export). Currently only JSON backup restore is supported.

### 12. App Version Label
**Status:** Hardcoded
Settings footer reads "PocketLedger · Phase 6" — should read actual version from `app.json`.

---

## Notes
- All DB tables use soft-delete (`deleted_at`) — never hard-delete
- Base currency defaults to CAD; exchange rates via `EXCHANGE_RATE_API_KEY` env var
- Voice entry requires a native dev build (`eas build --profile development`)
