import { useState, useEffect } from 'react';

export const PWA_INSTALL_DISMISS_KEY = 'nmd-pwa-install-dismissed';
/** After user closes the banner, show it again after this many hours (persistent reminder). */
const DISMISS_HOURS = 24;

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

/** Compute eligibility synchronously for immediate show on first paint (client-only). */
function getEligibleSync(): boolean {
  if (typeof window === 'undefined') return false;
  if (isStandalone()) return false;
  if (!isIOS() || !isSafari()) return false;
  try {
    const raw = localStorage.getItem(PWA_INSTALL_DISMISS_KEY);
    if (raw) {
      const ts = parseInt(raw, 10);
      if (!Number.isNaN(ts) && Date.now() - ts < DISMISS_HOURS * 60 * 60 * 1000)
        return false;
    }
  } catch {
    // ignore
  }
  return true;
}

/**
 * Whether to show the iOS PWA install banner (Install Guide Banner).
 * Show when: iOS Safari, NOT in standalone (app not installed), and either
 * never dismissed or dismissed more than 24 hours ago.
 * Auto-shows immediately on page load for every visit (including deep links).
 */
export function useIOSPWAInstallEligible(): boolean {
  const [eligible, setEligible] = useState(() => getEligibleSync());

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
    try {
      const raw = localStorage.getItem(PWA_INSTALL_DISMISS_KEY);
      if (raw) {
        const ts = parseInt(raw, 10);
        if (!Number.isNaN(ts) && Date.now() - ts < DISMISS_HOURS * 60 * 60 * 1000) {
          setEligible(false);
          return;
        }
      }
    } catch {
      // ignore
    }
    setEligible(true);
  }, []);

  return eligible;
}
