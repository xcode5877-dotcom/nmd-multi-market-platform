/**
 * Coupon service: winner coupon creation and WhatsApp notification.
 * WhatsApp is sent only when a winner phone is provided and the coupon is successfully saved.
 * Provider: placeholder (UltraMsg / Twilio); for now logs to console in production format.
 */

/** Base URL for CTA link (storefront or market). */
const STOREFRONT_BASE = process.env.STOREFRONT_BASE_URL ?? process.env.PUBLIC_URL ?? 'https://nmd.marketing';

/**
 * Build the winner notification message (Header + Body + CTA).
 */
function buildWinnerCouponMessage(code: string): string {
  const lines = [
    'مبروك! لقد فزت مع Now Market.',
    '',
    `كود الخصم الخاص بك هو: ${code}.`,
    '',
    'استخدمه الآن عبر الرابط التالي.',
    STOREFRONT_BASE,
  ];
  return lines.join('\n');
}

/**
 * Send WhatsApp notification to the winner with their coupon code.
 * Placeholder: logs to console in production format. Replace with UltraMsg/Twilio when configured.
 */
export function sendWhatsAppNotification(phoneNumber: string, code: string): void {
  const normalized = phoneNumber.replace(/\D/g, '').trim();
  if (!normalized || normalized.length < 9) return;

  const message = buildWinnerCouponMessage(code);
  // Production-style log; replace with actual provider when ready:
  // await ultraMsgClient.send(normalized, message) or twilioClient.messages.create(...)
  console.log(`[WhatsApp to ${normalized}]: ${message}`);
}
