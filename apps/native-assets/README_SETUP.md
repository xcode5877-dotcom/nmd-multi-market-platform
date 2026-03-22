# Capacitor Setup – Using the Config Templates

This guide explains how to use the `capacitor.config.json` templates in each app folder (customer, merchant, driver, admin) with the Capacitor CLI so each native app loads the correct web URL and is detected as native by the web app.

## 1. Where the configs live

Each app has its own template in `apps/native-assets/`:

| App      | Folder    | Config path                                      |
|----------|-----------|--------------------------------------------------|
| Customer | customer  | `apps/native-assets/customer/capacitor.config.json`  |
| Merchant | merchant  | `apps/native-assets/merchant/capacitor.config.json`  |
| Driver   | driver    | `apps/native-assets/driver/capacitor.config.json`    |
| Admin    | admin     | `apps/native-assets/admin/capacitor.config.json`     |

Each config defines:

- **appId** – Bundle ID (e.g. `com.nmd.customer`)
- **appName** – Display name (e.g. "Now Market")
- **webDir** – Built web output directory (e.g. `out` for static export)
- **server** – Remote URL and `allowNavigation` for loading the live site in the WebView
- **overrideUserAgent** – Token `NMD-Native-App` so the web app’s `isNativeApp` logic works

## 2. Using a config with the Capacitor CLI

### Option A: One native project per app (recommended)

For each app (e.g. Customer), use a dedicated Capacitor project:

1. **Create or use a web app** that builds to a directory (e.g. `out` for Vite static export).

2. **Copy the template** into the project root as `capacitor.config.json`:
   ```bash
   cp apps/native-assets/customer/capacitor.config.json ./capacitor.config.json
   ```

3. **Install Capacitor** (if not already):
   ```bash
   npm install @capacitor/core @capacitor/cli
   npx cap init
   ```
   If you already have a config, overwrite or merge with the template so `appId`, `appName`, `webDir`, and `server` match.

4. **Add platforms:**
   ```bash
   npx cap add android
   npx cap add ios
   ```

5. **Build the web app** into `webDir` (e.g. `out`):
   ```bash
   npm run build
   ```

6. **Sync and run:**
   ```bash
   npx cap sync
   npx cap open android   # or: npx cap open ios
   ```

Repeat the same flow for merchant, driver, and admin using their respective templates.

### Option B: Monorepo with one Capacitor app per web app

If each web app lives in the monorepo (e.g. `apps/storefront`, `apps/courier`, `apps/nmd-admin`):

1. In the **web app** directory (e.g. `apps/storefront`), add Capacitor and copy the **matching** template:
   ```bash
   cd apps/storefront
   npm install @capacitor/core @capacitor/cli
   cp ../../native-assets/customer/capacitor.config.json ./capacitor.config.json
   ```

2. Ensure the build output directory matches `webDir` in the config (e.g. `out`). Adjust `vite.config` (or similar) so the build writes to `out` if needed.

3. Then:
   ```bash
   npx cap init   # only if no capacitor.config.json existed
   npx cap add android
   npx cap add ios
   npm run build
   npx cap sync
   npx cap open android
   ```

Do the same for merchant (e.g. from the app that serves the merchant UI), driver (courier), and admin, using each app’s template.

## 3. WebView user agent (`overrideUserAgent`)

The templates set **`overrideUserAgent": "NMD-Native-App"`**. The web apps detect the native shell with:

`navigator.userAgent.includes('NMD-Native-App')` → `isNativeApp === true`.

- **Capacitor:** As of this writing, Capacitor does not apply a custom User-Agent from the config file alone. You must set the WebView User-Agent in the native project so it **includes** the string `NMD-Native-App` (e.g. append it to the default UA).
  - **Android:** In the main WebView (or Capacitor’s WebView setup), set a custom UA that contains `NMD-Native-App`.
  - **iOS:** Set the custom user agent on the WKWebView (or equivalent) used by Capacitor so it contains `NMD-Native-App`.

Use the `overrideUserAgent` value from the template when implementing this in native code so all four apps stay consistent and the existing web logic keeps working.

## 4. URLs and `server` config

Templates point to:

- **Customer:** `https://nmd.marketing`
- **Merchant:** `https://nmd.marketing/merchant`
- **Driver:** `https://nmd.marketing/driver`
- **Admin:** `https://nmd.marketing/admin`

For local or staging, change `server.url` (and `allowNavigation` if needed) in your local `capacitor.config.json`; the templates in `native-assets` remain the production reference.

## 5. Summary

1. Pick the app (customer / merchant / driver / admin).
2. Copy that app’s `capacitor.config.json` from `apps/native-assets/<app>/` into your Capacitor project root.
3. Ensure the web app builds to the `webDir` in the config (e.g. `out`).
4. Run `npx cap sync` after each web build, then open/run with `npx cap open android` or `npx cap open ios`.
5. In native code, set the WebView User-Agent to include `NMD-Native-App` so the web app’s `isNativeApp` detection works.

For icon/splash specs and Bundle IDs, see each app’s `README.md` and `metadata.json` in the same folder, and **NATIVE-DETECTION.md** for the link between UA and Bundle IDs.
