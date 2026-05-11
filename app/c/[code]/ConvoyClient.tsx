"use client";

import { useCallback, useEffect, useState } from "react";
import { formatMeetup, statusLabel } from "@/lib/format";
import type { PublicConvoyView } from "@/lib/queries";

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
    } finally {
      setRefreshing(false);
    }
  }, [view.code]);

  useEffect(() => {
    const id = setInterval(refresh, 6000);
    return () => clearInterval(id);
  }, [refresh]);

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
              <span className="font-medium text-slate-800">{m.name}</span>
              {me?.id === m.id && <span className="text-xs font-medium text-accent">you</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
