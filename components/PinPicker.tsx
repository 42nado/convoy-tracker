"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLng } from "@/lib/db";

interface Props {
  title: string;
  /** Hint text shown above the map. */
  hint?: string;
  initial?: LatLng | null;
  /** Used as map default center when no `initial` and geolocation fails. */
  fallbackCenter?: LatLng;
  onCancel: () => void;
  onSave: (value: LatLng | null) => void;
  /** Allow user to also clear an existing pin. */
  allowClear?: boolean;
  saving?: boolean;
}

const PIN_ICON = L.divIcon({
  className: "",
  html: `<div style="
    width: 28px; height: 28px; border-radius: 50% 50% 50% 0;
    background: #f97316; border: 2px solid #fff;
    transform: rotate(-45deg);
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

export default function PinPicker({
  title,
  hint,
  initial,
  fallbackCenter,
  onCancel,
  onSave,
  allowClear,
  saving,
}: Props) {
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [value, setValue] = useState<LatLng | null>(initial ?? null);

  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return;

    const center: LatLng = initial ?? fallbackCenter ?? { lat: 14.5995, lng: 120.9842 };
    const map = L.map(mapElRef.current, { zoomControl: true }).setView(
      [center.lat, center.lng],
      initial ? 15 : 12,
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(map);

    if (initial) {
      const m = L.marker([initial.lat, initial.lng], { icon: PIN_ICON, draggable: true }).addTo(map);
      m.on("dragend", () => {
        const pos = m.getLatLng();
        setValue({ lat: pos.lat, lng: pos.lng });
      });
      markerRef.current = m;
    }

    map.on("click", (e: L.LeafletMouseEvent) => {
      const ll = { lat: e.latlng.lat, lng: e.latlng.lng };
      setValue(ll);
      if (markerRef.current) {
        markerRef.current.setLatLng(e.latlng);
      } else {
        const m = L.marker(e.latlng, { icon: PIN_ICON, draggable: true }).addTo(map);
        m.on("dragend", () => {
          const pos = m.getLatLng();
          setValue({ lat: pos.lat, lng: pos.lng });
        });
        markerRef.current = m;
      }
    });

    mapRef.current = map;

    // If we have no initial pin, try to center on the user's current position.
    if (!initial && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!mapRef.current) return;
          mapRef.current.setView([pos.coords.latitude, pos.coords.longitude], 13);
        },
        () => {
          /* user denied or unavailable — keep fallback */
        },
        { maximumAge: 60_000, timeout: 5_000 },
      );
    }

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-2 px-4 pt-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
          </div>
          <button
            onClick={onCancel}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="mt-3 px-4">
          <div
            ref={mapElRef}
            className="h-72 w-full overflow-hidden rounded-xl border border-slate-200"
          />
          <p className="mt-2 text-center text-xs text-slate-500">
            Tap to drop the pin. Drag the pin to fine-tune.
          </p>
          {value && (
            <p className="mt-1 text-center font-mono text-[11px] text-slate-500">
              {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
            </p>
          )}
        </div>
        <div className="flex gap-2 p-4">
          {allowClear && initial && (
            <button
              onClick={() => onSave(null)}
              disabled={saving}
              className="btn-ghost text-sm text-red-600 hover:bg-red-50"
            >
              Clear pin
            </button>
          )}
          <button onClick={onCancel} disabled={saving} className="btn-secondary flex-1 text-sm">
            Cancel
          </button>
          <button
            onClick={() => value && onSave(value)}
            disabled={!value || saving}
            className="btn-primary flex-1 text-sm"
          >
            {saving ? "Saving…" : "Save pin"}
          </button>
        </div>
      </div>
    </div>
  );
}
