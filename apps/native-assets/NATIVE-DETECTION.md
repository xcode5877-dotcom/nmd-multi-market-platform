# Native App Detection and Bundle IDs

This document links the web isNativeApp logic to the native app Bundle IDs used in Capacitor. Use it when adding UA-based or bundle-based detection.

## Current detection (web)

All four web apps detect the native shell via User-Agent:

- Token: NMD-Native-App
- Logic: navigator.userAgent.includes("NMD-Native-App") gives isNativeApp true
- Used in: apps/storefront, apps/courier, apps/nmd-admin (NativeBridgeContext in each)

When building native wrappers, set the WebView UA to include NMD-Native-App so the same logic works for all four apps.

## Bundle IDs (per app)

- Customer (customer folder): Now Market - com.nmd.customer
- Merchant (merchant folder): Now Merchant - com.nmd.merchant
- Driver (driver folder): Now Driver - com.nmd.driver
- SuperAdmin (admin folder): Now Admin - com.nmd.admin

These values are in each folder's metadata.json.

## Future detection

To tell which native app is running you can append to UA (e.g. NMD-Native-App/com.nmd.customer) or inject window.__NMD_NATIVE_BUNDLE_ID__. Keep the NMD-Native-App token so existing isNativeApp checks still work.
