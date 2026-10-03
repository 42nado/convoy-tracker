import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaControls from "@/components/PwaControls";

export const metadata: Metadata = {
  title: "Convoy Tracker",
  description: "Coordinate motorcycle convoy rides without the group-chat chaos.",
  applicationName: "Convoy Tracker",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Convoy" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f8fafc",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="skip-link">Skip to content</a>
        <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4 pb-6 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8">
          <header className="mb-8 flex items-center justify-between gap-3 border-b border-slate-200 pb-5">
            <a href="/" className="flex items-center gap-3 text-base font-bold tracking-tight sm:text-lg" aria-label="Convoy Tracker home">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-orange-400" aria-hidden="true">
                <svg viewBox="0 0 32 32" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m8 26 5-20h6l5 20M15 10h2m-3 6h4m-5 6h6" /></svg>
              </span>
              Convoy<span className="hidden text-slate-500 sm:inline">Tracker</span>
            </a>
            <PwaControls />
          </header>
          <main id="main-content" className="flex-1">{children}</main>
          <footer className="mt-10 border-t border-slate-200 pb-[env(safe-area-inset-bottom)] pt-5 text-center text-xs text-slate-500">
            Made for the ride together. No accounts needed.
          </footer>
        </div>
      </body>
    </html>
  );
}
