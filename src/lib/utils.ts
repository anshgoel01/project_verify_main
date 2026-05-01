import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeSubmissionUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`);
    parsed.hash = "";
    parsed.search = "";
    parsed.hostname = parsed.hostname.replace(/^www\./i, "");

    const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${parsed.origin}${pathname}`;
  } catch {
    return trimmed
      .replace(/^https?:\/\//i, "https://")
      .replace(/^https:\/\/www\./i, "https://")
      .replace(/[?#].*$/, "")
      .replace(/\/+$/, "");
  }
}
