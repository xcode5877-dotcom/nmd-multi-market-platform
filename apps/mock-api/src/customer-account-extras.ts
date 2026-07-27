import { randomUUID } from 'node:crypto';

import type {
  Customer,
  CustomerAccountExtras,
  CustomerAddressRecord,
  CustomerNotificationPrefs,
  CustomerSavedCardRecord,
} from './store.js';

export function defaultAccountExtras(): CustomerAccountExtras {
  return {
    addresses: [],
    paymentMethods: [],
    notifications: { orderUpdates: true, promotions: true, news: true },
  };
}

export function parseAccountExtras(c: Customer | undefined): CustomerAccountExtras {
  const raw = c?.accountExtras;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Partial<CustomerAccountExtras>;
    const def = defaultAccountExtras();
    const n = o.notifications;
    return {
      addresses: Array.isArray(o.addresses)
        ? o.addresses.filter((a): a is CustomerAddressRecord => !!a && typeof (a as CustomerAddressRecord).id === 'string')
        : def.addresses,
      paymentMethods: Array.isArray(o.paymentMethods)
        ? o.paymentMethods.filter((p): p is CustomerSavedCardRecord => !!p && typeof (p as CustomerSavedCardRecord).id === 'string')
        : def.paymentMethods,
      notifications: {
        orderUpdates: typeof n?.orderUpdates === 'boolean' ? n.orderUpdates : def.notifications.orderUpdates,
        promotions: typeof n?.promotions === 'boolean' ? n.promotions : def.notifications.promotions,
        news: typeof n?.news === 'boolean' ? n.news : def.notifications.news,
      },
      defaultDeliveryTown:
        typeof o.defaultDeliveryTown === 'string' && o.defaultDeliveryTown.trim()
          ? o.defaultDeliveryTown.trim()
          : undefined,
    };
  }
  return defaultAccountExtras();
}

export function mergeExtrasIntoCustomer(c: Customer, extras: CustomerAccountExtras): Customer {
  return { ...c, accountExtras: extras };
}

/** Luhn validation for card PAN (digits only). */
export function luhnValid(pan: string): boolean {
  const digits = pan.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i]!, 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export function inferCardBrand(digits: string): string {
  const d = digits.replace(/\D/g, '');
  if (d.startsWith('4')) return 'Visa';
  if (/^5[1-5]/.test(d)) return 'Mastercard';
  if (/^3[47]/.test(d)) return 'Amex';
  if (/^6(?:011|5)/.test(d)) return 'Discover';
  return 'Card';
}

export function newAddressId(): string {
  return randomUUID();
}

export function newCardId(): string {
  return randomUUID();
}

export function normalizeNotificationPatch(
  prev: CustomerNotificationPrefs,
  body: Partial<Record<keyof CustomerNotificationPrefs, unknown>>,
): CustomerNotificationPrefs {
  return {
    orderUpdates:
      typeof body.orderUpdates === 'boolean' ? body.orderUpdates : prev.orderUpdates,
    promotions: typeof body.promotions === 'boolean' ? body.promotions : prev.promotions,
    news: typeof body.news === 'boolean' ? body.news : prev.news,
  };
}
