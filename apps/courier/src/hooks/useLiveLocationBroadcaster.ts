import { useEffect, useRef } from 'react';
import { apiFetch } from '../api';

const BROADCAST_INTERVAL_MS = 8000;
const MOVEMENT_THRESHOLD_METERS = 5;

/** Haversine distance in meters between two lat/lng points. */
function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface UseLiveLocationBroadcasterOptions {
  /** Order IDs en route (deliveryStatus IN_PROGRESS or legacy PICKED_UP). */
  orderIds: string[];
  /** When false, no broadcasting. */
  enabled: boolean;
}

/**
 * Every 8 seconds, if the courier has moved at least 5 meters from the last sent position,
 * sends current lat/lng to each order's courierLocation via PATCH /courier/orders/:orderId/location.
 * Saves battery by skipping updates when stationary.
 */
export function useLiveLocationBroadcaster({
  orderIds,
  enabled,
}: UseLiveLocationBroadcasterOptions): void {
  const lastSentRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!enabled || orderIds.length === 0) return;

    const tick = () => {
      if (orderIds.length === 0) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const last = lastSentRef.current;
          const shouldSend =
            last == null ||
            distanceMeters(lat, lng, last.lat, last.lng) >= MOVEMENT_THRESHOLD_METERS;

          if (!shouldSend) return;

          lastSentRef.current = { lat, lng };
          orderIds.forEach((orderId) => {
            apiFetch(`/courier/orders/${orderId}/location`, {
              method: 'PATCH',
              body: { lat, lng },
            }).catch(() => {
              // Ignore per-order errors; next tick will retry
            });
          });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    };

    tick();
    const interval = setInterval(tick, BROADCAST_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [enabled, orderIds.join(',')]);
}
