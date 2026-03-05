/**
 * WhatsApp notification service: triggered when order status changes.
 * Supports third-party (UltraMsg, Whapi) and self-hosted (whatsapp-web.js microservice).
 */

export type WhatsAppNotificationStatus = 'sent' | 'failed';

export interface WhatsAppNotificationLog {
  status: WhatsAppNotificationStatus;
  at: string;
  orderStatus: string;
  error?: string;
}

export interface OrderForNotification {
  id?: string;
  status?: string;
  customerName?: string | null;
  customerPhone?: string | null;
  [key: string]: unknown;
}

export interface TenantForNotification {
  name?: string | null;
  [key: string]: unknown;
}

/** Result of sending one notification */
export interface SendResult {
  success: boolean;
  error?: string;
}

/**
 * Provider interface: implement this for UltraMsg, Whapi, or a whatsapp-web.js microservice.
 */
export interface WhatsAppProvider {
  send(phone: string, message: string): Promise<SendResult>;
}

/** Build phone for API: digits only, with country code (e.g. 972501234567) */
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone || typeof phone !== 'string') return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 9) return null;
  const withCountry = digits.startsWith('0') ? '972' + digits.slice(1) : digits.length <= 10 ? '972' + digits : digits;
  return withCountry;
}

// --- Message templates (Arabic) ---

const TEMPLATE_CONFIRMED = 'أهلاً [الاسم]، تم تأكيد طلبك #[الرقم] وهو قيد التجهيز!';
const TEMPLATE_READY = 'طلبك #[الرقم] جاهز الآن وسيتم تسليمه للمرسل.';
const TEMPLATE_SHIPPED = 'طلبك #[الرقم] خرج مع المرسل، توقع وصوله خلال [الوقت].';

function getMessageTemplate(status: string, order: OrderForNotification): string {
  const name = (order.customerName ?? 'عميلنا').trim() || 'عميلنا';
  const orderNum = (order.id ?? '').slice(0, 8);
  const time = '٣٠ دقيقة'; // default ETA; could come from order.deliveryTimeline or tenant settings

  switch (status) {
    case 'CONFIRMED':
      return TEMPLATE_CONFIRMED.replace('[الاسم]', name).replace('[الرقم]', orderNum);
    case 'READY':
      return TEMPLATE_READY.replace('[الرقم]', orderNum);
    case 'COMPLETED':
    case 'DELIVERED':
      return TEMPLATE_SHIPPED.replace('[الرقم]', orderNum).replace('[الوقت]', time);
    default:
      return '';
  }
}

/** Statuses that trigger a WhatsApp notification */
export const NOTIFY_STATUSES = ['CONFIRMED', 'READY', 'COMPLETED', 'DELIVERED'] as const;

function shouldNotify(status: string): boolean {
  return NOTIFY_STATUSES.includes(status as (typeof NOTIFY_STATUSES)[number]);
}

// --- UltraMsg provider ---

const ULTRAMSG_INSTANCE = process.env.ULTRAMSG_INSTANCE_ID ?? process.env.ULTRAMSG_INSTANCE ?? '';
const ULTRAMSG_TOKEN = process.env.ULTRAMSG_TOKEN ?? process.env.ULTRAMSG_API_KEY ?? '';

