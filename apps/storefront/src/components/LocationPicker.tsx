import { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER: [number, number] = [32.08, 34.78];

const GEOLOCATION_TIMEOUT_MS = 8000;

/** High accuracy first (iOS/Safari); fallback uses low accuracy if this fails or times out. */
const HIGH_ACCURACY_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: GEOLOCATION_TIMEOUT_MS,
  maximumAge: 0,
};

const LOW_ACCURACY_FALLBACK_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: GEOLOCATION_TIMEOUT_MS,
  maximumAge: 0,
};

const PERMISSION_DENIED_CODE = 1;

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

const createIcon = () =>
  L.divIcon({
    className: 'location-pin',
    html: `<div style="
      width: 28px; height: 28px;
      background: var(--color-primary, #00A0A0);
      border: 3px solid white;
      border-radius: 50% 50% 0 50%;
      transform: rotate(-45deg);
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });

export interface LocationPickerProps {
  value: { lat: number; lng: number } | null;
  onChange: (lat: number, lng: number) => void;
  /** Called only when user clicks "حدد موقعي الحالي" and GPS succeeds. Parent can run reverse geocode and set address. */
  onDetectSuccess?: (lat: number, lng: number) => void;
  disabled?: boolean;
  className?: string;
}

function DraggableMarker({
  position,
  onMove,
}: {
  position: [number, number];
  onMove: (lat: number, lng: number) => void;
}) {
  const [pos, setPos] = useState(position);

  useEffect(() => {
    setPos(position);
  }, [position[0], position[1]]);

  const handleDragEnd = useCallback(
    (e: L.LeafletEvent) => {
      const m = e.target as L.Marker;
      const latlng = m.getLatLng();
      setPos([latlng.lat, latlng.lng]);
      onMove(latlng.lat, latlng.lng);
    },
    [onMove]
  );

  return (
    <Marker
      position={pos}
      icon={createIcon()}
      draggable
      eventHandlers={{ dragend: handleDragEnd }}
    />
  );
}

export function LocationPicker({ value, onChange, onDetectSuccess, disabled, className = '' }: LocationPickerProps) {
  const stableValue = useStableCoords(value);
  const [center, setCenter] = useState<[number, number]>(() =>
    stableValue ? [stableValue[0], stableValue[1]] : DEFAULT_CENTER
  );
  const [position, setPosition] = useState<[number, number]>(() =>
    stableValue ? [stableValue[0], stableValue[1]] : DEFAULT_CENTER
  );
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSafariSteps, setShowSafariSteps] = useState(false);

  useEffect(() => {
    if (stableValue) {
      setPosition([stableValue[0], stableValue[1]]);
      setCenter([stableValue[0], stableValue[1]]);
    }
  }, [stableValue?.[0], stableValue?.[1]]);

  const handleDetect = useCallback(() => {
    if (!navigator.geolocation) {
      setError('المتصفح لا يدعم الموقع');
      return;
    }
    setDetecting(true);
    setError(null);
    setShowSafariSteps(false);

    const onSuccess = (pos: GeolocationPosition) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setPosition([lat, lng]);
      setCenter([lat, lng]);
      onChange(lat, lng);
      onDetectSuccess?.(lat, lng);
      setDetecting(false);
    };

    const onError = (err: GeolocationPositionError, triedFallback: boolean) => {
      if (err.code === PERMISSION_DENIED_CODE) {
        setDetecting(false);
        setError('تم رفض الوصول للموقع');
        setShowSafariSteps(true);
        return;
      }
      if (!triedFallback) {
        navigator.geolocation.getCurrentPosition(onSuccess, (fallbackErr) => onError(fallbackErr, true), LOW_ACCURACY_FALLBACK_OPTIONS);
        return;
      }
      setError('تعذر تحديد الموقع. تحقق من إعدادات الموقع.');
      setDetecting(false);
    };

    navigator.geolocation.getCurrentPosition(
      onSuccess,
      (err) => onError(err, false),
      HIGH_ACCURACY_OPTIONS
    );
  }, [onChange, onDetectSuccess]);

  const handleMove = useCallback(
    (lat: number, lng: number) => {
      setPosition([lat, lng]);
      onChange(lat, lng);
    },
    [onChange]
  );

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-sm font-medium text-gray-700">موقع التوصيل — حدد موقعك أو اسحب الدبوس لضبطه</span>
        <button
          type="button"
          onClick={handleDetect}
          disabled={disabled || detecting}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {detecting ? 'جاري تحديد الموقع...' : 'حدد موقعي الحالي'}
        </button>
      </div>
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2" role="alert">
          {error}
        </p>
      )}
      {showSafariSteps && (
        <div className="text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-3 space-y-2" role="dialog" aria-label="خطوات تفعيل الموقع في Safari">
          <p className="font-medium text-amber-900">لتفعيل الموقع في Safari:</p>
          <ol className="list-decimal list-inside text-amber-800 space-y-1">
            <li>اضغط <strong>AA</strong> في الرابط (شريط العنوان)</li>
            <li>اختر <strong>إعدادات الموقع</strong></li>
            <li>اختر <strong>سماح</strong></li>
          </ol>
          <button
            type="button"
            onClick={() => setShowSafariSteps(false)}
            className="text-amber-700 underline text-xs"
          >
            إغلاق
          </button>
        </div>
      )}
      <div className="h-56 rounded-xl overflow-hidden border border-gray-200 bg-gray-100 [&_.location-pin]:bg-transparent [&_.location-pin]:border-0">
        <MapContainer
          center={center}
          zoom={14}
          className="h-full w-full"
          style={{ background: '#e5e7eb' }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <DraggableMarker position={position} onMove={handleMove} />
          <MapCenterUpdater center={center} />
        </MapContainer>
      </div>
      <p className="text-xs text-gray-500">
        الإحداثيات: {position[0].toFixed(5)}, {position[1].toFixed(5)}
      </p>
    </div>
  );
}

function MapCenterUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [map, center[0], center[1]]);
  return null;
}
