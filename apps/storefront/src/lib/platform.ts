/**
 * Platform / device checks for conditional UI (e.g. vertical list on Android app, slider on web).
 * Use when the same route should render differently in the native Android app vs web/desktop.
 */

/** Set to true to force Android UI for testing (APK / WebView). false = use User-Agent. */
const FORCE_ANDROID_UI = false;

/** True when running inside the native Android customer app WebView (NMDCustomerApp / NMD-Android-App in User-Agent). */
export function isAndroidOrMobileApp(): boolean {
  if (FORCE_ANDROID_UI) return true;
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent ?? '';
  return ua.includes('NMDCustomerApp') || ua.includes('NMD-Android-App');
}

/** True when on PWA or mobile web (narrow viewport), NOT in native app. Shows unified bottom nav. */
export function isPwaOrWebMobile(): boolean {
  if (typeof window === 'undefined') return false;
  if (isAndroidOrMobileApp()) return false;
  return window.matchMedia('(max-width: 768px)').matches;
}