export function createUltraMsgProvider(): WhatsAppProvider | null {
  if (!ULTRAMSG_INSTANCE || !ULTRAMSG_TOKEN) return null;
  const baseUrl = `https://api.ultramsg.com/${ULTRAMSG_INSTANCE}/messages/chat`;
  return {
    async send(phone: string, message: string): Promise<SendResult> {
      const to = phone.startsWith('+') ? phone.slice(1).replace(/\D/g, '') : phone.replace(/\D/g, '');
      const body = new URLSearchParams({ token: ULTRAMSG_TOKEN, to, body: message });
      try {
        const res = await fetch(baseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          return { success: false, error: data.error ?? `HTTP ${res.status}` };
        }
        if (data.error) return { success: false, error: data.error };
        return { success: true };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
  };
}

// --- Whapi provider (alternative: https://whapi.io / similar APIs) ---

const WHAPI_TOKEN = process.env.WHAPI_TOKEN ?? process.env.WHAPI_API_KEY ?? '';
const WHAPI_INSTANCE = process.env.WHAPI_INSTANCE ?? '';

export function createWhapiProvider(): WhatsAppProvider | null {
  if (!WHAPI_TOKEN) return null;
  // Whapi typically: POST https://gate.whapi.cloud/messages/send with Authorization: Bearer <token>
  const baseUrl = WHAPI_INSTANCE
    ? `https://gate.whapi.cloud/instances/${WHAPI_INSTANCE}/messages/send`
    : 'https://gate.whapi.cloud/messages/send';
  return {
    async send(phone: string, message: string): Promise<SendResult> {
      const to = phone.startsWith('+') ? phone : '+' + phone.replace(/\D/g, '');
      try {
        const res = await fetch(baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${WHAPI_TOKEN}`,
          },
          body: JSON.stringify({ to, body: message }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        if (!res.ok) {
          return { success: false, error: data.error ?? data.message ?? `HTTP ${res.status}` };
        }
        return { success: true };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
  };
}

// --- Self-hosted microservice (whatsapp-web.js behind HTTP) ---

const WHATSAPP_WEB_SERVICE_URL = process.env.WHATSAPP_WEB_SERVICE_URL ?? '';

export function createWhatsAppWebMicroserviceProvider(): WhatsAppProvider | null {
  if (!WHATSAPP_WEB_SERVICE_URL) return null;
  const url = WHATSAPP_WEB_SERVICE_URL.replace(/\/$/, '') + '/send';
  return {
    async send(phone: string, message: string): Promise<SendResult> {
      const to = phone.startsWith('+') ? phone : '+' + phone.replace(/\D/g, '');
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to, message }),
        });
        const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
        if (!res.ok) {
          return { success: false, error: data.error ?? `HTTP ${res.status}` };
        }
        if (data.success === false) return { success: false, error: data.error ?? 'Send failed' };
        return { success: true };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
  };
}

// --- Resolve provider (priority: UltraMsg > Whapi > WhatsApp Web microservice) ---

let cachedProvider: WhatsAppProvider | null | undefined = undefined;

export function getWhatsAppProvider(): WhatsAppProvider | null {
  if (cachedProvider !== undefined) return cachedProvider;
  cachedProvider =
    createUltraMsgProvider() ??
    createWhapiProvider() ??
    createWhatsAppWebMicroserviceProvider() ??
    null;
  return cachedProvider;
}

/**
 * Send WhatsApp notification for an order status change.
 * Logs result and returns the log entry to persist on the order.
 */
export async function sendWhatsAppNotification(
  order: OrderForNotification,
  _tenant: TenantForNotification,
  status: string
): Promise<WhatsAppNotificationLog> {
  const at = new Date().toISOString();
  if (!shouldNotify(status)) {
    return { status: 'sent', at, orderStatus: status }; // no-op, no log needed
  }
  const message = getMessageTemplate(status, order);
  if (!message) {
    return { status: 'failed', at, orderStatus: status, error: 'Unknown status' };
  }
  const phone = normalizePhone(order.customerPhone);
  if (!phone) {
    return { status: 'failed', at, orderStatus: status, error: 'No customer phone' };
  }
  const provider = getWhatsAppProvider();
  if (!provider) {
    return { status: 'failed', at, orderStatus: status, error: 'WhatsApp provider not configured' };
  }
  const result = await provider.send(phone, message);
  if (result.success) {
    return { status: 'sent', at, orderStatus: status };
  }
  return { status: 'failed', at, orderStatus: status, error: result.error };
}
