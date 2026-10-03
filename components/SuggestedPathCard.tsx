"use client";

import { formatDistance, formatDuration, type RouteResult } from "@/lib/routing";

interface Props {
  pinsReady: boolean;
  route: RouteResult | null;
  loading: boolean;
  failed: boolean;
  shown: boolean;
  onPreview: () => void;
  onToggle: () => void;
}

// Presentation only: this card never sends coordinates or fetches a route.
export default function SuggestedPathCard({
  pinsReady, route, loading, failed, shown, onPreview, onToggle,
}: Props) {
  const roadRoute = route?.routed ? route : null;
  return (
    <div className="card space-y-3" aria-label="Suggested path" aria-busy={loading}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            <span aria-hidden="true" className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-orange-700" />
            Suggested path
          </h3>
          <p className="mt-1 text-xs text-slate-600">Meetup → destination</p>
        </div>
        {roadRoute && !loading && (
          <button type="button" onClick={onToggle} aria-pressed={shown} className="btn-secondary px-3 py-2 text-xs">
            {shown ? "Hide path" : "Show path"}
          </button>
        )}
      </div>
      {!pinsReady ? (
        <p className="text-sm text-slate-600">Pin both the meetup and destination to preview a road route.</p>
      ) : loading ? (
        <p role="status" className="text-sm text-slate-600">Finding a road route…</p>
      ) : roadRoute ? (
        <>
          <p className="text-base font-semibold">
            {formatDistance(roadRoute.distance)} <span className="font-normal text-slate-400">·</span> {formatDuration(roadRoute.duration)}
            <span className="ml-2 text-xs font-normal text-slate-500">estimated driving time</span>
          </p>
          <p className="text-xs leading-relaxed text-slate-500">A suggested driving route, without live traffic. Check road restrictions for your motorcycle before riding.</p>
        </>
      ) : failed ? (
        <p role="status" className="text-sm text-slate-600">Couldn’t find a road route. Check your connection or adjust the map pins.</p>
      ) : (
        <p className="text-sm text-slate-600">Preview the road path before your ride.</p>
      )}
      {pinsReady && (
        <>
          <p className="text-xs leading-relaxed text-slate-500">Previewing sends the meetup and destination pins to OSRM to calculate a route.</p>
          <button type="button" onClick={onPreview} disabled={loading} className="btn-secondary w-full text-sm">
            {loading ? "Finding path…" : roadRoute ? "Update path" : failed ? "Try again" : "Preview path"}
          </button>
        </>
      )}
    </div>
  );
}
