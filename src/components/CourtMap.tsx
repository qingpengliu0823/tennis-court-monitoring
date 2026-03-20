"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { parseCourtMeta, distanceFromUCL, formatDistance } from "@/lib/court-utils";

// Fix default marker icons for leaflet
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  iconUrl: "/leaflet/marker-icon.png",
  shadowUrl: "/leaflet/marker-shadow.png",
});

function makeIcon(selected: boolean) {
  const color = selected ? "hsl(221, 83%, 53%)" : "hsl(215, 16%, 47%)";
  const size = selected ? 14 : 10;
  return L.divIcon({
    className: "",
    html: `<div style="
      width:${size}px;height:${size}px;
      background:${color};
      border:2px solid white;
      border-radius:50%;
      box-shadow:0 1px 4px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

interface Court {
  id: string;
  name: string;
  slug: string;
  bookingUrl: string;
  metadata: unknown;
}

function FlyToSelected({
  courts,
  selectedId,
}: {
  courts: Court[];
  selectedId: string | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (!selectedId) return;
    const court = courts.find((c) => c.id === selectedId);
    if (!court) return;
    const meta = parseCourtMeta(court.metadata);
    if (meta.lat && meta.lng) {
      map.flyTo([meta.lat, meta.lng], 15, { duration: 0.8 });
    }
  }, [selectedId, courts, map]);
  return null;
}

export default function CourtMap({
  courts,
  selectedId,
  onSelect,
}: {
  courts: Court[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const courtsWithCoords = courts.filter((c) => {
    const meta = parseCourtMeta(c.metadata);
    return meta.lat != null && meta.lng != null;
  });

  return (
    <MapContainer
      center={[51.5246, -0.134]}
      zoom={12}
      className="h-full w-full"
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FlyToSelected courts={courtsWithCoords} selectedId={selectedId} />
      {courtsWithCoords.map((court) => {
        const meta = parseCourtMeta(court.metadata);
        const dist = distanceFromUCL(meta.lat!, meta.lng!);
        return (
          <Marker
            key={court.id}
            position={[meta.lat!, meta.lng!]}
            icon={makeIcon(court.id === selectedId)}
            eventHandlers={{ click: () => onSelect(court.id) }}
          >
            <Popup>
              <div className="text-sm">
                <strong>{court.name}</strong>
                <div className="text-gray-500">{formatDistance(dist)} from UCL</div>
                <a
                  href={court.bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  Book now
                </a>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
