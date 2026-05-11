"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { formatMeetup, statusLabel } from "@/lib/format";
import type { AdminConvoyView } from "@/lib/queries";
import type { MapLocation } from "@/components/ConvoyMap";

const ConvoyMap = dynamic(() => import("@/components/ConvoyMap"), {
  ssr: false,
  loading: () => (
    <div className="h-72 w-full rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center text-sm text-slate-500">
      Loading map…
    </div>
  ),
});

const QRCard = dynamic(() => import("@/components/QRCard"), { ssr: false });

interface Props {
  initialView: AdminConvoyView;
}

export default function AdminClient({ initialView }: Props) {
  const [view, setView] = useState<AdminConvoyView>(initialView);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [locations, setLocations] = useState<MapLocation[]>([]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/admin/${view.adminToken}`, { cache: "no-store" });
      if (res.ok) setView((await res.json()) as AdminConvoyView);
    } finally {
      setRefreshing(false);
    }
  }, [view.adminToken]);

  const refreshLocations = useCallback(async () => {
    if (view.status !== "active") return;
    try {
      const res = await fetch(`/api/admin/${view.adminToken}/locations`, { cache: "no-store" });
      if (!res.ok) {
        setLocations([]);
        return;
      }
      const data = (await res.json()) as { locations: MapLocation[] };
      setLocations(data.locations);
    } catch {
      /* keep old */
    }
  }, [view.adminToken, view.status]);

  useEffect(() => {
    const id = setInterval(refresh, 6000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (view.status !== "active") {
      setLocations([]);
      return;
    }
    refreshLocations();
    const id = setInterval(refreshLocations, 5000);
    return () => clearInterval(id);
  }, [view.status, refreshLocations]);

  async function act(path: string, body?: Record<string, unknown>) {
    const res = await fetch(`/api/admin/${view.adminToken}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.ok) await refresh();
    else {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? "Action failed");
    }
  }

  const status = statusLabel(view.status);
  const joinUrl = typeof window === "undefined" ? "" : `${window.location.origin}/c/${view.code}`;

  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className={status.cls}>{status.text}</span>
          <span className="text-xs text-slate-400">creator view · code {view.code}</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{view.title}</h1>
      </div>

      <ShareCard joinUrl={joinUrl} />

      {editing ? (
        <EditCard view={view} adminToken={view.adminToken} onDone={(updated) => {
          if (updated) setView({ ...view, ...updated });
          setEditing(false);
          refresh();
        }} />
      ) : (
        <div className="card space-y-3">
          <Row label="When" value={formatMeetup(view.meetup_at)} />
          <Row label="Meetup" value={view.meetup_place} />
          <Row label="Destination" value={view.destination} />
          {view.status !== "closed" && (
            <button onClick={() => setEditing(true)} className="btn-secondary w-full text-sm">
              Edit details
            </button>
          )}
        </div>
      )}

      <StatusControls
        status={view.status}
        onActive={() => act("/status", { status: "active" })}
        onClose={() => {
          if (confirm("Close this convoy? It can't be re-opened.")) act("/status", { status: "closed" });
        }}
        onReplan={() => act("/status", { status: "planned" })}
      />

      <PendingList
        pending={view.pending}
        refreshing={refreshing}
        onRefresh={refresh}
        onApprove={(id) => act("/approve", { memberId: id })}
        onDeny={(id) => act("/deny", { memberId: id })}
      />

      <ApprovedList
        approved={view.approved}
        onKick={(id, name) => {
          if (confirm(`Remove ${name} from the convoy?`)) act("/kick", { memberId: id });
        }}
        onSetLeader={(id) => act("/leader", { memberId: id })}
        onClearLeader={() => act("/leader", { memberId: null })}
      />

      {view.status === "active" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              Live map <span className="font-normal text-slate-500">({locations.length} sharing)</span>
            </h2>
            <button
              onClick={refreshLocations}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Refresh
            </button>
          </div>
          <ConvoyMap locations={locations} selfMemberId={null} />
          {locations.length === 0 && (
            <p className="text-xs text-slate-500">
              No riders are sharing yet. They&apos;ll see the &ldquo;Share my location&rdquo; button now that the ride is active.
            </p>
          )}
        </div>
      )}
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

function ShareCard({ joinUrl }: { joinUrl: string }) {
  const [showQr, setShowQr] = useState(false);
  return (
    <div className="space-y-2">
      {showQr ? (
        <>
          <QRCard url={joinUrl} label="📷 Scan to join" />
          <button
            onClick={() => setShowQr(false)}
            className="block w-full text-center text-xs text-slate-500 hover:text-slate-700"
          >
            Hide QR
          </button>
        </>
      ) : (
        <button onClick={() => setShowQr(true)} className="btn-secondary w-full text-sm">
          📷 Show QR code to invite riders
        </button>
      )}
    </div>
  );
}

