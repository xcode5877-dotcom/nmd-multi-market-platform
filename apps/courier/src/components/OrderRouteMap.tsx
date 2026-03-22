import { useMemo, useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ChevronDown, ChevronUp } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

/** Only update map when coords change beyond this (≈10m) to avoid GPS jitter. */
const COORD_THRESHOLD = 0.0001;

function useStableCoords(
  loc: { lat: number; lng: number } | null | undefined
): [number, number] | null {
  const [stable, setStable] = useState<[number, number] | null>(() =>
    loc ? [loc.lat, loc.lng] : null
  );
  useEffect(() => {
    if (!loc) {
      setStable(null);
      return;
    }
    setStable((prev) => {
      if (!prev) return [loc.lat, loc.lng];
      const dLat = Math.abs(loc.lat - prev[0]);
      const dLng = Math.abs(loc.lng - prev[1]);
      if (dLat >= COORD_THRESHOLD || dLng >= COORD_THRESHOLD) return [loc.lat, loc.lng];
      return prev;
    });
  }, [loc?.lat, loc?.lng]);
  return stable;
}

const storeIcon = L.divIcon({
  className: 'store-marker',
  html: `<div style="
    width: 24px; height: 24px;
    background: #dc2626;
    border: 2px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
});

const customerIcon = L.divIcon({
  className: 'customer-marker',
  html: `<div style="
    width: 24px; height: 24px;
    background: #16a34a;
    border: 2px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
});

function FitBounds({ store, customer }: { store?: [number, number] | null; customer?: [number, number] | null }) {
  const map = useMap();
  const positions = useMemo(() => {
    const out: [number, number][] = [];
    if (store) out.push(store);
    if (customer) out.push(customer);
    return out;
  }, [store, customer]);

  useEffect(() => {
    if (positions.length < 2) return;
    map.fitBounds(positions as [number, number][], { padding: [24, 24], maxZoom: 15 });
  }, [map, positions]);

  return null;
}

export interface OrderRouteMapProps {
  storeLocation: { lat: number; lng: number } | null | undefined;
  customerLocation: { lat: number; lng: number } | null | undefined;
  /** When true, show mini preview; tap to expand full map. */
  collapsible?: boolean;
  className?: string;
}

const DEFAULT_CENTER: [number, number] = [32.08, 34.78];

export function OrderRouteMap({ storeLocation, customerLocation, collapsible = false, className = '' }: OrderRouteMapProps) {
  const storeStable = useStableCoords(storeLocation);
  const customerStable = useStableCoords(customerLocation);
  const store = storeStable ? ([storeStable[0], storeStable[1]] as [number, number]) : null;
  const customer = customerStable ? ([customerStable[0], customerStable[1]] as [number, number]) : null;
  const hasAny = !!store || !!customer;
  const hasBoth = !!store && !!customer;
  const center: [number, number] = store ?? customer ?? DEFAULT_CENTER;

  const [expanded, setExpanded] = useState(false);

  if (!hasAny) {
    return (
      <div className={`h-48 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center text-sm text-gray-500 ${className}`}>
        لا يوجد موقع محدد — استخدم رابط الخرائط
      </div>
    );
  }

  const mapContent = (
    <MapContainer
      center={center}
      zoom={13}
      className="h-full w-full"
      style={{ background: '#e5e7eb' }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {store && <Marker position={store} icon={storeIcon} />}
      {customer && <Marker position={customer} icon={customerIcon} />}
      {hasBoth && (
        <Polyline
          positions={[store, customer]}
          pathOptions={{ color: '#0d9488', weight: 4, opacity: 0.8 }}
        />
      )}
      <FitBounds store={store} customer={customer} />
    </MapContainer>
  );

  if (collapsible) {
    const isExpanded = expanded;
    const previewHeight = '72px';
    const fullHeight = '240px';
    return (
      <div className={`rounded-xl overflow-hidden border border-gray-200 bg-gray-100 [&_.store-marker]:bg-transparent [&_.store-marker]:border-0 [&_.customer-marker]:bg-transparent [&_.customer-marker]:border-0 ${className}`}>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-white/80 hover:bg-white border-b border-gray-100 text-sm font-medium text-gray-700"
          aria-expanded={isExpanded}
        >
          <span>خريطة المسار</span>
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
        <div
          className="relative overflow-hidden transition-[height] duration-300 ease-out"
          style={{ height: isExpanded ? fullHeight : previewHeight }}
        >
          <div className="absolute inset-0">
            {mapContent}
          </div>
          {!isExpanded && (
            <div
              className="absolute inset-0 flex items-center justify-center bg-black/20"
              aria-hidden
            >
              <span className="text-xs font-medium text-white drop-shadow-md">اضغط للتوسيع</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`h-48 rounded-xl overflow-hidden border border-gray-200 bg-gray-100 [&_.store-marker]:bg-transparent [&_.store-marker]:border-0 [&_.customer-marker]:bg-transparent [&_.customer-marker]:border-0 ${className}`}>
      {mapContent}
    </div>
  );
}
