import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MockApiClient } from '@nmd/mock';
import { AnimatePresence } from 'framer-motion';
import { getTrackingOrderId, clearTrackingOrderId, isOrderActive, TRACKING_ORDER_EVENT } from '../lib/order-tracking-storage';
import { OrderTrackingFloating } from './OrderTrackingFloating';
import { OrderTrackingSheet, type PublicOrderForTracking } from './OrderTrackingSheet';

const api = new MockApiClient();
const POLL_INTERVAL_MS = 3000;
const DELIVERED_GRACE_MS = 5000;

const TERMINAL_SUCCESS_STATUSES = ['DELIVERED', 'COMPLETED'];

export function OrderTrackingWidget() {
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(() => getTrackingOrderId());
  const [sheetOpen, setSheetOpen] = useState(false);
  const graceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: order } = useQuery({
    queryKey: ['public-order', trackingOrderId],
    queryFn: async () => {
      const o = await api.getPublicOrder(trackingOrderId!);
      return o as PublicOrderForTracking | null;
    },
    enabled: !!trackingOrderId,
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: 2000,
  });

  // When order becomes DELIVERED/COMPLETED: show success for 5s then clear and unmount
  useEffect(() => {
    if (!order || !trackingOrderId) return;
    const status = order.status;
    if (!TERMINAL_SUCCESS_STATUSES.includes(status ?? '')) return;

    if (graceTimeoutRef.current) return; // already scheduled
    graceTimeoutRef.current = setTimeout(() => {
      graceTimeoutRef.current = null;
      clearTrackingOrderId();
      setTrackingOrderId(null);
    }, DELIVERED_GRACE_MS);

    return () => {
      if (graceTimeoutRef.current) {
        clearTimeout(graceTimeoutRef.current);
        graceTimeoutRef.current = null;
      }
    };
  }, [order?.status, trackingOrderId]);

  // Immediate clear for terminal statuses that are not success (e.g. CANCELED)
  useEffect(() => {
    if (!order || !trackingOrderId) return;
    if (isOrderActive(order.status)) return;
    if (TERMINAL_SUCCESS_STATUSES.includes(order.status ?? '')) return; // 5s grace above
    clearTrackingOrderId();
    setTrackingOrderId(null);
  }, [order?.status, trackingOrderId]);

  // Sync when tracking order is set (e.g. after redirect from checkout success)
  useEffect(() => {
    const handler = (e: Event) => setTrackingOrderId((e as CustomEvent<string>).detail);
    window.addEventListener(TRACKING_ORDER_EVENT, handler);
    return () => window.removeEventListener(TRACKING_ORDER_EVENT, handler);
  }, []);

  const isTerminalSuccess = order && TERMINAL_SUCCESS_STATUSES.includes(order.status ?? '');
  const showFloating =
    !!trackingOrderId &&
    !!order &&
    (isOrderActive(order.status) || isTerminalSuccess);

  return (
    <>
      <AnimatePresence>
        {showFloating && (
          <OrderTrackingFloating
            order={order as PublicOrderForTracking}
            onClick={() => setSheetOpen(true)}
          />
        )}
      </AnimatePresence>
      <OrderTrackingSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        order={order as PublicOrderForTracking | null}
      />
    </>
  );
}
