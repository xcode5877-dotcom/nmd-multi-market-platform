# Native App Assets

This folder holds **configuration and high-resolution assets** for the four NMD native apps (Customer, Merchant, Driver, SuperAdmin). It is **not** part of the web public folder and is not served by the web server.

## Structure

```
native-assets/
  customer/        # Storefront app – Now Market  [Assets Ready]
  merchant/        # Tenant portal app – Now Merchant  [Assets Ready]
  driver/          # Courier app – Now Driver  [Assets Ready]
  admin/           # SuperAdmin app – Now Admin  [Assets Ready]
  NATIVE-DETECTION.md   # Links isNativeApp (UA) to Bundle IDs
```

**Status:**
- Customer App (customer/) – **Assets Ready** (icon.png, splash.png deployed).
- Merchant App (merchant/) – **Assets Ready** (icon.png, splash.png deployed).
- Driver App (driver/) – **Assets Ready** (icon.png, splash.png deployed).
- Admin App (admin/) – **Assets Ready** (icon.png, splash.png deployed).

**Final review:** All 4 apps (customer, merchant, driver, admin) have icon.png, splash.png, capacitor.config.json, and metadata.json in place and are ready for Capacitor/native builds.

Each app folder contains:

- **README.md** – Required icon and splash dimensions for both stores.
- **metadata.json** – App name, Bundle ID, version (for Capacitor/config).
- **capacitor.config.json** – Capacitor config template (appId, server URL, `overrideUserAgent` for native detection).

See **README_SETUP.md** for how to use these configs with the Capacitor CLI.

## Icon specifications (all apps)

| Asset | Dimensions | Notes |
|-------|------------|--------|
| **App Icon** | **1024×1024 px** | No transparency for iOS. PNG recommended. |
| **Splash Screen** | **2732×2732 px** | Centered logo; background as per brand. |

See each app’s `README.md` for the same specs and a checklist.

## Usage

- Copy icons and splash images into the relevant app folder when preparing Capacitor/native builds.
- Use `metadata.json` for app name, bundle ID, and version in native config.
- **Native detection:** Web apps use `navigator.userAgent.includes('NMD-Native-App')` for `isNativeApp`. See **NATIVE-DETECTION.md** for Bundle IDs and how to link future detection to these apps.
