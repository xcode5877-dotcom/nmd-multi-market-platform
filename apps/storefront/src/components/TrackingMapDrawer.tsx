import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, ChevronUp, ChevronDown } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

const COORD_THRESHOLD = 0.0001;
const GLIDE_DURATION_MS = 1000;

function useStableCoords(loc: { lat: number; lng: number } | null | undefined): [number, number] | null {
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
      if (Math.abs(loc.lat - prev[0]) >= COORD_THRESHOLD || Math.abs(loc.lng - prev[1]) >= COORD_THRESHOLD)
        return [loc.lat, loc.lng];
      return prev;
    });
  }, [loc?.lat, loc?.lng]);
  return stable;
}

/** Haversine distance in km. */
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
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

/** Rough ETA minutes: distance km / (25 km/h) = * 60 min/h => distance * 2.4. Min 1, round. */
function etaMinutes(courier: { lat: number; lng: number }, delivery: { lat: number; lng: number }): number {
  const km = distanceKm(courier.lat, courier.lng, delivery.lat, delivery.lng);
  const min = km * (60 / 25);
  return Math.max(1, Math.round(min));
}

const deliveryIcon = L.divIcon({
  className: 'tracking-delivery-pin',
  html: `<div style="
    width: 28px; height: 28px;
    background: var(--color-primary, #00A0A0);
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  "></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

const scooterIcon = L.divIcon({
  className: 'tracking-courier-scooter',
  html: `<div style="
    width: 36px; height: 36px;
    display: flex; align-items: center; justify-content: center;
    background: #059669;
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    font-size: 18px; line-height: 1;
    transition: transform 1000ms ease-out;
  " title="السائق">🛵</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
});

function MapViewUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 15);
  }, [map, center[0], center[1]]);
  return null;
}

export interface TrackingMapDrawerProps {
  deliveryLocation: { lat: number; lng: number } | null | undefined;
  courierLocation?: { lat: number; lng: number } | null;
  isLive?: boolean;
  className?: string;
}

export function TrackingMapDrawer({
  deliveryLocation,
  courierLocation,
  isLive = false,
  className = '',
}: TrackingMapDrawerProps) {
  const stable = useStableCoords(deliveryLocation);
  const [expanded, setExpanded] = useState(false);
  const [displayCourier, setDisplayCourier] = useState<[number, number] | null>(
    courierLocation ? [courierLocation.lat, courierLocation.lng] : null
  );
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!courierLocation) {
      setDisplayCourier(null);
      return;
    }
    const target: [number, number] = [courierLocation.lat, courierLocation.lng];
    if (animRef.current) clearInterval(animRef.current);
    setDisplayCourier((prev) => {
      if (!prev) return target;
      const startLat = prev[0];
      const startLng = prev[1];
      const start = performance.now();
      animRef.current = setInterval(() => {
        const elapsed = performance.now() - start;
        const progress = Math.min(1, elapsed / GLIDE_DURATION_MS);
        const ease = 1 - (1 - progress) * (1 - progress);
        setDisplayCourier([
          startLat + (target[0] - startLat) * ease,
          startLng + (target[1] - startLng) * ease,
        ]);
        if (progress >= 1 && animRef.current) {
          clearInterval(animRef.current);
          animRef.current = null;
        }
      }, 50);
      return prev;
    });
    return () => {
      if (animRef.current) clearInterval(animRef.current);
    };
  }, [courierLocation?.lat, courierLocation?.lng]);

  const center: [number, number] = stable ?? [32.08, 34.78];
  const hasLocation = !!stable;
  const eta =
    stable && courierLocation
      ? etaMinutes(courierLocation, { lat: stable[0], lng: stable[1] })
      : null;

  if (!hasLocation) return null;

  return (
    <div className={`rounded-2xl overflow-hidden border border-white/30 ${className}`}>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-white/40 backdrop-blur-xl hover:bg-white/60 transition-colors text-right"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-gray-800">
          <MapPin className="w-4 h-4 text-primary" />
          عرض الخريطة
          {isLive && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 text-xs font-medium">
              <span
                className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"
                aria-hidden
              />
              Live
            </span>
          )}
        </span>
        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
      </button>
      {expanded && (
        <div
          className="relative h-52 bg-white/20 backdrop-blur-md [&_.tracking-delivery-pin]:bg-transparent [&_.tracking-delivery-pin]:border-0 [&_.tracking-courier-scooter]:bg-transparent [&_.tracking-courier-scooter]:border-0"
          style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.3)' }}
        >
          {eta != null && (
            <div className="absolute top-2 left-2 right-2 z-[1000] flex justify-center">
              <span className="px-3 py-1.5 rounded-lg bg-white/95 backdrop-blur text-sm font-medium text-gray-800 shadow-md" dir="rtl">
                يصل خلال {eta} دقائق
              </span>
            </div>
          )}
          <MapContainer
            center={center}
            zoom={15}
            className="h-full w-full rounded-b-2xl"
            style={{ background: 'rgba(255,255,255,0.15)' }}
            zoomControl={false}
            scrollWheelZoom
          >
            <TileLayer
              attribution=""
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={center} icon={deliveryIcon} />
            {displayCourier && (
              <Marker
                position={displayCourier}
                icon={scooterIcon}
              />
            )}
            <MapViewUpdater center={center} />
          </MapContainer>
        </div>
      )}
    </div>
  );
}
