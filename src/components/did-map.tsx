"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { AreaCodeGroup } from "@/lib/types";

// Fix default marker icons for Leaflet in Next.js
const defaultIcon = L.divIcon({
  html: `<div style="
    width: 12px;
    height: 12px;
    background: #39ff14;
    border: 2px solid #000;
    border-radius: 50%;
    box-shadow: 0 0 8px rgba(57, 255, 20, 0.8), 0 0 20px rgba(57, 255, 20, 0.4);
  "></div>`,
  className: "custom-marker",
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

// Custom cluster icon
function createClusterIcon(cluster: { getChildCount: () => number }) {
  const count = cluster.getChildCount();
  let size = 36;
  let fontSize = "0.75rem";
  if (count > 50) {
    size = 48;
    fontSize = "0.875rem";
  }
  if (count > 200) {
    size = 56;
    fontSize = "1rem";
  }

  return L.divIcon({
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      background: rgba(0, 0, 0, 0.85);
      border: 2px solid #39ff14;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #39ff14;
      font-family: monospace;
      font-weight: 700;
      font-size: ${fontSize};
      box-shadow: 0 0 12px rgba(57, 255, 20, 0.6), 0 0 30px rgba(57, 255, 20, 0.2);
      text-shadow: 0 0 6px rgba(57, 255, 20, 0.8);
    ">${count}</div>`,
    className: "custom-cluster",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

interface DIDMapProps {
  groups: AreaCodeGroup[];
}

export default function DIDMap({ groups }: DIDMapProps) {
  if (groups.length === 0) return null;

  return (
    <div className="rounded-lg overflow-hidden border border-[#39ff14]/20 shadow-[0_0_20px_rgba(57,255,20,0.08)]">
      <MapContainer
        center={[39.8283, -98.5795]}
        zoom={4}
        style={{ height: "500px", width: "100%", background: "#0a0a0a" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <MarkerClusterGroup
          chunkedLoading
          iconCreateFunction={createClusterIcon}
          maxClusterRadius={60}
          spiderfyOnMaxZoom={true}
          showCoverageOnHover={false}
        >
          {groups.map((group) => (
            <Marker
              key={group.areaCode}
              position={[group.lat, group.lng]}
              icon={defaultIcon}
            >
              <Popup>
                <div
                  style={{
                    fontFamily: "monospace",
                    color: "#000",
                    minWidth: 160,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: "1rem" }}>
                    ({group.areaCode})
                  </div>
                  <div style={{ fontSize: "0.875rem", marginTop: 2 }}>
                    {group.city}, {group.state}
                  </div>
                  <div
                    style={{
                      fontSize: "0.875rem",
                      marginTop: 4,
                      fontWeight: 600,
                    }}
                  >
                    {group.count} DID{group.count !== 1 ? "s" : ""}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}
