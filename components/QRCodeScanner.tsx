"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import jsQR from "jsqr";
import { convoyCodeFromQr } from "@/lib/qr";

interface Props {
  onCode: (code: string) => void;
  onClose: () => void;
}

export default function QRCodeScanner({ onCode, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionRef = useRef(0);
  const acceptedRef = useRef(false);
  const readingRef = useRef(false);
  const rejectedRef = useRef("");
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;
  const [status, setStatus] = useState("Starting camera…");
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  function accept(value: string) {
    if (acceptedRef.current) return;
    const code = convoyCodeFromQr(value, window.location.origin);
    if (!code) {
      if (rejectedRef.current !== value) {
        rejectedRef.current = value;
        setError("This isn’t a ride QR code for this app. Scan your organizer’s invite QR, or enter the code instead.");
      }
      return;
    }
    acceptedRef.current = true;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    onCodeRef.current(code);
  }

  useEffect(() => {
    const session = ++sessionRef.current;
    const dialog = dialogRef.current;
    const video = videoRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const active = () => sessionRef.current === session && !acceptedRef.current;

    function scan() {
      if (!active()) return;
      if (!readingRef.current && video && video.readyState >= 2 && video.videoWidth && context) {
        const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frame = context.getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQR(frame.data, frame.width, frame.height);
        if (result) accept(result.data);
      }
      if (active()) timerRef.current = setTimeout(scan, 200);
    }

    async function start() {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setStatus("Camera scanning isn’t available here. Choose a QR photo or enter the code instead.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (!active() || !video) { stream.getTracks().forEach((track) => track.stop()); return; }
        streamRef.current = stream;
        video.srcObject = stream;
        await video.play();
        if (!active()) return;
        setStatus("Point your camera at the organizer’s QR code.");
        scan();
      } catch (err) {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        if (!active()) return;
        const name = err instanceof Error ? err.name : "";
        setStatus(name === "NotAllowedError"
          ? "Camera permission was denied. Allow camera access in your browser settings, choose a QR photo, or enter the code."
          : name === "NotFoundError"
            ? "No camera found. Choose a QR photo or enter the code instead."
            : "Couldn’t start the camera. It may be in use by another app. Choose a QR photo or enter the code instead.");
      }
    }
    void start();
    return () => {
      sessionRef.current += 1;
      if (timerRef.current) clearTimeout(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (video) video.srcObject = null;
      dialog?.close();
      previousFocus?.focus();
    };
    // Callback refs keep the camera running through parent re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function scanPhoto(file: File) {
    setError(null);
    rejectedRef.current = "";
    if (!file.type.startsWith("image/") || file.size > 15 * 1024 * 1024) {
      setError("Choose an image smaller than 15 MB.");
      return;
    }
    const session = sessionRef.current;
    readingRef.current = true;
    setReading(true);
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Unreadable image"));
        image.src = url;
      });
      if (session !== sessionRef.current || acceptedRef.current) return;
      const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Canvas unavailable");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(pixels.data, pixels.width, pixels.height);
      if (result) accept(result.data);
      else setError("No QR code found in that photo. Try a clear, closer image or enter the convoy code.");
    } catch {
      if (session === sessionRef.current) setError("Couldn’t read that photo. Try another image or enter the convoy code.");
    } finally {
      URL.revokeObjectURL(url);
      readingRef.current = false;
      if (session === sessionRef.current) setReading(false);
    }
  }

  return createPortal(
    <dialog ref={dialogRef} aria-labelledby="qr-scanner-title" onCancel={(e) => { e.preventDefault(); onClose(); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-xl backdrop:bg-slate-900/60">
      <div className="flex items-center justify-between gap-3">
        <h2 id="qr-scanner-title" className="section-title">Scan a ride QR code</h2>
        <button type="button" onClick={onClose} aria-label="Close QR scanner" className="btn-ghost px-3 py-2">✕</button>
      </div>
      <div className="relative mt-4 overflow-hidden rounded-xl bg-slate-900">
        <video ref={videoRef} muted autoPlay playsInline aria-label="Camera preview" className="aspect-square w-full object-cover" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-[15%] rounded-2xl border-2 border-white/80" />
      </div>
      <p role="status" className="mt-3 text-sm leading-relaxed text-slate-600">{status}</p>
      {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="mt-4 space-y-2">
        <button type="button" onClick={() => fileRef.current?.click()} disabled={reading} className="btn-secondary w-full text-sm">{reading ? "Reading photo…" : "Scan QR from a photo"}</button>
        <input ref={fileRef} type="file" accept="image/*" hidden aria-label="Choose a QR code image" onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void scanPhoto(file);
        }} />
        <button type="button" onClick={onClose} className="btn-ghost w-full text-sm">Enter code instead</button>
      </div>
      <p className="mt-3 text-center text-xs text-slate-500">Camera and photos are scanned on your device. Images aren’t uploaded.</p>
    </dialog>,
    document.body,
  );
}
