"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import type { LatLng } from "@/lib/db";
import type { ConvoyPins } from "@/lib/queries";
import { fetchRoute, formatDistance, formatDuration, type RouteResult } from "@/lib/routing";
import type { RouteOverlay } from "./ConvoyMap";

const PinPicker = dynamic(() => import("./PinPicker"), { ssr: false });

interface Props {
  code: string;
  pins: ConvoyPins;
  /** Called after a successful save so the parent can refetch. */
  onPinsChanged: () => void;
  /** Wired by parent so the routes can be drawn on the live map. */
  onRoutesChange: (routes: RouteOverlay[]) => void;
}

type Editing = "meetup" | "destination" | null;
type Stats = { distance: number; duration: number | null; routed: boolean } | null;

function getCurrentLocation(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation not supported on this browser"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? "Location permission denied — enable it in browser settings"
              : err.message || "Could not get your location",
          ),
        ),
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 },
    );
  });
}

export default function LeaderControls({ code, pins, onPinsChanged, onRoutesChange }: Props) {
  const [myLocation, setMyLocation] = useState<LatLng | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showMeetupRoute, setShowMeetupRoute] = useState(false);
  const [showConvoyRoute, setShowConvoyRoute] = useState(false);
  const [meetupRouteStats, setMeetupRouteStats] = useState<Stats>(null);
  const [convoyRouteStats, setConvoyRouteStats] = useState<Stats>(null);
  const [meetupRoutePts, setMeetupRoutePts] = useState<[number, number][] | null>(null);
  const [convoyRoutePts, setConvoyRoutePts] = useState<[number, number][] | null>(null);
  const [loadingRoute, setLoadingRoute] = useState<"meetup" | "convoy" | null>(null);

  async function savePin(kind: "meetup" | "destination", value: LatLng | null) {
    setSaving(true);
    setError(null);
    try {
      const body = kind === "meetup" ? { meetup: value } : { destination: value };
      const res = await fetch(`/api/convoys/${code}/pins`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? `HTTP ${res.status}`);
      }
      setEditing(null);
      onPinsChanged();
      // Invalidate cached routes that referenced the changed pin
      if (kind === "meetup") {
        setMeetupRoutePts(null);
        setMeetupRouteStats(null);
        setConvoyRoutePts(null);
        setConvoyRouteStats(null);
      } else {
        setConvoyRoutePts(null);
        setConvoyRouteStats(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save pin");
    } finally {
      setSaving(false);
    }
  }

  const refreshRoutes = useCallback(
    (
      nextMeetup: [number, number][] | null,
      nextConvoy: [number, number][] | null,
      showMeetup: boolean,
      showConvoy: boolean,
    ) => {
      const overlays: RouteOverlay[] = [];
      if (showMeetup && nextMeetup)
        overlays.push({ id: "to-meetup", points: nextMeetup, color: "#0ea5e9", dashed: true });
      if (showConvoy && nextConvoy)
        overlays.push({ id: "convoy", points: nextConvoy, color: "#f97316" });
      onRoutesChange(overlays);
    },
    [onRoutesChange],
  );

  async function loadRoute(kind: "meetup" | "convoy") {
    setLoadingRoute(kind);
    setError(null);
    try {
      let result: RouteResult;
      if (kind === "meetup") {
        if (!pins.meetup) throw new Error("Pin the meetup first");
        const here = myLocation ?? (await getCurrentLocation());
        if (!myLocation) setMyLocation(here);
        result = await fetchRoute(here, pins.meetup);
      } else {
        if (!pins.meetup || !pins.destination) throw new Error("Need both meetup and destination pins");
        result = await fetchRoute(pins.meetup, pins.destination);
      }
      if (kind === "meetup") {
        setMeetupRoutePts(result.points);
        setMeetupRouteStats({ distance: result.distance, duration: result.duration, routed: result.routed });
        setShowMeetupRoute(true);
        refreshRoutes(result.points, convoyRoutePts, true, showConvoyRoute);
      } else {
        setConvoyRoutePts(result.points);
        setConvoyRouteStats({ distance: result.distance, duration: result.duration, routed: result.routed });
        setShowConvoyRoute(true);
        refreshRoutes(meetupRoutePts, result.points, showMeetupRoute, true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not compute route");
    } finally {
      setLoadingRoute(null);
    }
  }

  function toggleRoute(kind: "meetup" | "convoy") {
    if (kind === "meetup") {
      const next = !showMeetupRoute;
      setShowMeetupRoute(next);
      refreshRoutes(meetupRoutePts, convoyRoutePts, next, showConvoyRoute);
    } else {
      const next = !showConvoyRoute;
      setShowConvoyRoute(next);
      refreshRoutes(meetupRoutePts, convoyRoutePts, showMeetupRoute, next);
    }
  }

  const meetupReady = !!pins.meetup;
  const destReady = !!pins.destination;

  return (
    <div className="card border-amber-300 bg-amber-50 space-y-3">
      <p className="text-sm font-semibold text-amber-900">★ Leader controls</p>

      <PinRow
        label="📍 Meetup point"
        pin={pins.meetup}
        onEdit={() => setEditing("meetup")}
      />
      <PinRow
        label="🏁 Destination"
        pin={pins.destination}
        onEdit={() => setEditing("destination")}
      />

      {error && (
        <p className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">{error}</p>
      )}

      <div className="border-t border-amber-200 pt-3 space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-amber-900/70">Route preview</p>

        <RouteRow
          label="🧭 Get to meetup"
          subtitle={
            !meetupReady
              ? "Pin the meetup point first"
              : myLocation
              ? "From where you are now → meetup pin"
              : "Uses your phone's location (one-time prompt)"
          }
          stats={meetupRouteStats}
          disabled={!meetupReady}
          loading={loadingRoute === "meetup"}
          shown={showMeetupRoute}
          hasData={!!meetupRoutePts}
          onLoad={() => loadRoute("meetup")}
          onToggle={() => toggleRoute("meetup")}
        />

        <RouteRow
          label="🛣️ Preview convoy route"
          subtitle={
            !meetupReady || !destReady
              ? "Pin both meetup and destination"
              : "Meetup → destination (the convoy ride)"
          }
          stats={convoyRouteStats}
          disabled={!meetupReady || !destReady}
          loading={loadingRoute === "convoy"}
          shown={showConvoyRoute}
          hasData={!!convoyRoutePts}
          onLoad={() => loadRoute("convoy")}
          onToggle={() => toggleRoute("convoy")}
        />
      </div>

      {editing && (
        <PinPicker
          title={editing === "meetup" ? "Pin the meetup point" : "Pin the destination"}
          hint={
            editing === "meetup"
              ? "Where everyone gathers before the ride."
              : "Where the convoy is heading."
          }
          initial={editing === "meetup" ? pins.meetup : pins.destination}
          fallbackCenter={myLocation ?? undefined}
          onCancel={() => {
            setEditing(null);
            setError(null);
          }}
          onSave={(value) => savePin(editing, value)}
          allowClear
          saving={saving}
          error={error}
        />
      )}
    </div>
  );
}

function PinRow({
  label,
  pin,
  onEdit,
}: {
  label: string;
  pin: LatLng | null;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-amber-900">{label}</p>
        {pin ? (
          <p className="font-mono text-[11px] text-amber-800/70">
            {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
          </p>
        ) : (
          <p className="text-xs text-amber-800/70">Not pinned yet</p>
        )}
      </div>
      <button onClick={onEdit} className="btn-secondary px-3 py-1.5 text-xs">
        {pin ? "Edit" : "Pin it"}
      </button>
    </div>
  );
}

function RouteRow({
  label,
  subtitle,
  stats,
  disabled,
  loading,
  shown,
  hasData,
  onLoad,
  onToggle,
}: {
  label: string;
  subtitle: string;
  stats: Stats;
  disabled: boolean;
  loading: boolean;
  shown: boolean;
  hasData: boolean;
  onLoad: () => void;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-lg border border-amber-200 bg-white/60 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-amber-900">{label}</p>
          <p className="text-xs text-amber-800/70">{subtitle}</p>
        </div>
        {hasData ? (
          <div className="flex flex-shrink-0 gap-1">
            <button
              onClick={onToggle}
              className="btn-secondary px-2.5 py-1 text-xs"
              disabled={loading || disabled}
            >
              {shown ? "Hide" : "Show"}
            </button>
            <button
              onClick={onLoad}
              className="btn-ghost px-2.5 py-1 text-xs"
              disabled={loading || disabled}
              title="Recompute"
            >
              ↻
            </button>
          </div>
        ) : (
          <button
            onClick={onLoad}
            disabled={loading || disabled}
            className="btn-primary flex-shrink-0 px-2.5 py-1 text-xs"
          >
            {loading ? "…" : "Preview"}
          </button>
        )}
      </div>
      {stats && (
        <p className="mt-1.5 text-xs text-amber-800">
          {formatDistance(stats.distance)} · {formatDuration(stats.duration)}
          {!stats.routed && <span className="ml-1 text-amber-700/70">(straight line — routing unavailable)</span>}
        </p>
      )}
    </div>
  );
}
