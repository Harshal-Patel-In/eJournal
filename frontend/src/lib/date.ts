/**
 * Centralized Date & Time Utility for eJournal.
 *
 * Guarantees DD/MM/YYYY format and IST (Indian Standard Time, Asia/Kolkata, UTC+5:30)
 * consistently across the entire frontend application.
 */

const IST_TIMEZONE = "Asia/Kolkata";

/**
 * Safely parse a date value ensuring UTC ISO strings without explicit timezone designator
 * (e.g. from MongoDB/FastAPI like "2026-09-23T14:37:25") are correctly treated as UTC,
 * rather than parsed as browser local time.
 */
export function parseDateUTC(date: string | number | Date | null | undefined): Date | null {
  if (!date) return null;
  if (date instanceof Date) return isNaN(date.getTime()) ? null : date;
  if (typeof date === "number") {
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof date === "string") {
    let s = date.trim();
    if (!s) return null;
    // ISO string with T but no trailing Z or timezone offset (+XX:XX or -XX:XX)
    if (s.includes("T") && !s.endsWith("Z") && !s.includes("+") && !/-\d{2}:\d{2}$/.test(s)) {
      s += "Z";
    } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s) && !s.includes("+")) {
      s = s.replace(" ", "T") + "Z";
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Format a date value into DD/MM/YYYY in IST.
 * Example: "23/09/2026"
 */
export function formatDateIST(date: string | number | Date | null | undefined): string {
  const d = parseDateUTC(date);
  if (!d) return "—";

  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: IST_TIMEZONE,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
  } catch {
    return "—";
  }
}

/**
 * Format a date value into 12-hour IST time with AM/PM.
 * Example: "08:07:25 PM" or "08:07 PM"
 */
export function formatTimeIST(
  date: string | number | Date | null | undefined,
  includeSeconds = true
): string {
  const d = parseDateUTC(date);
  if (!d) return "—";

  try {
    const formatted = new Intl.DateTimeFormat("en-IN", {
      timeZone: IST_TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      ...(includeSeconds ? { second: "2-digit" } : {}),
      hour12: true,
    }).format(d);

    return formatted.toUpperCase();
  } catch {
    return "—";
  }
}

/**
 * Format a date value into full "DD/MM/YYYY, hh:mm:ss AM/PM" in IST.
 * Example: "23/09/2026, 08:07:25 PM"
 */
export function formatDateTimeIST(
  date: string | number | Date | null | undefined,
  includeSeconds = true
): string {
  const d = parseDateUTC(date);
  if (!d) return "—";

  try {
    const datePart = formatDateIST(d);
    const timePart = formatTimeIST(d, includeSeconds);
    return `${datePart}, ${timePart}`;
  } catch {
    return "—";
  }
}

/**
 * Relative time formatter for notifications and activity feeds with IST fallback.
 * Examples: "Just now", "5m ago", "2h ago", "3d ago", or "23/09/2026" if older than 7 days.
 */
export function formatRelativeTimeIST(date: string | number | Date | null | undefined): string {
  const d = parseDateUTC(date);
  if (!d) return "";

  try {
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (diffSec < 60) return "Just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;

    return formatDateIST(d);
  } catch {
    return "";
  }
}
