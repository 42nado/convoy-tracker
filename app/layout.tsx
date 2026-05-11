import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Convoy Tracker",
  description: "Coordinate motorcycle convoy rides without the group-chat chaos.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto max-w-md min-h-dvh px-4 py-6 flex flex-col">
          <header className="mb-6 flex items-center justify-between">
            <a href="/" className="text-lg font-bold tracking-tight">
              🏍️ Convoy Tracker
            </a>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="pt-8 text-center text-xs text-slate-400">
            v0.1 · no accounts · friend groups only
          </footer>
        </div>
      </body>
    </html>
  );
}
