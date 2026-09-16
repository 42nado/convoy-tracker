"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { formatMeetup, statusLabel } from "@/lib/format";
import type { PublicConvoyView } from "@/lib/queries";
import LocationSharePanel from "@/components/LocationSharePanel";
import type { MapLocation, RouteOverlay } from "@/components/ConvoyMap";

const ConvoyMap = dynamic(() => import("@/components/ConvoyMap"), {
  ssr: false,
  loading: () => (
    <div className="h-72 w-full rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center text-sm text-slate-500">
      Loading map…
    </div>
  ),
});
const LeaderControls = dynamic(() => import("@/components/LeaderControls"));

type MeState = "pending" | "approved" | "denied" | "left";
interface Me {
  id: number;
  name: string;
  state: MeState;
}

interface Props {
  initialView: PublicConvoyView;
  initialMe: Me | null;
}

export default function ConvoyClient({ initialView, initialMe }: Props) {
  const [view, setView] = useState<PublicConvoyView>(initialView);
  const [me, setMe] = useState<Me | null>(initialMe);
  const [refreshing, setRefreshing] = useState(false);
  const [locations, setLocations] = useState<MapLocation[]>([]);
  const [leaderRoutes, setLeaderRoutes] = useState<RouteOverlay[]>([]);

  const canViewLive = me?.state === "approved" && view.status !== "closed";
  const [locationError, setLocationError] = useState<string | null>(null);
  const leader = view.approved.find((member) => member.isLeader);
  const leaderLocation = locations.find((location) => location.isLeader);

  const myApprovedRecord = useMemo(
    () => (me ? view.approved.find((a) => a.id === me.id) : undefined),
    [me, view.approved],
  );
  const iAmLeader = myApprovedRecord?.isLeader === true;
  const hasPins = !!view.pins.meetup || !!view.pins.destination;
  const showMap = view.status !== "closed" && (canViewLive || hasPins);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [vRes, mRes] = await Promise.all([
        fetch(`/api/convoys/${view.code}`, { cache: "no-store" }),
        fetch(`/api/convoys/${view.code}/me`, { cache: "no-store" }),
      ]);
      if (vRes.ok) {
        const v = (await vRes.json()) as PublicConvoyView;
        setView(v);
      }
      if (mRes.ok) {
        const m = (await mRes.json()) as { member: Me | null };
        setMe(m.member);
      }
    } catch {
      /* Retry on the next roster refresh. */
    } finally {
      setRefreshing(false);
    }
  }, [view.code]);

  const refreshLocations = useCallback(async () => {
    if (!canViewLive) return;
    try {
      const res = await fetch(`/api/convoys/${view.code}/location`, { cache: "no-store" });
      if (!res.ok) {
        setLocations([]);
        setLocationError("Could not load locations. Check your connection and membership, then refresh.");
        return;
      }
      const data = (await res.json()) as { locations: MapLocation[] };
      setLocations(data.locations);
      setLocationError(null);
    } catch {
      setLocations([]);
      setLocationError("Location updates are unavailable. Retrying…");
    }
  }, [canViewLive, view.code]);

  useEffect(() => {
    const id = setInterval(refresh, 6000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (!canViewLive) {
      setLocations([]);
      return;
    }
    refreshLocations();
    const id = setInterval(refreshLocations, 5000);
    return () => clearInterval(id);
  }, [canViewLive, refreshLocations]);

  const status = statusLabel(view.status);

  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className={status.cls}>{status.text}</span>
          <span className="text-xs text-slate-400">code · {view.code}</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{view.title}</h1>
      </div>

      <div className="card space-y-3">
        <Row label="When" value={formatMeetup(view.meetup_at)} />
        <Row label="Meetup" value={view.meetup_place} />
        <Row label="Destination" value={view.destination} />
      </div>

      {view.status === "closed" ? (
        <ClosedNotice />
      ) : (
        <JoinPanel
          me={me}
          code={view.code}
          onChange={(next) => {
            setMe(next);
            refresh();
          }}
        />
      )}

      {me?.state === "approved" && view.status !== "closed" && (
        <LocationSharePanel code={view.code} enabled={canViewLive} />
      )}

      {iAmLeader && view.status !== "closed" && (
        <LeaderControls
          code={view.code}
          pins={view.pins}
          onPinsChanged={refresh}
          onRoutesChange={setLeaderRoutes}
        />
      )}

      {showMap && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              {canViewLive ? "Live map" : "Map"}
              {canViewLive && (
                <span className="font-normal text-slate-500"> ({locations.length} sharing)</span>
              )}
            </h2>
            {canViewLive && (
              <button
                onClick={refreshLocations}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Refresh
              </button>
            )}
          </div>
          <ConvoyMap
            locations={canViewLive ? locations : []}
            selfMemberId={me?.id ?? null}
            meetup={view.pins.meetup}
            destination={view.pins.destination}
            routes={iAmLeader ? leaderRoutes : undefined}
          />
          {canViewLive && locationError && <p role="status" className="text-xs text-red-700">{locationError}</p>}
          {canViewLive && !locationError && (
            <p className="text-xs text-slate-600">
              {!leader
                ? "No leader selected yet. The creator can choose one from the roster."
                : leaderLocation
                  ? `★ ${leader.name} is sharing. The orange marker shows the leader’s latest location.`
                  : iAmLeader
                    ? "You are the leader. Tap Share my location and allow location access so members can find you."
                    : `Waiting for ${leader.name} to share a recent location. The leader must tap Share my location and allow location access.`}
            </p>
          )}
          {canViewLive && locations.length === 0 && !locationError && (
            <p className="text-xs text-slate-500">
              No one&apos;s sharing yet. Tap &ldquo;Share my location&rdquo; above to start the map.
            </p>
          )}
          {!canViewLive && hasPins && (
            <p className="text-xs text-slate-500">
              Join and wait for approval to see live rider locations. Meetup and destination pins are visible to everyone.
            </p>
          )}
        </div>
      )}

      <Roster view={view} me={me} refreshing={refreshing} onRefresh={refresh} />
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-right text-sm font-medium text-slate-800">{value}</span>
    </div>
  );
}

