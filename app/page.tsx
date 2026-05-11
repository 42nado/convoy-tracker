"use client";

import { useState } from "react";

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
            placeholder="Shell Magallanes"
            className="input"
            required
            autoComplete="off"
            maxLength={120}
          />
        </div>
        <div>
          <label htmlFor="destination" className="label">
            Destination
          </label>
          <input
            id="destination"
            name="destination"
            type="text"
            placeholder="Tagaytay Picnic Grove"
            className="input"
            required
            autoComplete="off"
            maxLength={120}
          />
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
    </section>
  );
}

function CreatedView({ result }: { result: CreateResult }) {
  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Convoy created ✓</h1>
        <p className="mt-1 text-sm text-slate-600">Two links — save the creator link, it's the only way back in.</p>
      </div>

      <LinkCard
        label="Join link (share this)"
        url={result.joinUrl}
        hint="Send this to your group chat. They open it, type a name, you approve."
        tone="public"
      />

      <LinkCard
        label="🔒 Creator link (keep secret)"
        url={result.adminUrl}
        hint="Bookmark this. Anyone with it can approve joiners and close the convoy."
        tone="secret"
      />

      <a href={result.adminUrl} className="btn-primary w-full">
        Open creator dashboard →
      </a>
    </section>
  );
}

function LinkCard({
  label,
  url,
  hint,
  tone,
}: {
  label: string;
  url: string;
  hint: string;
  tone: "public" | "secret";
}) {
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
    <div className={`card ${tone === "secret" ? "border-amber-300 bg-amber-50" : ""}`}>
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <p className="mt-1 break-all rounded-md bg-slate-100 px-2 py-1.5 font-mono text-xs text-slate-700">
        {url}
      </p>
      <div className="mt-3 flex gap-2">
        <button onClick={copy} className="btn-secondary flex-1 text-sm">
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">{hint}</p>
    </div>
  );
}
