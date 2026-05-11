"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

interface Props {
  url: string;
  label?: string;
  size?: number;
}

export default function QRCard({ url, label, size = 240 }: Props) {
  const [svg, setSvg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(url, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
      width: size,
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then((out) => {
        if (!cancelled) setSvg(out);
      })
      .catch(() => {
        if (!cancelled) setSvg(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url, size]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  async function share() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ url, title: "Join my convoy" });
        return;
      } catch {
        /* user cancelled — fall through to copy */
      }
    }
    copyLink();
  }

  function downloadPng() {
    const svgEl = containerRef.current?.querySelector("svg");
    if (!svgEl) return;
    setDownloading(true);
    const xml = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = 4;
      canvas.width = size * scale;
      canvas.height = size * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        setDownloading(false);
        return;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      canvas.toBlob((png) => {
        if (!png) {
          setDownloading(false);
          return;
        }
        const dl = document.createElement("a");
        dl.href = URL.createObjectURL(png);
        dl.download = "convoy-qr.png";
        dl.click();
        URL.revokeObjectURL(dl.href);
        setDownloading(false);
      }, "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setDownloading(false);
    };
    img.src = objectUrl;
  }

  const tileClass =
    "mx-auto flex aspect-square w-full max-w-[260px] items-center justify-center rounded-xl bg-white p-3 border border-slate-200";
  const tileStyle: React.CSSProperties = { boxShadow: "0 1px 2px rgba(0,0,0,0.04)" };

  return (
    <div className="card space-y-3">
      {label && <p className="text-sm font-medium text-slate-700">{label}</p>}
      {svg ? (
        <div
          ref={containerRef}
          className={tileClass}
          style={tileStyle}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div ref={containerRef} className={tileClass} style={tileStyle}>
          <span className="text-xs text-slate-400">Generating QR…</span>
        </div>
      )}
      <p className="break-all rounded-md bg-slate-100 px-2 py-1.5 font-mono text-[11px] text-slate-700">
        {url}
      </p>
      <div className="flex gap-2">
        <button onClick={share} className="btn-primary flex-1 text-sm">
          Share
        </button>
        <button onClick={copyLink} className="btn-secondary flex-1 text-sm">
          {copied ? "Copied ✓" : "Copy"}
        </button>
        <button onClick={downloadPng} className="btn-ghost text-sm" disabled={downloading} title="Save QR as image">
          {downloading ? "…" : "PNG"}
        </button>
      </div>
    </div>
  );
}
