"use client";

import { useEffect, useRef, useState } from "react";

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PwaControls() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [offline, setOffline] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const display = window.matchMedia("(display-mode: standalone)");
    const syncInstalled = () => setInstalled(display.matches || !!(navigator as Navigator & { standalone?: boolean }).standalone);
    const syncNetwork = () => setOffline(!navigator.onLine);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const onInstalled = () => { setInstalled(true); setPrompt(null); dialog.current?.close(); };
    syncInstalled();
    syncNetwork();
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("online", syncNetwork);
    window.addEventListener("offline", syncNetwork);
    display.addEventListener("change", syncInstalled);
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((error) => {
        console.warn("Offline support could not be registered", error);
      });
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("online", syncNetwork);
      window.removeEventListener("offline", syncNetwork);
      display.removeEventListener("change", syncInstalled);
    };
  }, []);

  async function install() {
    if (!prompt) { dialog.current?.showModal(); return; }
    setInstalling(true);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setPrompt(null);
    } catch {
      setPrompt(null);
      setInstallError(true);
      dialog.current?.showModal();
    } finally { setInstalling(false); }
  }

  return (
    <>
      {!installed && <button type="button" onClick={install} disabled={installing} className="btn-secondary px-3 py-2 text-xs sm:text-sm">{installing ? "Installing…" : "Install app"}<span aria-hidden="true">↓</span></button>}
      {installed && <span className="badge bg-slate-100 text-slate-600">Ready to ride</span>}
      {offline && <div role="status" className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[2500] mx-auto max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 shadow-lg"><strong>You’re offline.</strong> Live locations and ride changes need a connection. Updates resume when you reconnect.</div>}
      <dialog ref={dialog} aria-labelledby="install-title" className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl backdrop:bg-slate-900/50">
        <h2 id="install-title" className="section-title">Keep Convoy on your home screen</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">Open your next ride with a tap, without searching through your browser tabs.</p>
        {installError && <p role="alert" className="mt-3 text-sm text-red-700">The install prompt couldn’t open. Try the steps below.</p>}
        <div className="mt-5 space-y-4 text-sm">
          <p><strong>iPhone or iPad</strong><br /><span className="text-slate-600">Open in Safari, tap Share, then Add to Home Screen.</span></p>
          <p><strong>Android or desktop</strong><br /><span className="text-slate-600">Open your browser menu and choose Install app or Add to Home Screen when available.</span></p>
        </div>
        <p className="mt-5 text-xs leading-relaxed text-slate-500">Save your organizer link separately so you can return to your dashboard. Live tracking needs an internet connection and the app open on screen.</p>
        <form method="dialog" className="mt-5"><button className="btn-primary w-full">Got it</button></form>
      </dialog>
    </>
  );
}
