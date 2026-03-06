/**
 * Open WhatsApp for order handoff without leaving an ugly intermediate/redirect page.
 * - Mobile: use whatsapp:// deep link so the app opens directly; current tab stays on our page.
 * - Desktop: open wa.me in a new tab so the success page stays in the original tab.
 */

export function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent ?? '';
  const hasTouch = 'maxTouchPoints' in navigator && navigator.maxTouchPoints > 0;
  const isSmall = typeof window !== 'undefined' && window.innerWidth < 768;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) || (hasTouch && isSmall);
}

/**
 * Open WhatsApp with the given URLs. Prefers deep link on mobile so the app opens directly
 * and the browser stays on the current page (e.g. Order Success). On desktop opens wa.me
 * in a new tab so the user can return to the success tab.
 */
export function openWhatsAppOrderLink(waMeUrl: string, deepLinkUrl: string): void {
  if (!waMeUrl && !deepLinkUrl) return;
  if (isMobile() && deepLinkUrl.startsWith('whatsapp://')) {
    window.location.href = deepLinkUrl;
  } else if (waMeUrl.startsWith('https://wa.me/')) {
    const opened = window.open(waMeUrl, '_blank', 'noopener,noreferrer');
    if (!opened) window.location.href = waMeUrl;
  } else if (deepLinkUrl.startsWith('whatsapp://')) {
    window.location.href = deepLinkUrl;
  }
}