function StatusControls({
  status,
  onActive,
  onClose,
  onReplan,
}: {
  status: AdminConvoyView["status"];
  onActive: () => void;
  onClose: () => void;
  onReplan: () => void;
}) {
  if (status === "closed") {
    return (
      <div className="card text-center text-sm text-slate-600">
        Convoy closed. Stay safe out there 🏍️
      </div>
    );
  }
  if (status === "active") {
    return (
      <div className="flex gap-2">
        <button onClick={onReplan} className="btn-secondary flex-1">
          Back to planned
        </button>
        <button onClick={onClose} className="btn-danger flex-1">
          Close convoy
        </button>
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      <button onClick={onActive} className="btn-primary flex-1">
        Start ride
      </button>
      <button onClick={onClose} className="btn-secondary flex-1">
        Close
      </button>
    </div>
  );
}

function PendingList({
  pending,
  refreshing,
  onRefresh,
  onApprove,
  onDeny,
}: {
  pending: AdminConvoyView["pending"];
  refreshing: boolean;
  onRefresh: () => void;
  onApprove: (id: number) => void;
  onDeny: (id: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">
          Waiting <span className="font-normal text-slate-500">({pending.length})</span>
        </h2>
        <button onClick={onRefresh} className="text-xs text-slate-500 hover:text-slate-700">
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      {pending.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-sm text-slate-500">
          No pending requests.
        </p>
      ) : (
        <ul className="space-y-2">
          {pending.map((m) => (
            <li key={m.id} className="card flex items-center gap-2 py-2.5">
              <span className="flex-1 font-medium text-slate-800">{m.name}</span>
              <button onClick={() => onApprove(m.id)} className="btn-primary px-3 py-2 text-sm">
                Approve
              </button>
              <button onClick={() => onDeny(m.id)} className="btn-ghost px-3 py-2 text-sm">
                Deny
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ApprovedList({
  approved,
  onKick,
  onSetLeader,
  onClearLeader,
}: {
  approved: AdminConvoyView["approved"];
  onKick: (id: number, name: string) => void;
  onSetLeader: (id: number) => void;
  onClearLeader: () => void;
}) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-slate-700">
        Roster <span className="font-normal text-slate-500">({approved.length})</span>
      </h2>
      {approved.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-sm text-slate-500">
          No one approved yet.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {approved.map((m) => (
            <li key={m.id} className="card flex items-center justify-between gap-2 py-2.5">
              <span className="flex-1 font-medium text-slate-800">
                {m.name}
                {m.isLeader && <span className="ml-2 text-xs text-accent">★ leader</span>}
              </span>
              {m.isLeader ? (
                <button
                  onClick={onClearLeader}
                  className="text-xs font-medium text-slate-500 hover:text-slate-700"
                >
                  Unset leader
                </button>
              ) : (
                <button
                  onClick={() => onSetLeader(m.id)}
                  className="text-xs font-medium text-accent hover:text-orange-600"
                >
                  Make leader
                </button>
              )}
              <button
                onClick={() => onKick(m.id, m.name)}
                className="text-xs font-medium text-red-600 hover:text-red-700"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EditCard({
  view,
  adminToken,
  onDone,
}: {
  view: AdminConvoyView;
  adminToken: string;
  onDone: (updated: Partial<AdminConvoyView> | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      title: String(fd.get("title") ?? "").trim(),
      meetupAt: String(fd.get("meetupAt") ?? ""),
      meetupPlace: String(fd.get("meetupPlace") ?? "").trim(),
      destination: String(fd.get("destination") ?? "").trim(),
    };
    try {
      const res = await fetch(`/api/admin/${adminToken}/convoy`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? `HTTP ${res.status}`);
      }
      onDone({
        title: payload.title,
        meetup_at: payload.meetupAt,
        meetup_place: payload.meetupPlace,
        destination: payload.destination,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="card space-y-3">
      <div>
        <label className="label">Title</label>
        <input name="title" defaultValue={view.title} className="input" maxLength={80} required />
      </div>
      <div>
        <label className="label">Meetup time</label>
        <input
          name="meetupAt"
          type="datetime-local"
          defaultValue={toLocalDatetime(view.meetup_at)}
          className="input"
          required
        />
      </div>
      <div>
        <label className="label">Meetup place</label>
        <input
          name="meetupPlace"
          defaultValue={view.meetup_place}
          className="input"
          maxLength={120}
          required
        />
      </div>
      <div>
        <label className="label">Destination</label>
        <input
          name="destination"
          defaultValue={view.destination}
          className="input"
          maxLength={120}
          required
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => onDone(null)} className="btn-secondary flex-1">
          Cancel
        </button>
        <button type="submit" disabled={busy} className="btn-primary flex-1">
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

function toLocalDatetime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}
