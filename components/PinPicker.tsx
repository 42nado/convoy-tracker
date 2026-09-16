"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  onSave: (value: LatLng | null, label?: string) => void;
  initialQuery?: string;
  error?: string | null;
  /** Allow user to also clear an existing pin. */
  allowClear?: boolean;
  saving?: boolean;
}

interface SearchResult extends LatLng {
  label: string;
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
  initialQuery = "",
  error,
}: Props) {
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const selectionRef = useRef(0);
  const [value, setValue] = useState<LatLng | null>(initial ?? null);
  const [label, setLabel] = useState<string | undefined>();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const searchRef = useRef<AbortController | null>(null);
  const interactedRef = useRef(false);
  const titleId = useId();
  const searchId = useId();

  const selectPoint = useCallback((point: LatLng, name?: string) => {
    const map = mapRef.current;
    if (!map) return;
    const ll = L.latLng(point.lat, point.lng).wrap();
    if (Math.abs(ll.lat) > 90) return;
    interactedRef.current = true;
    selectionRef.current += 1;
    setValue({ lat: ll.lat, lng: ll.lng });
    setLabel(name);
    if (markerRef.current) {
      markerRef.current.setLatLng(ll);
    } else {
      const marker = L.marker(ll, { icon: PIN_ICON, draggable: true }).addTo(map);
      marker.on("dragend", () => selectPoint(marker.getLatLng()));
      markerRef.current = marker;
    }
  }, []);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (query.trim().length < 2 || searching) return;
    searchRef.current?.abort();
    const controller = new AbortController();
    searchRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 10_000);
    setSearching(true);
    setMessage(null);
    setResults([]);
    try {
      const params = new URLSearchParams({ q: query.trim(), limit: "5", lang: "en" });
      const res = await fetch(`https://photon.komoot.io/api/?${params}`, {
        signal: controller.signal,
        referrerPolicy: "origin",
      });
      if (!res.ok) throw new Error("Search unavailable");
      const data = (await res.json()) as {
        features?: { geometry?: { coordinates?: number[] }; properties?: Record<string, unknown> }[];
      };
      if (!Array.isArray(data.features)) throw new Error("Invalid search response");
      const found: SearchResult[] = [];
      for (const feature of data.features) {
        const [lng, lat] = feature.geometry?.coordinates ?? [];
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
        const p = feature.properties ?? {};
        const parts = [p.name, p.street, p.city, p.state, p.country]
          .filter((part): part is string => typeof part === "string" && part.length > 0);
        found.push({ lat, lng, label: [...new Set(parts)].join(", ") || `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
      }
      if (searchRef.current !== controller) return;
      setResults(found);
      if (!found.length) setMessage("No places found. Try a nearby city or drop a pin on the map.");
    } catch {
      if (searchRef.current === controller) {
        setMessage("Location search is unavailable. Try again or choose a point on the map.");
      }
    } finally {
      clearTimeout(timeout);
      if (searchRef.current === controller) {
        searchRef.current = null;
        setSearching(false);
      }
    }
  }

  function locate() {
    const map = mapRef.current;
    if (!map || !navigator.geolocation) {
      setMessage("Location is unavailable. Search for a place or tap the map.");
      return;
    }
    setLocating(true);
    setMessage(null);
    interactedRef.current = true;
    const selection = selectionRef.current;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (mapRef.current !== map) return;
        setLocating(false);
        if (selection !== selectionRef.current) return;
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        selectPoint(point);
        map.setView([point.lat, point.lng], 16);
        setLocating(false);
      },
      () => {
        if (mapRef.current !== map) return;
        setLocating(false);
        setMessage("Could not get your location. Allow location access, search, or tap the map.");
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 10_000 },
    );
  }

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

    mapRef.current = map;
    if (initial) selectPoint(initial, initialQuery || undefined);
    map.on("click", (e: L.LeafletMouseEvent) => selectPoint(e.latlng));
    map.on("dragstart zoomstart", () => { interactedRef.current = true; });

    // If we have no initial pin, try to center on the user's current position.
    if (!initial && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (mapRef.current !== map || interactedRef.current) return;
          map.setView([pos.coords.latitude, pos.coords.longitude], 13);
        },
        () => {
          /* user denied or unavailable — keep fallback */
        },
        { maximumAge: 60_000, timeout: 5_000 },
      );
    }

    return () => {
      searchRef.current?.abort();
      searchRef.current = null;
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previousFocus?.focus();
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 p-3">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !saving) {
            e.stopPropagation();
            onCancel();
          }
          if (e.key !== "Tab") return;
          const focusable = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), a[href], [tabindex="0"]',
          ));
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && (document.activeElement === first || document.activeElement === e.currentTarget)) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }}
        className="max-h-[95dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-2 px-4 pt-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-slate-900">{title}</h2>
            {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onCancel}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="mt-3 space-y-2 px-4">
          <form onSubmit={search} className="space-y-2">
            <label htmlFor={searchId} className="label">Search location</label>
            <div className="flex gap-2">
              <input
                id={searchId}
                type="search"
                value={query}
                onChange={(e) => {
                  searchRef.current?.abort();
                  searchRef.current = null;
                  setSearching(false);
                  setQuery(e.target.value);
                  setResults([]);
                  setMessage(null);
                }}
                placeholder="Place, address, or city"
                className="input min-w-0 flex-1"
                maxLength={200}
                autoComplete="off"
              />
              <button type="submit" disabled={searching || query.trim().length < 2} className="btn-secondary text-sm">
                {searching ? "Searching…" : "Search"}
              </button>
            </div>
          </form>
          {results.length > 0 && (
            <ul className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
              {results.map((result, index) => (
                <li key={index}>
                  <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-orange-50" onClick={() => {
                    selectPoint(result, result.label);
                    mapRef.current?.setView([result.lat, result.lng], 16);
                    setResults([]);
                  }}>
                    {result.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-slate-500">
            Search by <a href="https://photon.komoot.io" target="_blank" rel="noopener noreferrer" className="underline">Photon</a>
            {" · "}© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">OpenStreetMap contributors</a>
          </p>
          <button type="button" onClick={locate} disabled={locating} className="btn-secondary w-full text-xs">
            {locating ? "Finding your location…" : "Use my current location"}
          </button>
          {message && <p role="status" className="text-xs text-amber-800">{message}</p>}
          {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
          <div
            ref={mapElRef}
            className="h-72 w-full overflow-hidden rounded-xl border border-slate-200"
          />
          <p className="mt-2 text-center text-xs text-slate-500">
            Tap to drop the pin. Drag the pin to fine-tune.
          </p>
          {label && <p className="text-center text-xs text-slate-700">{label}</p>}
          {value && (
            <p className="mt-1 text-center font-mono text-[11px] text-slate-500">
              {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
            </p>
          )}
        </div>
        <div className="flex gap-2 p-4">
          {allowClear && initial && (
            <button
              type="button"
              onClick={() => onSave(null)}
              disabled={saving}
              className="btn-ghost text-sm text-red-600 hover:bg-red-50"
            >
              Clear pin
            </button>
          )}
          <button type="button" onClick={onCancel} disabled={saving} className="btn-secondary flex-1 text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => value && onSave(value, label)}
            disabled={!value || saving}
            className="btn-primary flex-1 text-sm"
          >
            {saving ? "Saving…" : "Save pin"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
