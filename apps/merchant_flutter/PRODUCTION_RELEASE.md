# Merchant Flutter Production Release

## Current Release Status

- App path: `apps/merchant_flutter`
- Android package/application ID: `com.nowmarket.merchant`
- Android namespace: `com.nowmarket.merchant_flutter`
- Display name: `Now Market Merchant`
- Flutter version: `3.41.5`
- Android Gradle Plugin: `8.11.1`
- Kotlin plugin: `2.2.20`
- SDK defaults from the installed Flutter tool: `minSdk 24`, `targetSdk 36`, `compileSdk 36`, `ndk 28.2.13676358`
- App version: `0.1.0+1`
- Release bundle path: `build/app/outputs/bundle/release/app-release.aab`
- Latest local verification: `flutter analyze` passed, `flutter build appbundle --release` produced a signed `43.3MB` AAB, and `jarsigner -verify` returned `jar verified`.

## Signing Configuration

Release signing is configured in `android/app/build.gradle.kts` and supports both local `android/key.properties` and CI environment variables.

Release builds now always use the `release` signing config. They fail if release signing credentials are missing or the keystore path is invalid; they do not fall back to the debug key.

Local ignored files created for this workspace:

- `android/upload-keystore.jks`
- `android/key.properties`

Keep both files private and backed up. If this upload key is used for the first Play Store upload, losing it means future updates will require a Play upload key reset.

### `android/key.properties`

Use `android/key.properties.example` as the template:

```properties
storeFile=upload-keystore.jks
storeType=PKCS12
storePassword=<secure-store-password>
keyAlias=nmd_merchant_upload
keyPassword=<same-as-store-password-for-pkcs12>
```

`storeFile` can be absolute or relative to `apps/merchant_flutter/android`.

### CI Environment Variables

The same signing configuration can be supplied without a local properties file:

```bash
export NMD_RELEASE_STORE_FILE=/secure/path/upload-keystore.jks
export NMD_RELEASE_STORE_TYPE=PKCS12
export NMD_RELEASE_STORE_PASSWORD='<secure-store-password>'
export NMD_RELEASE_KEY_ALIAS=nmd_merchant_upload
export NMD_RELEASE_KEY_PASSWORD='<secure-key-password>'
```

## Exact Release Commands

Run from the app directory:

```bash
cd apps/merchant_flutter
flutter pub get
flutter analyze
flutter build appbundle --release
```

Optional clean rebuild:

```bash
cd apps/merchant_flutter
flutter clean
flutter pub get
flutter analyze
flutter build appbundle --release
```

Verify the AAB signature:

```bash
jarsigner -verify -verbose -certs build/app/outputs/bundle/release/app-release.aab
```

Verify the upload keystore alias:

```bash
keytool -list -v -keystore android/upload-keystore.jks -alias nmd_merchant_upload
```

## Production Hardening Completed

- Release signing no longer falls back to debug signing.
- Release signing can be supplied by local ignored `key.properties` or by CI environment variables.
- Explicit no-cleartext network security config added.
- Android backup disabled with `android:allowBackup="false"` and `android:fullBackupContent="false"`.
- Source launcher icons added for all standard Android densities.
- Native launch screen now uses the app icon instead of a blank default splash.
- Release UI hides the internal API base and tenant diagnostic line while keeping it visible in non-release builds.
- Sunmi printer dependencies, permissions, and service code were preserved.
- Live order polling, auth/session storage, and tenant order APIs were preserved.

## Release Checklist

- Confirm final public version name and version code in `pubspec.yaml`. Current value is `0.1.0+1`; Play updates require each new upload to use a higher version code.
- Confirm the package name `com.nowmarket.merchant` is the permanent Play Store package before the first upload.
- Confirm the generated upload key is the intended long-term Play upload key, or replace it with the organization-owned upload key before uploading.
- Run `flutter analyze` before every release.
- Build the Play artifact with `flutter build appbundle --release`.
- Verify `build/app/outputs/bundle/release/app-release.aab` exists and passes `jarsigner -verify`.
- Test the signed release build on a real Sunmi V2 device before rollout.
- Verify printing behavior for new orders, manual reprint, card-paid receipt marking, and kitchen/customer receipt copies.
- Verify login, tenant selection, tenant settings, live polling, confirming orders, and logout.
- Verify production API reachability over HTTPS only.
- Prepare Play Store listing assets, privacy policy URL, Data Safety answers, app category, screenshots, and support contact.

## Play Store Upload Instructions

1. Open Google Play Console and create or select the Merchant app.
2. Use package name `com.nowmarket.merchant`.
3. Enroll in Play App Signing if not already enrolled.
4. Upload `build/app/outputs/bundle/release/app-release.aab` to an internal testing release first.
5. Complete release notes, Data Safety, privacy policy, app access instructions, content rating, target audience, and store listing.
6. Roll out to internal testers and validate on Sunmi hardware.
7. Promote to closed/open testing, then production after printer, auth, tenant, and order polling checks pass.

## Remaining Production Blockers To Decide

- Versioning is still pre-release (`0.1.0+1`). Set the final release version before public upload.
- The app currently uses email/password login with optional manual tenant/market overrides. Preserve this only if it is the approved production Merchant POS flow; otherwise align it with the platform OTP session model in a separate auth task.
- The API base is fixed to `https://nmd.marketing/api`. This is production-safe for TLS, but there is no flavor or `--dart-define` switch for staging versus production.
- Sunmi printing calls are direct. A separate hardening pass should add device readiness/error handling and duplicate-print protection around partial print failures.
- Polling runs every 8 seconds without retry backoff or explicit 401 session expiry handling. This can be improved later without changing the release signing pipeline.
