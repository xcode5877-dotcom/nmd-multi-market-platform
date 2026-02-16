import { useEffect, useRef } from 'react';
import { getToken, getApiBaseUrl } from '../api';

export type CourierEvent =
  | { type: 'connected'; courierId: string }
  | { type: 'order_assigned'; orderId?: string; tenantId?: string }
  | { type: 'order_unassigned'; orderId?: string };

/** Single EventSource per mount. Empty deps prevent duplicate connections. Callback via ref avoids rerender loops. */
export function useCourierEvents(onEvent: (event: CourierEvent) => void) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const baseUrl = getApiBaseUrl();
    const token = getToken();
    if (!baseUrl || !token) return;
    const url = `${baseUrl}/courier/events?token=${encodeURIComponent(token)}`;
    const eventSource = new EventSource(url);
    eventSource.onmessage = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as CourierEvent;
        onEventRef.current(data);
      } catch {
        // ignore
      }
    };
    eventSource.onerror = () => eventSource.close();
    return () => eventSource.close();
  }, []);
}
