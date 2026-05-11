"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  code: string;
  enabled: boolean;
}

type ShareState = "off" | "starting" | "on" | "denied" | "error" | "unsupported";

const PING_MS = 8_000;

export default function LocationSharePanel({ code, enabled }: Props) {
  const [state, setState] = useState<ShareState>("off");
  const [lastErr, setLastErr] = useState<string | null>(null);
  const [lastPingAt, setLastPingAt] = useState<number | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCoordsRef = useRef<GeolocationPosition | null>(null);

  const stop = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== "undefined") {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    lastCoordsRef.current = null;
  }, []);

  const send = useCallback(
    async (pos: GeolocationPosition) => {
      try {
        const res = await fetch(`/api/convoys/${code}/location`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy ?? null,
            heading: Number.isFinite(pos.coords.heading) ? pos.coords.heading : null,
            speed: Number.isFinite(pos.coords.speed) ? pos.coords.speed : null,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setLastErr(body.error ?? `HTTP ${res.status}`);
          return;
        }
        setLastErr(null);
        setLastPingAt(Date.now());
      } catch (e) {
        setLastErr(e instanceof Error ? e.message : "network");
      }
    },
    [code],
  );

  const start = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState("unsupported");
      return;
    }
    setState("starting");
    setLastErr(null);

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        lastCoordsRef.current = pos;
        if (state !== "on") setState("on");
        send(pos);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setState("denied");
        else {
          setState("error");
          setLastErr(err.message);
        }
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 },
    );
    watchIdRef.current = id;

    intervalRef.current = setInterval(() => {
      const last = lastCoordsRef.current;
      if (last) send(last);
    }, PING_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [send]);

  useEffect(() => {
    if (!enabled && state !== "off") {
      stop();
      setState("off");
    }
  }, [enabled, state, stop]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  if (!enabled) {
    return (
      <div className="card text-sm text-slate-600">
        Location sharing turns on once the creator marks the ride as <b>Riding now</b>.
      </div>
    );
  }

  if (state === "on" || state === "starting") {
    return (
      <div className="card border-emerald-300 bg-emerald-50 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-emerald-900">
            📍 Sharing your location{state === "starting" ? "…" : ""}
          </p>
          <button onClick={() => { stop(); setState("off"); }} className="text-xs font-medium text-emerald-900/70 hover:text-emerald-900">
            Stop
          </button>
        </div>
        {lastPingAt && (
          <p className="text-xs text-emerald-800/70">
            last update {Math.max(0, Math.floor((Date.now() - lastPingAt) / 1000))}s ago
          </p>
        )}
        {lastErr && <p className="text-xs text-red-700">⚠ {lastErr}</p>}
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="card border-red-200 bg-red-50 space-y-1">
        <p className="text-sm font-medium text-red-800">Location permission denied</p>
        <p className="text-xs text-red-700">
          Enable location in your browser settings for this site, then refresh.
        </p>
      </div>
    );
  }

  if (state === "unsupported") {
    return (
      <div className="card border-amber-200 bg-amber-50">
        <p className="text-sm text-amber-800">Your browser doesn&apos;t support geolocation.</p>
      </div>
    );
  }

  return (
    <button onClick={start} className="btn-primary w-full">
      Share my location
    </button>
  );
}
