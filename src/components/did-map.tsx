"use client";

import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
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

const RGB_MAP: Record<string, string> = {
  [RED]: "255, 0, 60",
  [YELLOW]: "255, 221, 0",
  [GREEN]: "57, 255, 20",
};

const TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const TILE_ATTR = '&copy; <a href="https://carto.com/">CARTO</a>';
const US_CENTER: [number, number] = [39.8283, -98.5795];

// ── Pin icon — small pill with count number + pin point ──

function createPinIcon(count: number, color = GREEN) {
  const rgb = RGB_MAP[color] || "57, 255, 20";
  const label = count.toLocaleString();
  // Scale width based on digit count
  const chars = label.length;
  const width = Math.max(22, chars * 8 + 10);

  return L.divIcon({
    html: `<div style="
      display:flex; flex-direction:column; align-items:center;
    ">
      <div style="
        background: rgba(0,0,0,0.88);
        border: 1.5px solid ${color};
        border-radius: 8px;
        padding: 1px 5px;
        font-family: 'Courier New', monospace;
        font-weight: 800;
        font-size: 11px;
        color: ${color};
        line-height: 1.3;
        white-space: nowrap;
        text-shadow: 0 0 4px rgba(${rgb}, 0.7);
        box-shadow: 0 0 6px rgba(${rgb}, 0.3);
      ">${label}</div>
      <div style="
        width: 0; height: 0;
        border-left: 4px solid transparent;
        border-right: 4px solid transparent;
        border-top: 5px solid ${color};
        filter: drop-shadow(0 0 2px rgba(${rgb}, 0.5));
      "></div>
    </div>`,
    className: "pin-marker",
    iconSize: [width, 22],
    iconAnchor: [width / 2, 22],
  });
}

// ── Heatmap layer component ──

function HeatLayer({ points }: { points: [number, number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const heat = L.heatLayer(points, {
      radius: 30,
      blur: 20,
      maxZoom: 10,
      minOpacity: 0.3,
      gradient: {
        0.0: "#001a00",
        0.2: "#004d00",
        0.4: "#00cc44",
        0.6: "#39ff14",
        0.8: "#ffdd00",
        1.0: "#ff003c",
      },
    });
    heat.addTo(map);
    return () => {
      map.removeLayer(heat);
    };
  }, [map, points]);
  return null;
}

// ── Map wrapper with shared styles ──

function MapShell({
  children,
  borderColor = GREEN,
}: {
  children: React.ReactNode;
  borderColor?: string;
}) {
  const rgb = RGB_MAP[borderColor] || "57, 255, 20";
  return (
    <div
      className="relative rounded-lg overflow-hidden border shadow-lg"
      style={{
        borderColor: `rgba(${rgb}, 0.2)`,
        boxShadow: `0 0 20px rgba(${rgb}, 0.08)`,
      }}
    >
      {children}
    </div>
  );
}

// ── Section header ──

function SectionLabel({
  label,
  color = GREEN,
}: {
  label: string;
  color?: string;
}) {
  const rgb = RGB_MAP[color] || "57, 255, 20";
  return (
    <div className="flex items-center gap-3 mb-3">
      <div
        className="font-mono text-[0.6rem] font-bold tracking-[0.2em] uppercase"
        style={{ color, textShadow: `0 0 6px rgba(${rgb}, 0.6)` }}
      >
        [ {label} ]
      </div>
      <div className="flex-1 hud-divider" />
    </div>
  );
}

// ── Main component ──

interface DIDMapProps {
  groups: AreaCodeGroup[];
  gapAnalysis?: GapAnalysisResult | null;
}

type MapView = "pins" | "heatmap";

