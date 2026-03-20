"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { parseCourtMeta, distanceFromUCL, formatDistance } from "@/lib/court-utils";

function makeIcon(selected: boolean, enabled: boolean) {
  const w = selected ? 30 : 24;
  const h = selected ? 40 : 32;
  const color = !enabled ? "#94a3b8" : selected ? "#2563eb" : "#10b981";
  const shadow = selected ? "0.35" : "0.25";
  const stroke = 2;

  return L.divIcon({
    className: "",
    html: `<div style="filter:drop-shadow(0 2px 4px rgba(0,0,0,${shadow}))">
      <svg width="${w}" height="${h}" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0z"
              fill="${color}" stroke="white" stroke-width="${stroke}"/>
        <circle cx="12" cy="11" r="4.5" fill="white" fill-opacity="0.9"/>
      </svg>
    </div>`,
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -h + 6],
  });
}

interface Court {
  id: string;
  name: string;
  slug: string;
  bookingUrl: string;
  enabled: boolean;
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
            icon={makeIcon(court.id === selectedId, court.enabled)}
            eventHandlers={{ click: () => onSelect(court.id) }}
          >
            <Popup>
              <div className="text-sm">
                <strong>{court.name}</strong>
                <div className="text-gray-500">{formatDistance(dist)} from UCL</div>
                <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                  <a
                    href={court.bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                  >
                    Book
                  </a>
                  <a
                    href={`/monitors/new?court=${court.id}`}
                    className="text-blue-600 underline"
                  >
                    Monitor
                  </a>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
