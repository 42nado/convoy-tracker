"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
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
  const [joinCode, setJoinCode] = useState("");
  const router = useRouter();

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
    <section className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12">
      <div className="space-y-6 lg:pt-4">
        <div>
          <p className="eyebrow mb-4">Less organizing. More riding.</p>
          <h1 className="text-4xl font-bold leading-[1.12] tracking-tight sm:text-5xl">Your ride.<br />Your people.<br /><span className="text-orange-700">One place.</span></h1>
          <p className="mt-5 max-w-sm text-base leading-relaxed text-slate-600">Plan the meetup, invite your crew, and find each other on the road.</p>
        </div>
        <a href="#create-ride" className="btn-primary w-full lg:hidden">Plan a ride <span aria-hidden="true">↓</span></a>
        <ol className="hidden space-y-4 lg:block" aria-label="How it works">
          {[
            ["Plan your ride", "Set a time, meetup, and destination."],
            ["Bring your crew", "Share a link or QR code and approve riders."],
            ["Stay together", "Approved riders can share their live location."],
          ].map(([title, description], index) => (
            <li key={title} className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-orange-200 bg-orange-50 text-sm font-bold text-orange-800">{index + 1}</span>
              <div><p className="text-sm font-semibold">{title}</p><p className="mt-0.5 text-sm text-slate-600">{description}</p></div>
            </li>
          ))}
        </ol>
        <form onSubmit={(e) => {
          e.preventDefault();
          if (/^[A-Z0-9]{6}$/.test(joinCode)) router.push(`/c/${joinCode}`);
        }} className="card space-y-3">
          <h2 className="section-title">Already invited?</h2>
          <label htmlFor="join-code" className="block text-sm text-slate-600">Enter your 6-character convoy code, or open your invite link.</label>
          <div className="flex gap-2">
            <input id="join-code" className="input min-w-0 flex-1 font-mono uppercase tracking-widest" placeholder="ABC234" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} pattern="[A-Z0-9]{6}" minLength={6} maxLength={6} autoComplete="off" autoCapitalize="characters" spellCheck={false} required title="Enter the 6-character code from your organizer" />
            <button type="submit" className="btn-secondary" disabled={joinCode.length !== 6}>Join ride <span aria-hidden="true">→</span></button>
          </div>
        </form>
      </div>

      <form id="create-ride" onSubmit={onSubmit} className="card scroll-mt-5 space-y-5 sm:p-7" aria-busy={submitting}>
        <div className="border-b border-slate-100 pb-5">
          <p className="eyebrow mb-2">For the organizer</p>
          <h2 className="text-2xl font-bold tracking-tight">Start a convoy</h2>
          <p className="mt-2 text-sm text-slate-600">A few details and you’re ready to invite riders. All fields are required.</p>
        </div>
        <fieldset disabled={submitting} className="space-y-5">
        <legend className="sr-only">Ride details</legend>
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
          <p className="mt-2 text-xs text-slate-500">Use the local time for your ride.</p>
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
            {pins.meetup ? "Edit meetup pin" : "Search or pin meetup on map"}
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
            {pins.destination ? "Edit destination pin" : "Search or pin destination on map"}
          </button>
          {pins.destination && <p className="mt-1 text-xs text-emerald-700">Destination pinned on the map ✓</p>}
        </div>

        <p className="text-xs leading-relaxed text-slate-500">Map pins are optional, but help everyone find the exact meeting point.</p>
        </fieldset>
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? "Creating your convoy…" : "Create convoy →"}
        </button>
        <p className="text-center text-xs text-slate-500">No sign-up. You control who joins.</p>
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
    <section className="convoy-page">
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
      <p className="text-center text-sm text-slate-600">Convoy code <span className="ml-2 rounded-lg bg-slate-100 px-3 py-2 font-mono font-bold tracking-widest text-slate-900">{result.code}</span></p>

      <a href={result.adminUrl} className="btn-primary w-full">
        Open creator dashboard →
      </a>
    </section>
  );
}

function SecretLinkCard({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  async function copy() {
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopyError(true);
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
      {copyError && <p role="alert" className="mt-2 text-sm text-red-700">Couldn’t copy. Select the creator link above and copy it manually.</p>}
      <p className="mt-2 text-xs text-amber-800/80">
        Bookmark this. It&apos;s the only way back in — anyone with it can approve joiners and close the convoy.
      </p>
    </div>
  );
}