export default function DIDMap({ groups, gapAnalysis }: DIDMapProps) {
  const isGapMode = !!gapAnalysis;
  const [activeView, setActiveView] = useState<MapView>("pins");

  if (!isGapMode && groups.length === 0) return null;
  if (isGapMode && gapAnalysis.entries.length === 0) return null;

  // Build heatmap points weighted by count
  const heatPoints: [number, number, number][] = isGapMode
    ? gapAnalysis.entries.map((e) => [e.lat, e.lng, e.didCount || 0.1])
    : groups.map((g) => [g.lat, g.lng, g.count]);

  // Normalize weights for heatmap
  const maxWeight = Math.max(...heatPoints.map((p) => p[2]), 1);
  const normalizedHeat: [number, number, number][] = heatPoints.map((p) => [
    p[0],
    p[1],
    p[2] / maxWeight,
  ]);

  return (
    <div className="space-y-2">
      {/* View toggle */}
      <div className="flex items-center gap-2">
        {(
          [
            { key: "pins", label: "Pin Map" },
            { key: "heatmap", label: "Heatmap" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveView(tab.key)}
            className={`
              font-mono text-[0.65rem] font-bold tracking-wider uppercase px-3 py-1.5 rounded-md transition-all border
              ${
                activeView === tab.key
                  ? isGapMode
                    ? "bg-[#00bfff]/15 text-[#00bfff] border-[#00bfff]/30"
                    : "bg-[#39ff14]/15 text-[#39ff14] border-[#39ff14]/30"
                  : "text-white/40 border-white/10 hover:text-white/60 hover:bg-white/5"
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Pin Map */}
      {activeView === "pins" && (
        <MapShell borderColor={isGapMode ? "#00bfff" : GREEN}>
          <MapContainer
            center={US_CENTER}
            zoom={4}
            style={{ height: "550px", width: "100%", background: "#0a0a0a" }}
            scrollWheelZoom={true}
          >
            <TileLayer attribution={TILE_ATTR} url={TILE_URL} />

            {isGapMode
              ? gapAnalysis.entries.map((entry) => {
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
                      icon={createPinIcon(entry.didCount, color)}
                    >
                      <Popup>
                        <div style={{ fontFamily: "monospace", minWidth: 180 }}>
                          <div style={{ fontWeight: 700, fontSize: "1rem", color }}>
                            ({entry.areaCode})
                          </div>
                          <div style={{ fontSize: "0.875rem", marginTop: 2, color: "#ccc" }}>
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
                          <div style={{ fontSize: "0.8rem", marginTop: 8, color: "#aaa", lineHeight: 1.6 }}>
                            <div>
                              Calls: <strong style={{ color: "#fff" }}>{entry.callCount.toLocaleString()}</strong>
                            </div>
                            <div>
                              DIDs: <strong style={{ color }}>{entry.didCount}</strong>
                            </div>
                            <div>
                              Ratio: <strong style={{ color: "#fff" }}>{(entry.ratio * 100).toFixed(2)}%</strong>
                            </div>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })
              : groups.map((group) => (
                  <Marker
                    key={group.areaCode}
                    position={[group.lat, group.lng]}
                    icon={createPinIcon(group.count)}
                  >
                    <Popup>
                      <div style={{ fontFamily: "monospace", color: "#000", minWidth: 160 }}>
                        <div style={{ fontWeight: 700, fontSize: "1rem" }}>
                          ({group.areaCode})
                        </div>
                        <div style={{ fontSize: "0.875rem", marginTop: 2 }}>
                          {group.city}, {group.state}
                        </div>
                        <div style={{ fontSize: "0.875rem", marginTop: 4, fontWeight: 600 }}>
                          {group.count} DID{group.count !== 1 ? "s" : ""}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
          </MapContainer>

          {/* Legend overlay for gap analysis */}
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
        </MapShell>
      )}

      {/* Heatmap */}
      {activeView === "heatmap" && (
        <MapShell borderColor={isGapMode ? "#00bfff" : GREEN}>
          <MapContainer
            center={US_CENTER}
            zoom={4}
            style={{ height: "550px", width: "100%", background: "#0a0a0a" }}
            scrollWheelZoom={true}
          >
            <TileLayer attribution={TILE_ATTR} url={TILE_URL} />
            <HeatLayer points={normalizedHeat} />
          </MapContainer>

          {/* Heatmap legend */}
          <div className="absolute bottom-4 left-4 z-[1000] rounded-lg border border-white/10 bg-black/80 backdrop-blur px-3 py-2">
            <div className="font-mono text-[0.55rem] font-bold tracking-wider uppercase text-white/50 mb-1.5">
              {isGapMode ? "DID Density" : "Coverage Density"}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[0.55rem] text-white/40">Low</span>
              <div
                className="h-2 flex-1 rounded-sm"
                style={{
                  width: 80,
                  background: "linear-gradient(90deg, #001a00, #004d00, #00cc44, #39ff14, #ffdd00, #ff003c)",
                }}
              />
              <span className="font-mono text-[0.55rem] text-white/40">High</span>
            </div>
          </div>
        </MapShell>
      )}
    </div>
  );
}
