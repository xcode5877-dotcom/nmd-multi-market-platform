import { useState, useEffect } from 'react';

/** Detect iOS (iPhone / iPad). */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/** Detect Safari (including iOS Safari). Excludes Chrome/Firefox on iOS. */
export function isSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) {
    return !/CriOS|FxiOS|EdgiOS/.test(ua);
  }
  return /Safari/.test(ua) && !/Chrome|Chromium/.test(ua);
}

/**
 * Strict standalone check: true only when the app is already installed as PWA.
 * Uses: window.navigator.standalone (iOS Safari) and
 *       window.matchMedia('(display-mode: standalone)').matches (standard).
 */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  return false;
}

/**
 * Whether to show the iOS PWA install banner (Install Guide Sheet).
 * Show when: iOS Safari and NOT in standalone (app not installed).
 * Only hide when isStandalone() === true. No dismiss persistence — prompt reappears every visit/refresh.
 */
export function useIOSPWAInstallEligible(): boolean {
  const [eligible, setEligible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isStandalone()) {
      setEligible(false);
      return;
    }
    if (!isIOS() || !isSafari()) {
      setEligible(false);
      return;
    }
    setEligible(true);
  }, []);

  return eligible;
}
