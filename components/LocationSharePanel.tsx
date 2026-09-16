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
  const sessionRef = useRef(0);
  const requestRef = useRef<AbortController | null>(null);
  const lastAttemptRef = useRef(0);

  const stop = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== "undefined") {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    sessionRef.current += 1;
    requestRef.current?.abort();
    requestRef.current = null;
    lastAttemptRef.current = 0;
  }, []);

  const send = useCallback(
    async (pos: GeolocationPosition) => {
      if (requestRef.current || Date.now() - lastAttemptRef.current < PING_MS) return;
      if (Date.now() - pos.timestamp > 30_000) {
        setLastErr("Waiting for a fresh GPS location. Keep this page open and check location services.");
        return;
      }
      const session = sessionRef.current;
      const controller = new AbortController();
      requestRef.current = controller;
      lastAttemptRef.current = Date.now();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        const res = await fetch(`/api/convoys/${code}/location`, {
          method: "POST",
          signal: controller.signal,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy ?? null,
            heading: Number.isFinite(pos.coords.heading) ? pos.coords.heading : null,
            speed: Number.isFinite(pos.coords.speed) ? pos.coords.speed : null,
          }),
        });
        if (session !== sessionRef.current) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (session !== sessionRef.current) return;
          setLastErr(body.error ?? `HTTP ${res.status}`);
          return;
        }
        setState("on");
        setLastErr(null);
        setLastPingAt(Date.now());
      } catch {
        if (session === sessionRef.current) setLastErr("Could not send your location. Retrying…");
      } finally {
        clearTimeout(timeout);
        if (requestRef.current === controller) requestRef.current = null;
      }
    },
    [code],
  );

  const start = useCallback(() => {
    stop();
    if (!enabled) return;
    if (typeof navigator === "undefined" || !navigator.geolocation || !window.isSecureContext) {
      setState("unsupported");
      return;
    }
    setState("starting");
    setLastErr(null);
    setLastPingAt(null);
    const session = sessionRef.current;
    const onPosition = (pos: GeolocationPosition) => {
      if (session === sessionRef.current) void send(pos);
    };
    const onError = (err: GeolocationPositionError) => {
      if (session !== sessionRef.current) return;
      if (err.code === err.PERMISSION_DENIED) {
        stop();
        setState("denied");
      } else {
        setLastErr("Waiting for GPS. Check location services and keep this page open. Retrying…");
      }
    };
    const options = { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 };
    watchIdRef.current = navigator.geolocation.watchPosition(onPosition, onError, options);

    let locating = false;
    intervalRef.current = setInterval(() => {
      if (locating) return;
      locating = true;
      navigator.geolocation.getCurrentPosition(
        (pos) => { locating = false; onPosition(pos); },
        (err) => { locating = false; onError(err); },
        options,
      );
    }, PING_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, send, stop]);

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
        Location sharing is available to approved riders until the convoy closes.
      </div>
    );
  }

  if (state === "on" || state === "starting") {
    return (
      <div className="card border-emerald-300 bg-emerald-50 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-emerald-900">
            📍 {state === "starting" ? "Getting your location…" : "Sharing your location"}
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
        {lastErr && <p role="status" className="text-xs text-red-700">⚠ {lastErr}</p>}
        <p className="text-xs text-emerald-800">Keep this page open while sharing. Phones may pause location updates when locked or in the background.</p>
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
        <p className="text-sm text-amber-800">Location requires HTTPS (or localhost) and a browser that supports geolocation.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button onClick={start} className="btn-primary w-full">
        Share my location
      </button>
      <p className="text-xs text-slate-500">Share with approved riders and the creator, including while heading to the meetup. Your last location expires within 5 minutes after you stop.</p>
    </div>
  );
}
