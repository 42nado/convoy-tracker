"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { LatLng } from "@/lib/db";
import type { ConvoyPins } from "@/lib/queries";

const QRCard = dynamic(() => import("@/components/QRCard"), { ssr: false });
const PinPicker = dynamic(() => import("@/components/PinPicker"), { ssr: false });
const QRCodeScanner = dynamic(() => import("@/components/QRCodeScanner"), { ssr: false });

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
  const [mode, setMode] = useState<"join" | "create">("join");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const router = useRouter();

  async function onJoin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await joinRide(joinCode);
  }

  async function joinRide(code: string) {
    if (joining || !/^[A-Z0-9]{6}$/.test(code)) return;
    setJoining(true);
    setJoinError(null);
    try {
      const response = await fetch(`/api/convoys/${code}`, { cache: "no-store" });
      if (response.status === 404) {
        setJoinError("No ride found with that code. Check the code with your organizer and try again.");
        return;
      }
      if (!response.ok) throw new Error("Couldn’t open this ride. Please try again.");
      router.push(`/c/${code}`);
    } catch (error) {
      setJoinError(error instanceof TypeError ? "Couldn’t connect. Check your internet connection and try again." : error instanceof Error ? error.message : "Couldn’t open this ride. Please try again.");
    } finally {
      setJoining(false);
    }
  }

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
          <h1 className="text-3xl font-bold leading-[1.12] tracking-tight sm:text-5xl">Your crew.<br /><span className="text-orange-700">Your next ride.</span></h1>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-slate-600">Have a convoy code? Join your crew. Organizing the trip? Create a ride and invite everyone.</p>
        </div>
        <ol className="hidden space-y-4 lg:block" aria-label="How it works">
          {[
            ["Find your ride", "Enter a convoy code or create a new ride."],
            ["Meet your crew", "Join with your name. The organizer approves riders."],
            ["Stay together", "Approved riders can share their live location."],
          ].map(([title, description], index) => (
            <li key={title} className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-orange-200 bg-orange-50 text-sm font-bold text-orange-800">{index + 1}</span>
              <div><p className="text-sm font-semibold">{title}</p><p className="mt-0.5 text-sm text-slate-600">{description}</p></div>
            </li>
          ))}
        </ol>
      </div>

      <div className="space-y-4">
        <div role="group" aria-label="Choose how to ride" className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          <button type="button" onClick={() => setMode("join")} aria-pressed={mode === "join"} aria-controls="join-ride" className={mode === "join" ? "btn-primary" : "btn-ghost"}>Join ride</button>
          <button type="button" onClick={() => setMode("create")} aria-pressed={mode === "create"} aria-controls="create-ride" className={mode === "create" ? "btn-primary" : "btn-ghost"}>Create ride</button>
        </div>
        <form id="join-ride" hidden={mode !== "join"} onSubmit={onJoin} className="card space-y-5 sm:p-7" aria-busy={joining}>
          <div>
            <p className="eyebrow mb-2">For the crew</p>
            <h2 className="text-2xl font-bold tracking-tight">Join a ride</h2>
            <p id="join-hint" className="mt-2 text-sm text-slate-600">Scan your organizer’s QR code, or enter their 6-character convoy code.</p>
          </div>
          <button id="scan-ride-qr" type="button" onClick={() => setScanning(true)} disabled={joining} className="btn-secondary w-full">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5" /><path d="M8 8h3v3H8zm5 0h3v3h-3zm-5 5h3v3H8zm5 0h3v3h-3z" /></svg>
            Scan QR code
          </button>
          <div className="flex items-center gap-3 text-xs text-slate-500" aria-hidden="true"><span className="h-px flex-1 bg-slate-200" />or enter a code<span className="h-px flex-1 bg-slate-200" /></div>
          <div>
            <label htmlFor="join-code" className="label">Convoy code</label>
            <input id="join-code" name="code" className="input text-center font-mono text-xl uppercase tracking-[0.25em]" placeholder="ABC234" value={joinCode} disabled={joining} onChange={(e) => {
              setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6));
              setJoinError(null);
            }} pattern="[A-Z0-9]{6}" minLength={6} maxLength={6} autoComplete="off" autoCapitalize="characters" spellCheck={false} required aria-describedby={joinError ? "join-hint join-error" : "join-hint"} aria-invalid={!!joinError} title="Enter the 6-character code from your organizer" />
          </div>
          {joinError && <p id="join-error" role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{joinError}</p>}
          <button type="submit" className="btn-primary w-full" disabled={joining || joinCode.length !== 6}>{joining ? "Finding your ride…" : "Join ride →"}</button>
          <p className="text-center text-xs leading-relaxed text-slate-500">Next, enter your name and request to join. No account needed.</p>
        </form>
      <form id="create-ride" hidden={mode !== "create"} onSubmit={onSubmit} className="card scroll-mt-5 space-y-5 sm:p-7" aria-busy={submitting}>
        <div className="border-b border-slate-100 pb-5">
          <p className="eyebrow mb-2">For the organizer</p>
          <h2 className="text-2xl font-bold tracking-tight">Create a ride</h2>
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
      </div>
      {scanning && <QRCodeScanner onClose={() => setScanning(false)} onCode={(code) => {
        setScanning(false);
        setJoinCode(code);
        void joinRide(code);
      }} />}
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
