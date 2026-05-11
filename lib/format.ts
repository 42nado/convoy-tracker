export function formatMeetup(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function statusLabel(status: string): { text: string; cls: string } {
  switch (status) {
    case "active":
      return { text: "Riding now", cls: "badge-active" };
    case "closed":
      return { text: "Closed", cls: "badge-closed" };
    default:
      return { text: "Planned", cls: "badge-planned" };
  }
}
