const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZoneName: "short",
});

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export function formatDateTime(epochMs: number): string {
  return dateTimeFormatter.format(new Date(epochMs));
}

export function formatUtc(epochMs: number): string {
  return `${new Date(epochMs).toISOString().replace("T", " ").slice(0, 19)} UTC`;
}

export function formatClock(epochMs: number): string {
  return timeFormatter.format(new Date(epochMs));
}

export function formatRelative(epochMs: number, now: number = Date.now()): string {
  const diffSec = Math.round((now - epochMs) / 1000);
  if (diffSec < 45) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay} d ago`;
}

export function formatMagnitude(magnitude: number): string {
  return magnitude.toFixed(1);
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export function formatCoordinate(value: number, axis: "lat" | "lon"): string {
  const hemi = axis === "lat" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
  return `${Math.abs(value).toFixed(3)}° ${hemi}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}
