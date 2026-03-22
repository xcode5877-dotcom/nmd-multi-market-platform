# NMD Customer – Android App

Professional Android wrapper for the NMD Customer experience: WebView + native bottom navigation and FCM.

## Specs

- **Package:** `com.nmd.customer.app`
- **Tech:** Java, Gradle 8.2, JDK 17, Kotlin BOM 1.8.22
- **Min SDK:** 24 | **Target SDK:** 34

## Features

- **MainActivity:** WebView (full area above bottom bar) + native **Bottom Navigation Bar** (Home, Categories, Orders, Profile).
- **Bottom bar toggle:** Web can call `NMDNative.setBottomBarVisible(false)` when the cart or checkout bar is visible to avoid overlap, and `NMDNative.setBottomBarVisible(true)` when hidden.
- **Bridge:** `NMDNative` JavaScript interface for web ↔ native (e.g. bar visibility).
- **Hardware acceleration** and **cookie management** for a seamless Global Identity session.
- **FCM** for push notifications (`MyFirebaseMessagingService`).

## Setup

1. **JDK 17:** Set `JAVA_HOME` to JDK 17.
2. **Gradle wrapper:** If `gradle/wrapper/gradle-wrapper.jar` is missing, run (with Gradle installed):  
   `gradle wrapper --gradle-version=8.2`
3. **Storefront URL:** Set `app/src/main/res/values/strings.xml` → `web_base_url` to your storefront base URL.
4. **Firebase (optional):**  
   - Add `app/google-services.json` from Firebase Console.  
   - In `app/build.gradle`, uncomment: `apply plugin: 'com.google.gms.google-services'`

## Build

- **Debug:** `./gradlew assembleDebug` (or `gradlew.bat assembleDebug` on Windows)
- **Release:** `./gradlew assembleRelease` (configure signing in `app/build.gradle`)

## Web integration

From the web app (storefront), when the cart bar or checkout bar is shown/hidden:

```javascript
if (window.NMDNative && typeof NMDNative.setBottomBarVisible === 'function') {
  NMDNative.setBottomBarVisible(false); // hide native bottom bar when cart/checkout is visible
}
// When cart/checkout is dismissed:
NMDNative.setBottomBarVisible(true);
```

No web folders or database logic in this repo are modified; this is the mobile wrapper only.
