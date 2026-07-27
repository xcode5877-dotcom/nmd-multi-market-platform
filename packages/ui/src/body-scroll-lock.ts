/**
 * Nested overlay-safe body scroll lock.
 * Modal + Drawer both use this so closing one overlay never clears
 * overflow while another is still open (prevents stuck / mismatched UI).
 */
let lockCount = 0;

export function lockBodyScroll(): void {
  lockCount += 1;
  if (typeof document !== 'undefined') {
    document.body.style.overflow = 'hidden';
  }
}

export function unlockBodyScroll(): void {
  lockCount = Math.max(0, lockCount - 1);
  if (typeof document !== 'undefined' && lockCount === 0) {
    document.body.style.overflow = '';
  }
}

export function getBodyScrollLockCount(): number {
  return lockCount;
}

/** @deprecated use getBodyScrollLockCount */
export function __getBodyScrollLockCountForTests(): number {
  return lockCount;
}

/** Test helper — reset between tests. */
export function __resetBodyScrollLockForTests(): void {
  lockCount = 0;
  if (typeof document !== 'undefined') {
    document.body.style.overflow = '';
  }
}
