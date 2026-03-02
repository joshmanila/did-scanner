"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { AreaCodeGroup } from "@/lib/types";
import type { GapAnalysisResult } from "@/lib/gap-analysis";

// Color constants
const GREEN = "#39ff14";
const RED = "#ff003c";
const YELLOW = "#ffdd00";

const STATUS_COLORS: Record<string, string> = {
  "no-coverage": RED,
  "low-coverage": YELLOW,
  "good-coverage": GREEN,
};

// Default green marker (DID overview mode)
const defaultIcon = L.divIcon({
  html: `<div style="
    width: 12px;
    height: 12px;
    background: ${GREEN};
    border: 2px solid #000;
    border-radius: 50%;
    box-shadow: 0 0 8px rgba(57, 255, 20, 0.8), 0 0 20px rgba(57, 255, 20, 0.4);
  "></div>`,
  className: "custom-marker",
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

// Gap analysis color-coded markers
function createGapIcon(status: string) {
  const color = STATUS_COLORS[status] || GREEN;
  const rgbMap: Record<string, string> = {
    [RED]: "255, 0, 60",
    [YELLOW]: "255, 221, 0",
    [GREEN]: "57, 255, 20",
  };
  const rgb = rgbMap[color] || "57, 255, 20";

  return L.divIcon({
    html: `<div style="
      width: 12px;
      height: 12px;
      background: ${color};
      border: 2px solid #000;
      border-radius: 50%;
      box-shadow: 0 0 8px rgba(${rgb}, 0.8), 0 0 20px rgba(${rgb}, 0.4);
    "></div>`,
    className: "custom-marker",
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

// Custom cluster icon for DID overview
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
      border: 2px solid ${GREEN};
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: ${GREEN};
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

// Gap analysis cluster — border color = dominant child status
function createGapClusterIcon(cluster: {
  getChildCount: () => number;
  getAllChildMarkers: () => L.Marker[];
}) {
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

  // Determine dominant color from children
  const markers = cluster.getAllChildMarkers();
  const colorCounts: Record<string, number> = {};
  for (const marker of markers) {
    const color =
      (marker.options as unknown as { _gapColor?: string })._gapColor || GREEN;
    colorCounts[color] = (colorCounts[color] || 0) + 1;
  }

  // Priority: red > yellow > green
  let dominantColor = GREEN;
  if ((colorCounts[RED] || 0) > 0) {
    dominantColor = RED;
  } else if ((colorCounts[YELLOW] || 0) > 0) {
    dominantColor = YELLOW;
  }

  const rgbMap: Record<string, string> = {
    [RED]: "255, 0, 60",
    [YELLOW]: "255, 221, 0",
    [GREEN]: "57, 255, 20",
  };
  const rgb = rgbMap[dominantColor] || "57, 255, 20";

  return L.divIcon({
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      background: rgba(0, 0, 0, 0.85);
      border: 2px solid ${dominantColor};
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: ${dominantColor};
      font-family: monospace;
      font-weight: 700;
      font-size: ${fontSize};
      box-shadow: 0 0 12px rgba(${rgb}, 0.6), 0 0 30px rgba(${rgb}, 0.2);
      text-shadow: 0 0 6px rgba(${rgb}, 0.8);
    ">${count}</div>`,
    className: "custom-cluster",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

interface DIDMapProps {
  groups: AreaCodeGroup[];
  gapAnalysis?: GapAnalysisResult | null;
}

export default function DIDMap({ groups, gapAnalysis }: DIDMapProps) {
  const isGapMode = !!gapAnalysis;

  if (!isGapMode && groups.length === 0) return null;
  if (isGapMode && gapAnalysis.entries.length === 0) return null;

  return (
    <div className="relative rounded-lg overflow-hidden border border-[#39ff14]/20 shadow-[0_0_20px_rgba(57,255,20,0.08)]">
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

        {isGapMode ? (
          <MarkerClusterGroup
            chunkedLoading
            iconCreateFunction={createGapClusterIcon}
            maxClusterRadius={60}
            spiderfyOnMaxZoom={true}
            showCoverageOnHover={false}
          >
            {gapAnalysis.entries.map((entry) => {
              const color = STATUS_COLORS[entry.status] || GREEN;
              const statusLabel =
                entry.status === "no-coverage"
                  ? "NO COVERAGE"
                  : entry.status === "low-coverage"
                    ? "LOW COVERAGE"
                    : "GOOD COVERAGE";

              return (
                <Marker
                  key={entry.areaCode}
                  position={[entry.lat, entry.lng]}
                  icon={createGapIcon(entry.status)}
                  // Store color for cluster aggregation
                  {...({ _gapColor: color } as Record<string, string>)}
                >
                  <Popup>
                    <div
                      style={{
                        fontFamily: "monospace",
                        minWidth: 180,
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: "1rem",
                          color,
                        }}
                      >
                        ({entry.areaCode})
                      </div>
                      <div
                        style={{
                          fontSize: "0.875rem",
                          marginTop: 2,
                          color: "#ccc",
                        }}
                      >
                        {entry.city}, {entry.state}
                      </div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          marginTop: 6,
                          padding: "3px 6px",
                          borderRadius: "4px",
                          display: "inline-block",
                          background: `${color}20`,
                          border: `1px solid ${color}60`,
                          color,
                          fontWeight: 700,
                        }}
                      >
                        {statusLabel}
                      </div>
                      <div
                        style={{
                          fontSize: "0.8rem",
                          marginTop: 8,
                          color: "#aaa",
                          lineHeight: 1.6,
                        }}
                      >
                        <div>
                          Calls:{" "}
                          <strong style={{ color: "#fff" }}>
                            {entry.callCount.toLocaleString()}
                          </strong>
                        </div>
                        <div>
                          DIDs:{" "}
                          <strong style={{ color }}>
                            {entry.didCount}
                          </strong>
                        </div>
                        <div>
                          Ratio:{" "}
                          <strong style={{ color: "#fff" }}>
                            {(entry.ratio * 100).toFixed(2)}%
                          </strong>
                        </div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MarkerClusterGroup>
        ) : (
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
        )}
      </MapContainer>

      {/* Legend overlay for gap analysis mode */}
      {isGapMode && (
        <div className="absolute bottom-4 left-4 z-[1000] rounded-lg border border-white/10 bg-black/80 backdrop-blur px-3 py-2 space-y-1">
          <div className="font-mono text-[0.55rem] font-bold tracking-wider uppercase text-white/50 mb-1.5">
            Coverage
          </div>
          {[
            { color: RED, label: "No Coverage (0 DIDs)" },
            { color: YELLOW, label: "Low Coverage (<2%)" },
            { color: GREEN, label: "Good Coverage (\u22652%)" },
          ].map((item) => (
            <div key={item.color} className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{
                  background: item.color,
                  boxShadow: `0 0 6px ${item.color}80`,
                }}
              />
              <span className="font-mono text-[0.6rem] text-white/60">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
