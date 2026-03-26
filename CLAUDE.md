# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

PocketLedger — voice-first personal finance iOS app built with React Native and Expo (SDK 54, managed workflow). Development runs entirely on Windows; testing uses Expo Go on iPhone via QR code. No Mac required.

## Commands

```bash
# Start dev server (scan QR with Expo Go app on iPhone)
npx expo start

# Clear Metro cache and restart
npx expo start --clear

# Use tunnel if local network QR fails
npx expo start --tunnel

# TypeScript check (no emit)
npx tsc --noEmit

# Run all unit tests
npx jest

# Run a single test file
npx jest path/to/file.test.ts

# Run tests in watch mode
npx jest --watch

# Install a new Expo-compatible package
npx expo install <package>

# Install non-Expo packages (use --legacy-peer-deps due to React 19 peer dep conflicts)
npm install <package> --legacy-peer-deps
```

## Architecture

**Navigation:** Expo Router (file-based). 5 tabs: Home | Savings | Expenses | Dashboard | Settings.
- `app/_layout.tsx` — root layout, wraps everything in `AppProvider`
- `app/(tabs)/_layout.tsx` — tab bar definition
- `app/(tabs)/` — one file per tab screen

**State:** `context/AppContext.tsx` — React Context + useReducer. Holds `baseCurrency`, `dbReady` flag, and `refreshKey` (bump to trigger data refetch across screens).

**Database:** All data is on-device SQLite via `expo-sqlite`. No backend.
- `db/db.ts` — opens DB, runs all `CREATE TABLE` migrations on init
- `db/savings.ts`, `db/regularExpenses.ts`, `db/transactions.ts` — per-table query functions
- All mutable tables have a `deleted_at TEXT` column — soft delete only; all queries filter `WHERE deleted_at IS NULL`
- `user_settings` stores key-value pairs: `base_currency` (default `CAD`), per-category budgets as `budget_<category>`

**Constants:** `constants/categories.ts` (keyword→category map for NLP), `constants/currencies.ts`, `constants/colors.ts` (light/dark tokens).

**Utilities:** `utils/nlpParser.ts` (voice transcript → structured expense), `utils/currencyConvert.ts` (rate-based conversion).

**Hooks:** `hooks/useSpeechRecognition.ts`, `hooks/useExchangeRates.ts`, `hooks/useDashboard.ts`.

## Development Workflow

**Before concluding any phase**, both of these must pass with zero errors:

```bash
npx tsc --noEmit   # zero TypeScript errors
npx jest           # all tests pass
```

### TypeScript error fixes
- Fix TS errors by correcting types, signatures, or annotations only — never change runtime logic to satisfy the type checker
- If a TS fix would alter behaviour (e.g. changing a default value, removing a null check, altering a function signature), stop and flag it rather than silently changing the code
- Add type assertions (`as`) only when the value is genuinely known at that point; never use `as any` to suppress an error without understanding it

### Tests
- Fix all failures before marking a phase complete — do not defer to a later phase
- When adding new tests, run the existing suite first to confirm it is green before adding new cases

## Key Decisions

- **Soft delete everywhere** — never hard-delete rows; set `deleted_at` instead
- **5 tabs** — Savings and Expenses are top-level tabs, not nested under Settings
- **Per-category budgets** — stored as `budget_<category>` keys in `user_settings`, not a single global number
- **Base currency:** CAD default; exchange rates via `EXCHANGE_RATE_API_KEY` env var (placeholder until key is provided)
- Use `--legacy-peer-deps` for npm installs due to React 19 + Expo SDK 54 peer dependency conflicts
