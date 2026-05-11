"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapLocation {
  memberId: number;
  name: string;
  isLeader: boolean;
  lat: number;
  lng: number;
  accuracy: number | null;
  ageSec: number;
}

interface Props {
  locations: MapLocation[];
  selfMemberId: number | null;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function makeIcon(loc: MapLocation, isSelf: boolean): L.DivIcon {
  const color = loc.isLeader ? "#f97316" : isSelf ? "#0ea5e9" : "#0f172a";
  const ring = loc.isLeader ? "4px solid #fde68a" : "2px solid #fff";
  const html = `
    <div style="
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: ${color};
      color: #fff;
      font-weight: 700;
      font-size: 13px;
      box-shadow: 0 2px 8px rgba(0,0,0,.25);
      border: ${ring};
    ">${initials(loc.name)}</div>
  `;
  return L.divIcon({
    html,
    className: "",
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  });
}

export default function ConvoyMap({ locations, selfMemberId }: Props) {
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<number, L.Marker>>(new Map());
  const accuracyRef = useRef<Map<number, L.Circle>>(new Map());
  const fittedRef = useRef(false);

  // Init map once
  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return;
    const map = L.map(mapElRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView([14.5995, 120.9842], 11); // Manila default until we have a fix

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(map);

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
      accuracyRef.current.clear();
      fittedRef.current = false;
    };
  }, []);

  // Sync markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const seen = new Set<number>();
    for (const loc of locations) {
      seen.add(loc.memberId);
      const latlng: L.LatLngExpression = [loc.lat, loc.lng];
      const isSelf = loc.memberId === selfMemberId;
      const popup = `<b>${escapeHtml(loc.name)}</b>${loc.isLeader ? " · leader" : ""}<br/><span style="color:#64748b">${formatAge(loc.ageSec)}</span>`;

      const existing = markersRef.current.get(loc.memberId);
      if (existing) {
        existing.setLatLng(latlng);
        existing.setIcon(makeIcon(loc, isSelf));
        existing.setPopupContent(popup);
      } else {
        const marker = L.marker(latlng, { icon: makeIcon(loc, isSelf) }).addTo(map);
        marker.bindPopup(popup);
        markersRef.current.set(loc.memberId, marker);
      }

      // Accuracy circle (optional)
      const existingCircle = accuracyRef.current.get(loc.memberId);
      if (loc.accuracy && loc.accuracy < 200) {
        if (existingCircle) {
          existingCircle.setLatLng(latlng);
          existingCircle.setRadius(loc.accuracy);
        } else {
          const c = L.circle(latlng, {
            radius: loc.accuracy,
            color: loc.isLeader ? "#f97316" : "#0ea5e9",
            weight: 1,
            opacity: 0.4,
            fillOpacity: 0.08,
          }).addTo(map);
          accuracyRef.current.set(loc.memberId, c);
        }
      } else if (existingCircle) {
        existingCircle.remove();
        accuracyRef.current.delete(loc.memberId);
      }
    }

    // Remove stale markers
    for (const [id, marker] of markersRef.current) {
      if (!seen.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }
    for (const [id, circle] of accuracyRef.current) {
      if (!seen.has(id)) {
        circle.remove();
        accuracyRef.current.delete(id);
      }
    }

    // Fit bounds once we first have locations
    if (locations.length > 0 && !fittedRef.current) {
      const bounds = L.latLngBounds(locations.map((l) => [l.lat, l.lng] as L.LatLngTuple));
      map.fitBounds(bounds.pad(0.2), { maxZoom: 15 });
      fittedRef.current = true;
    }
  }, [locations, selfMemberId]);

  return <div ref={mapElRef} className="h-72 w-full rounded-xl overflow-hidden border border-slate-200" />;
}

function formatAge(sec: number): string {
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}
