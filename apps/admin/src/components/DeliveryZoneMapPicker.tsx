import { useState, useCallback } from 'react';
import { MapContainer, TileLayer, Circle, useMapEvents } from 'react-leaflet';
import type { DeliveryZone } from '@nmd/core';
import 'leaflet/dist/leaflet.css';

/** Fallback when center is null so the radius map always renders (e.g. iOS/Safari). */
const DEFAULT_CENTER: [number, number] = [32.70, 35.37];
const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

export interface DeliveryZoneMapPickerProps {
  /** Current center for the zone being edited (or new zone). */
  center: { lat: number; lng: number } | null;
  /** Current radius in km. */
  radiusKm: number;
  onCenterChange: (lat: number, lng: number) => void;
  onRadiusChange: (km: number) => void;
  /** All zones to show as translucent circles (excluding the one being edited if needed). */
  allZones: DeliveryZone[];
  /** Id of zone being edited so we can highlight or exclude from "other" circles. */
  editingZoneId?: string | null;
  className?: string;
}

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

const ZONE_COLORS = ['#00A0A0', '#059669', '#2563eb', '#7c3aed', '#dc2626', '#ea580c'];

export function DeliveryZoneMapPicker({
  center,
  radiusKm,
  onCenterChange,
  onRadiusChange,
  allZones,
  editingZoneId,
  className = '',
}: DeliveryZoneMapPickerProps) {
  const [mapCenter, setMapCenter] = useState<[number, number]>(() =>
    center ? [center.lat, center.lng] : DEFAULT_CENTER
  );

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      onCenterChange(lat, lng);
      setMapCenter([lat, lng]);
    },
    [onCenterChange]
  );

  const zonesWithGeo = allZones.filter(
    (z) =>
      z.id !== editingZoneId &&
      typeof (z as DeliveryZone & { centerLat?: number }).centerLat === 'number' &&
      typeof (z as DeliveryZone & { centerLng?: number }).centerLng === 'number' &&
      typeof (z as DeliveryZone & { radiusKm?: number }).radiusKm === 'number'
  );

  return (
    <div className={`space-y-3 ${className}`}>
      <p className="text-sm text-gray-600">
        انقر على الخريطة لتحديد مركز الدائرة، ثم حرّك الشريط لتحديد نصف القطر (كم).
      </p>
      <div className="relative h-56 rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
        <MapContainer
          center={mapCenter}
          zoom={13}
          className="h-full w-full"
          style={{ background: '#e5e7eb' }}
          scrollWheelZoom
        >
          <TileLayer attribution="" url={OSM_URL} />
          <MapClickHandler onMapClick={handleMapClick} />
          {zonesWithGeo.map((z, i) => {
            const lat = (z as DeliveryZone & { centerLat: number }).centerLat;
            const lng = (z as DeliveryZone & { centerLng: number }).centerLng;
            const r = (z as DeliveryZone & { radiusKm: number }).radiusKm ?? 2;
            const isEditing = z.id === editingZoneId;
            const color = isEditing ? '#dc2626' : ZONE_COLORS[i % ZONE_COLORS.length];
            return (
              <Circle
                key={z.id}
                center={[lat, lng]}
                radius={r * 1000}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: isEditing ? 0.35 : 0.2,
                  weight: isEditing ? 3 : 2,
                }}
              />
            );
          })}
          {center && radiusKm > 0 && (
            <Circle
              center={[center.lat, center.lng]}
              radius={radiusKm * 1000}
              pathOptions={{
                color: '#dc2626',
                fillColor: '#dc2626',
                fillOpacity: 0.35,
                weight: 3,
              }}
            />
          )}
        </MapContainer>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          نصف القطر (كم): {radiusKm.toFixed(1)}
        </label>
        <input
          type="range"
          min={0.5}
          max={30}
          step={0.5}
          value={radiusKm}
          onChange={(e) => onRadiusChange(Number(e.target.value))}
          className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 accent-primary"
        />
      </div>
      {center && (
        <p className="text-xs text-gray-500">
          المركز: {center.lat.toFixed(5)}, {center.lng.toFixed(5)}
        </p>
      )}
    </div>
  );
}
