/** Accept a convoy code or this app's join URL, never an arbitrary QR destination. */
export function convoyCodeFromQr(value: string, origin: string): string | null {
  const text = value.trim();
  if (/^[A-Z0-9]{6}$/i.test(text)) return text.toUpperCase();
  try {
    const url = new URL(text, origin);
    if (url.origin !== origin || url.username || url.password) return null;
    const match = url.pathname.match(/^\/c\/([A-Z0-9]{6})\/?$/i);
    return match ? match[1].toUpperCase() : null;
  } catch {
    return null;
  }
}
