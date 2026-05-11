"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLng } from "@/lib/db";

export interface MapLocation {
  memberId: number;
  name: string;
  isLeader: boolean;
  lat: number;
  lng: number;
  accuracy: number | null;
  ageSec: number;
}

export interface RouteOverlay {
  /** Unique key so we can replace overlays without flicker. */
  id: string;
  points: [number, number][];
  color: string;
  dashed?: boolean;
}

interface Props {
  locations: MapLocation[];
  selfMemberId: number | null;
  meetup?: LatLng | null;
  destination?: LatLng | null;
  routes?: RouteOverlay[];
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

function placeIcon(kind: "meetup" | "destination"): L.DivIcon {
  const isMeetup = kind === "meetup";
  const bg = isMeetup ? "#0f172a" : "#f97316";
  const emoji = isMeetup ? "🚩" : "🏁";
  return L.divIcon({
    className: "",
    html: `<div style="
      display:flex;align-items:center;justify-content:center;
      width:34px;height:34px;border-radius:50% 50% 50% 0;
      background:${bg};color:#fff;border:2px solid #fff;
      transform:rotate(-45deg);box-shadow:0 2px 8px rgba(0,0,0,0.3);
    "><span style="transform:rotate(45deg);font-size:14px;line-height:1">${emoji}</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
  });
}

export default function ConvoyMap({
  locations,
  selfMemberId,
  meetup,
  destination,
  routes,
}: Props) {
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<number, L.Marker>>(new Map());
  const accuracyRef = useRef<Map<number, L.Circle>>(new Map());
  const meetupMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const routeLayersRef = useRef<Map<string, L.Polyline>>(new Map());
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
      meetupMarkerRef.current = null;
      destMarkerRef.current = null;
      routeLayersRef.current.clear();
      fittedRef.current = false;
    };
  }, []);

  // Sync meetup / destination pins
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const sync = (
      pin: LatLng | null | undefined,
      ref: React.RefObject<L.Marker | null>,
      kind: "meetup" | "destination",
      label: string,
    ) => {
      if (pin) {
        if (ref.current) {
          ref.current.setLatLng([pin.lat, pin.lng]);
        } else {
          const m = L.marker([pin.lat, pin.lng], { icon: placeIcon(kind), interactive: true })
            .addTo(map)
            .bindPopup(`<b>${label}</b>`);
          ref.current = m;
        }
      } else if (ref.current) {
        ref.current.remove();
        ref.current = null;
      }
    };
    sync(meetup, meetupMarkerRef, "meetup", "Meetup");
    sync(destination, destMarkerRef, "destination", "Destination");
  }, [meetup, destination]);

  // Sync route overlays
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const incoming = new Map((routes ?? []).map((r) => [r.id, r] as const));
    // Remove dropped
    for (const [id, layer] of routeLayersRef.current) {
      if (!incoming.has(id)) {
        layer.remove();
        routeLayersRef.current.delete(id);
      }
    }
    // Add or update
    for (const [id, r] of incoming) {
      const existing = routeLayersRef.current.get(id);
      if (existing) {
        existing.setLatLngs(r.points);
        existing.setStyle({ color: r.color, dashArray: r.dashed ? "8 6" : undefined });
      } else {
        const layer = L.polyline(r.points, {
          color: r.color,
          weight: 5,
          opacity: 0.85,
          dashArray: r.dashed ? "8 6" : undefined,
        }).addTo(map);
        routeLayersRef.current.set(id, layer);
      }
    }
  }, [routes]);

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

    // Fit bounds once we first have *anything* worth fitting to
    if (!fittedRef.current) {
      const pts: L.LatLngTuple[] = locations.map((l) => [l.lat, l.lng]);
      if (meetup) pts.push([meetup.lat, meetup.lng]);
      if (destination) pts.push([destination.lat, destination.lng]);
      if (pts.length > 0) {
        const bounds = L.latLngBounds(pts);
        map.fitBounds(bounds.pad(0.2), { maxZoom: 15 });
        fittedRef.current = true;
      }
    }
  }, [locations, selfMemberId, meetup, destination]);

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
