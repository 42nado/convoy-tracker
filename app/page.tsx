"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { LatLng } from "@/lib/db";
import type { ConvoyPins } from "@/lib/queries";

const QRCard = dynamic(() => import("@/components/QRCard"), { ssr: false });
const PinPicker = dynamic(() => import("@/components/PinPicker"), { ssr: false });

interface CreateResult {
  code: string;
  adminToken: string;
  joinUrl: string;
  adminUrl: string;
}

export default function HomePage() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateResult | null>(null);
  const [meetupPlace, setMeetupPlace] = useState("");
  const [destination, setDestination] = useState("");
  const [pins, setPins] = useState<ConvoyPins>({ meetup: null, destination: null });
  const [pinModal, setPinModal] = useState<"meetup" | "destination" | null>(null);

  function selectPlace(point: LatLng | null, label?: string) {
    if (!pinModal) return;
    setPins((current) => ({ ...current, [pinModal]: point }));
    if (point) {
      const name = (label || `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`).slice(0, 120);
      if (pinModal === "meetup") setMeetupPlace(name);
      else setDestination(name);
    }
    setPinModal(null);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    const payload = {
      title: String(form.get("title") ?? "").trim(),
      meetupAt: String(form.get("meetupAt") ?? ""),
      meetupPlace: String(form.get("meetupPlace") ?? "").trim(),
      destination: String(form.get("destination") ?? "").trim(),
      pins,
    };
    if (!payload.title || !payload.meetupAt || !payload.meetupPlace || !payload.destination) {
      setError("Fill in every field — they're all needed.");
      setSubmitting(false);
      return;
    }
    try {
      const res = await fetch("/api/convoys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as CreateResult;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return <CreatedView result={result} />;
  }

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Start a convoy</h1>
        <p className="mt-1 text-sm text-slate-600">
          Fill this in, share the join link with your group. They join with a name, you approve.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="title" className="label">
            Ride title
          </label>
          <input
            id="title"
            name="title"
            type="text"
            placeholder="Sunday Tagaytay Run"
            className="input"
            required
            autoComplete="off"
            maxLength={80}
          />
        </div>
        <div>
          <label htmlFor="meetupAt" className="label">
            Meetup time
          </label>
          <input id="meetupAt" name="meetupAt" type="datetime-local" className="input" required />
        </div>
        <div>
          <label htmlFor="meetupPlace" className="label">
            Meetup place
          </label>
          <input
            id="meetupPlace"
            name="meetupPlace"
            type="text"
            value={meetupPlace}
            onChange={(e) => {
              setMeetupPlace(e.target.value);
              setPins((current) => ({ ...current, meetup: null }));
            }}
            placeholder="Shell Magallanes"
            className="input"
            required
            autoComplete="off"
            maxLength={120}
          />
          <button type="button" onClick={() => setPinModal("meetup")} className="btn-secondary mt-2 w-full text-sm">
            {pins.meetup ? "Edit meetup on map" : "Choose meetup on map / search"}
          </button>
          {pins.meetup && <p className="mt-1 text-xs text-emerald-700">Meetup pinned on the map ✓</p>}
        </div>
        <div>
          <label htmlFor="destination" className="label">
            Destination
          </label>
          <input
            id="destination"
            name="destination"
            type="text"
            value={destination}
            onChange={(e) => {
              setDestination(e.target.value);
              setPins((current) => ({ ...current, destination: null }));
            }}
            placeholder="Tagaytay Picnic Grove"
            className="input"
            required
            autoComplete="off"
            maxLength={120}
          />
          <button type="button" onClick={() => setPinModal("destination")} className="btn-secondary mt-2 w-full text-sm">
            {pins.destination ? "Edit destination on map" : "Choose destination on map / search"}
          </button>
          {pins.destination && <p className="mt-1 text-xs text-emerald-700">Destination pinned on the map ✓</p>}
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? "Creating…" : "Create convoy"}
        </button>
      </form>
      {pinModal && (
        <PinPicker
          title={pinModal === "meetup" ? "Choose meetup point" : "Choose destination"}
          hint="Search for a place, use your current location, or tap the map."
          initial={pins[pinModal]}
          initialQuery={pinModal === "meetup" ? meetupPlace : destination}
          fallbackCenter={pins.meetup ?? pins.destination ?? undefined}
          onCancel={() => setPinModal(null)}
          onSave={selectPlace}
          allowClear
        />
      )}
    </section>
  );
}

function CreatedView({ result }: { result: CreateResult }) {
  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Convoy created ✓</h1>
        <p className="mt-1 text-sm text-slate-600">
          Have friends scan this QR — or share the link. Save the creator link below to manage the convoy.
        </p>
      </div>

      <QRCard
        url={result.joinUrl}
        label="📷 Scan to join"
      />
      <p className="-mt-2 text-center text-xs text-slate-500">
        They scan, type their name, you approve.
      </p>

      <SecretLinkCard url={result.adminUrl} />

      <a href={result.adminUrl} className="btn-primary w-full">
        Open creator dashboard →
      </a>
    </section>
  );
}

function SecretLinkCard({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard not available */
    }
  }
  return (
    <div className="card border-amber-300 bg-amber-50">
      <p className="text-sm font-medium text-amber-900">🔒 Creator link (keep secret)</p>
      <p className="mt-1 break-all rounded-md bg-white/60 px-2 py-1.5 font-mono text-xs text-amber-900">
        {url}
      </p>
      <button onClick={copy} className="btn-secondary mt-3 w-full text-sm">
        {copied ? "Copied ✓" : "Copy creator link"}
      </button>
      <p className="mt-2 text-xs text-amber-800/80">
        Bookmark this. It&apos;s the only way back in — anyone with it can approve joiners and close the convoy.
      </p>
    </div>
  );
}
