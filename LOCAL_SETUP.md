# PocketLedger — Local Setup & Testing Guide

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | LTS (20+) | [nodejs.org](https://nodejs.org) — only required runtime |
| npm | Bundled with Node | No separate install needed |
| VS Code | Any | Recommended extensions: React Native Tools, Prettier |
| Expo Go (iPhone) | Latest | Free on the App Store |

> **No Mac required.** Development, testing, and hot reload all run from Windows.

---

## First-Time Setup

```bash
# 1. Clone the repo
git clone https://github.com/Gallections/BudgetTracker.git
cd BudgetTracker

# 2. Install dependencies
npm install

# 3. Start the dev server
npx expo start
```

A QR code will appear in the terminal.

---

## Testing on iPhone (Expo Go)

1. Ensure your iPhone and PC are on the **same Wi-Fi network**
2. Open the **Camera** app on your iPhone and scan the QR code
3. The app opens in Expo Go — it **live-reloads on every file save**

> If the QR code doesn't connect, try pressing `w` in the terminal to switch to tunnel mode: `npx expo start --tunnel`

---

## Running Tests

```bash
# Run all unit tests
npx jest

# Run a single test file
npx jest path/to/file.test.ts

# Run tests in watch mode
npx jest --watch
```

---

## TypeScript Check

```bash
npx tsc --noEmit
```

Run this before committing to catch type errors without building.

---

## Key npm Scripts

| Command | What it does |
|---------|-------------|
| `npx expo start` | Start dev server (scan QR for Expo Go) |
| `npx expo start --tunnel` | Use tunnel if local network fails |
| `npx expo start --clear` | Clear Metro cache and restart |
| `npx jest` | Run unit tests |
| `npx tsc --noEmit` | TypeScript type check |

---

## Environment Variables

Create a `.env` file in the project root (never commit this file):

```
EXCHANGE_RATE_API_KEY=your_key_here
```

Get a free API key at [exchangerate-api.com](https://www.exchangerate-api.com). Until a key is added, the app runs fully offline with cached rates (or 1:1 fallback if no cache exists). Default base currency is **CAD**.

---

## Troubleshooting

**Metro bundler port conflict**
```bash
npx expo start --port 8082
```

**Stale cache causing unexpected errors**
```bash
npx expo start --clear
```

**`node_modules` out of sync after pulling changes**
```bash
npm install
npx expo start --clear
```

**Peer dependency warnings during install**
The project uses `--legacy-peer-deps` for some packages due to React 19 + Expo SDK 55 compatibility. This is expected — use `npm install --legacy-peer-deps` if a fresh install fails.

---

## App Store Builds (EAS — no Mac required)

```bash
# Install EAS CLI
npm install -g eas-cli

# Log in to your Expo account
eas login

# Build for iOS (compiles on Expo's cloud Mac)
eas build --platform ios

# Submit to App Store Connect
eas submit --platform ios
```

Requires an Apple Developer account ($99 CAD/year) for App Store distribution. Not needed during development with Expo Go.
