import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DISPLAY_TIME_ZONE = "Asia/Karachi";

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "-";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: DISPLAY_TIME_ZONE,
  }).format(date);
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: DISPLAY_TIME_ZONE,
  }).format(date);
}

export function titleCaseEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function searchParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export function toSearchParams(params: Record<string, string | string[] | undefined>) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item) next.append(key, item);
      }
    } else if (typeof value === "string" && value) {
      next.append(key, value);
    }
  }
  return next;
}

export function toInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export type PageSizeOption = "25" | "50" | "100" | "all";

export const defaultPageSize = 25;
export const maxAllPageSize = 500;

export function parsePageSize(value: string | undefined): {
  pageSize: number;
  pageSizeOption: PageSizeOption;
} {
  if (value === "50" || value === "100") {
    return { pageSize: Number(value), pageSizeOption: value };
  }
  if (value === "all") {
    return { pageSize: maxAllPageSize, pageSizeOption: "all" };
  }
  return { pageSize: defaultPageSize, pageSizeOption: "25" };
}

export function withPageSizeParam(params: URLSearchParams, pageSizeOption: PageSizeOption) {
  const next = new URLSearchParams(params);
  if (pageSizeOption === "25") next.delete("pageSize");
  else next.set("pageSize", pageSizeOption);
  return next;
}
