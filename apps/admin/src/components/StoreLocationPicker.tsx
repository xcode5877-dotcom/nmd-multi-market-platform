import { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { Crosshair, Map, Satellite, Target } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER: [number, number] = [32.08, 34.78];

/** iOS-friendly options: high accuracy, enough time for GPS to wake, no cache (triggers permission popup). */
const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
};
const LOCATION_ERROR_MESSAGE = 'يرجى تفعيل خدمات الموقع من إعدادات Safari للاستمرار';

const COORD_THRESHOLD = 0.0001;
function useStableCoords(loc: { lat: number; lng: number } | null): [number, number] | null {
  const [stable, setStable] = useState<[number, number] | null>(() => (loc ? [loc.lat, loc.lng] : null));
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

export interface StoreLocationPickerProps {
  value: { lat: number; lng: number } | null;
  onChange: (lat: number, lng: number) => void;
  className?: string;
}

const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const SATELLITE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

/** Syncs map view when we set center programmatically (initial load from value). */
function MapCenterSync({ center, skip }: { center: [number, number]; skip: boolean }) {
  const map = useMap();
  const prev = useRef<[number, number] | null>(null);
  useEffect(() => {
    if (skip) return;
    if (prev.current && prev.current[0] === center[0] && prev.current[1] === center[1]) return;
    prev.current = center;
    map.setView(center, map.getZoom());
  }, [map, center[0], center[1], skip]);
  return null;
}

/** Flies map to given center (e.g. after "Detect my location"); center pin ends up there. */
function FlyToCenter({ center, when }: { center: [number, number] | null; when: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!when || !center) return;
    map.flyTo(center, map.getZoom(), { duration: 0.6 });
  }, [map, when, center?.[0], center?.[1]]);
  return null;
}

/** Listens to move/moveend and reports center; drives pin "active" state. */
function MapCenterListener({
  onMoveStart,
  onMoveEnd,
}: {
  onMoveStart: () => void;
  onMoveEnd: (lat: number, lng: number) => void;
}) {
  const map = useMapEvents({
    movestart: () => onMoveStart(),
    moveend: () => {
      const c = map.getCenter();
      onMoveEnd(c.lat, c.lng);
    },
  });
  return null;
}

export function StoreLocationPicker({ value, onChange, className = '' }: StoreLocationPickerProps) {
  const stableValue = useStableCoords(value);
  const [center, setCenter] = useState<[number, number]>(() =>
    stableValue ? [stableValue[0], stableValue[1]] : DEFAULT_CENTER
  );
  const [displayCoords, setDisplayCoords] = useState<[number, number]>(() =>
    stableValue ? [stableValue[0], stableValue[1]] : DEFAULT_CENTER
  );
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [satellite, setSatellite] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [flyToTarget, setFlyToTarget] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (stableValue) {
      setCenter([stableValue[0], stableValue[1]]);
      setDisplayCoords([stableValue[0], stableValue[1]]);
    }
  }, [stableValue?.[0], stableValue?.[1]]);

  const handleMoveEnd = useCallback(
    (lat: number, lng: number) => {
      setIsMoving(false);
      setDisplayCoords([lat, lng]);
      onChange(lat, lng);
    },
    [onChange]
  );

  // Clear flyToTarget after animation so we don't re-fly on re-renders
  useEffect(() => {
    if (!flyToTarget) return;
    const t = setTimeout(() => setFlyToTarget(null), 800);
    return () => clearTimeout(t);
  }, [flyToTarget]);

  const handleMoveStart = useCallback(() => {
    setIsMoving(true);
  }, []);

  const handleDetect = useCallback(() => {
    if (!navigator.geolocation) {
      setError('المتصفح لا يدعم الموقع');
      return;
    }
    setDetecting(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCenter([lat, lng]);
        setDisplayCoords([lat, lng]);
        setFlyToTarget([lat, lng]);
        onChange(lat, lng);
        setDetecting(false);
      },
      () => {
        setError(LOCATION_ERROR_MESSAGE);
        setDetecting(false);
        console.error('[StoreLocationPicker]', LOCATION_ERROR_MESSAGE);
      },
      GEOLOCATION_OPTIONS
    );
  }, [onChange]);

  const zoom = 14;

  return (
    <div className={`space-y-2 ${className}`}>
      <style>{`
        .store-center-pin {
          pointer-events: none;
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          z-index: 1000;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .store-center-pin .pin-dot {
          width: 32px; height: 32px;
          background: #dc2626;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          transition: transform 0.15s ease-out, box-shadow 0.15s ease-out;
        }
        .store-center-pin.store-center-pin-active .pin-dot {
          animation: store-pin-float 0.6s ease-in-out infinite;
        }
        @keyframes store-pin-float {
          0%, 100% { transform: translateY(0) scale(1); box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
          50% { transform: translateY(-4px) scale(1.06); box-shadow: 0 0 0 10px rgba(220,38,38,0.2); }
        }
        .store-center-crosshair {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 48px;
          height: 48px;
          pointer-events: none;
          z-index: 999;
          color: rgba(0,0,0,0.35);
          stroke-width: 2;
        }
      `}</style>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-gray-600">
          حرّك الخريطة بحيث يكون الدبوس الأحمر في منتصف الشاشة عند مدخل المحل. الزر أدناه يحدد موقعك الحالي.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSatellite((s) => !s)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-sm font-medium ${
              satellite ? 'bg-gray-800 text-white border-gray-700' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
            title={satellite ? 'عرض الخريطة العادية' : 'عرض القمر الصناعي'}
          >
            {satellite ? <Map className="w-4 h-4" /> : <Satellite className="w-4 h-4" />}
            {satellite ? 'خريطة' : 'قمر صناعي'}
          </button>
          <button
            type="button"
            onClick={handleDetect}
            disabled={detecting}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            <Crosshair className="w-4 h-4 shrink-0" />
            {detecting ? 'جاري التحقق...' : 'تحديد موقع المتجر الحالي'}
          </button>
        </div>
      </div>
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2" role="alert">
          {error}
        </p>
      )}
      <div className="relative h-64 rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
        {/* Crosshair in center (subtle target) */}
        <div className="store-center-crosshair" aria-hidden>
          <Target className="w-full h-full" strokeWidth={2} />
        </div>
        <MapContainer
          center={center}
          zoom={zoom}
          className="h-full w-full"
          style={{ background: '#e5e7eb' }}
          scrollWheelZoom
        >
          <TileLayer
            attribution={satellite ? '&copy; Esri' : '&copy; OpenStreetMap'}
            url={satellite ? SATELLITE_URL : OSM_URL}
          />
          <MapCenterSync center={center} skip={!!flyToTarget} />
          <FlyToCenter center={flyToTarget} when={!!flyToTarget} />
          <MapCenterListener onMoveStart={handleMoveStart} onMoveEnd={handleMoveEnd} />
        </MapContainer>
        {/* Fixed center pin overlay */}
        <div className={`store-center-pin ${isMoving ? 'store-center-pin-active' : ''}`}>
          <div className="pin-dot" />
        </div>
      </div>
      <p className="text-xs text-gray-500">
        إحداثيات الهدف (منتصف الشاشة): {displayCoords[0].toFixed(5)}, {displayCoords[1].toFixed(5)}
        {isMoving && <span className="text-primary font-medium"> — حرك الخريطة ثم أفلت لتحديث الإحداثيات</span>}
      </p>
    </div>
  );
}