function ClosedNotice() {
  return (
    <div className="card border-slate-300 bg-slate-100 text-center text-sm text-slate-600">
      This convoy is closed. Stay safe out there 🏍️
    </div>
  );
}

function JoinPanel({
  me,
  code,
  onChange,
}: {
  me: Me | null;
  code: string;
  onChange: (next: Me | null) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Type a name first.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/convoys/${code}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { member: Me };
      onChange(data.member);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join.");
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    if (!confirm("Leave this convoy?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/convoys/${code}/leave`, { method: "POST" });
      if (res.ok) onChange(null);
    } finally {
      setBusy(false);
    }
  }

  if (!me) {
    return (
      <form onSubmit={join} className="card space-y-3">
        <label htmlFor="rider-name" className="label">
          Join this convoy
        </label>
        <input
          id="rider-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="input"
          maxLength={40}
          autoComplete="off"
          required
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? "Sending…" : "Request to join"}
        </button>
        <p className="text-xs text-slate-500">
          The creator approves joiners — you'll show up on the roster once they say yes.
        </p>
      </form>
    );
  }

  if (me.state === "pending") {
    return (
      <div className="card space-y-2 border-amber-300 bg-amber-50">
        <p className="text-sm font-medium text-amber-900">
          ⏳ Waiting for approval — joined as <b>{me.name}</b>
        </p>
        <button onClick={leave} disabled={busy} className="btn-ghost w-full text-sm">
          Cancel request
        </button>
      </div>
    );
  }

  if (me.state === "approved") {
    return (
      <div className="card space-y-2 border-emerald-300 bg-emerald-50">
        <p className="text-sm font-medium text-emerald-900">
          ✓ You're in — riding as <b>{me.name}</b>
        </p>
        <button onClick={leave} disabled={busy} className="btn-ghost w-full text-sm">
          Leave convoy
        </button>
      </div>
    );
  }

  if (me.state === "denied") {
    return (
      <div className="card space-y-1 border-red-200 bg-red-50">
        <p className="text-sm font-medium text-red-800">
          Your request to join as <b>{me.name}</b> was denied.
        </p>
      </div>
    );
  }

  // left
  return (
    <div className="card space-y-2 border-slate-300 bg-slate-100">
      <p className="text-sm text-slate-700">You left this convoy.</p>
    </div>
  );
}

function Roster({
  view,
  me,
  refreshing,
  onRefresh,
}: {
  view: PublicConvoyView;
  me: Me | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">
          Roster <span className="font-normal text-slate-500">({view.approvedCount})</span>
        </h2>
        <button onClick={onRefresh} className="text-xs text-slate-500 hover:text-slate-700">
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      {view.approved.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
          No one approved yet.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {view.approved.map((m) => (
            <li
              key={m.id}
              className={`card flex items-center justify-between py-2.5 ${
                me?.id === m.id ? "border-accent" : ""
              }`}
            >
              <span className="font-medium text-slate-800">
                {m.name}
                {m.isLeader && <span className="ml-2 text-xs text-accent">★ leader</span>}
              </span>
              {me?.id === m.id && <span className="text-xs font-medium text-accent">you</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
