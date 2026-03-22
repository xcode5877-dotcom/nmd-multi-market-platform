/**
 * Reverse geocoding via OpenStreetMap Nominatim (no API key).
 * Use a descriptive User-Agent per Nominatim usage policy.
 */
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';
const USER_AGENT = 'NMD-Storefront/1.0 (Delivery address)';

export const FALLBACK_ADDRESS = 'موقعي الحالي (محدد بالدبوس)';

export interface LastDeliveryLocation {
  lat: number;
  lng: number;
  address: string;
  zoneId?: string;
}

const STORAGE_KEY_PREFIX = 'nmd_last_delivery_';

export function getLastDeliveryKey(tenantId: string): string {
  return `${STORAGE_KEY_PREFIX}${tenantId}`;
}

export function getLastDelivery(tenantId: string): LastDeliveryLocation | null {
  try {
    const raw = localStorage.getItem(getLastDeliveryKey(tenantId));
    if (!raw) return null;
    const data = JSON.parse(raw) as unknown;
    if (data && typeof data === 'object' && typeof (data as { lat?: number }).lat === 'number' && typeof (data as { lng?: number }).lng === 'number') {
      return {
        lat: (data as { lat: number }).lat,
        lng: (data as { lng: number }).lng,
        address: typeof (data as { address?: string }).address === 'string' ? (data as { address: string }).address : FALLBACK_ADDRESS,
        zoneId: typeof (data as { zoneId?: string }).zoneId === 'string' ? (data as { zoneId: string }).zoneId : undefined,
      };
    }
  } catch {
    // ignore
  }
  return null;
}

export function saveLastDelivery(tenantId: string, data: LastDeliveryLocation): void {
  try {
    localStorage.setItem(getLastDeliveryKey(tenantId), JSON.stringify(data));
  } catch {
    // ignore
  }
}

/** Result of reverse geocode including display address and city/town for zone matching. */
export interface ReverseGeocodeResult {
  address: string;
  city?: string;
}

/**
 * Reverse geocode lat,lng and return display address plus city/town name (from Nominatim/Google-style address object).
 * Use city for delivery zone matching. Returns FALLBACK_ADDRESS for address on failure.
 */
export async function reverseGeocodeWithPlace(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: 'json',
    });
    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'ar,en',
        'User-Agent': USER_AGENT,
      },
    });
    if (!res.ok) return { address: FALLBACK_ADDRESS };
    const data = (await res.json()) as { display_name?: string; address?: Record<string, string> };
    const addr = data?.address && typeof data.address === 'object' ? data.address : {};
    const displayName = data?.display_name ?? [addr.road, addr.suburb, addr.city, addr.country].filter(Boolean).join('، ');
    const address = (displayName && String(displayName).trim()) ? String(displayName).trim() : FALLBACK_ADDRESS;
    const city = [addr.city, addr.town, addr.village, addr.municipality].find((v) => v && String(v).trim());
    const cityTrimmed = city ? String(city).trim() : undefined;
    return { address, city: cityTrimmed };
  } catch {
    return { address: FALLBACK_ADDRESS };
  }
}

/**
 * Reverse geocode lat,lng to a display address (street name, area, etc.).
 * Returns FALLBACK_ADDRESS on failure or if no result.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const result = await reverseGeocodeWithPlace(lat, lng);
  return result.address;
}
