"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BookkeepingBy, BookkeepingFrequency, BookkeepingSoftware, ClientCategory } from "@prisma/client";
import { updateClientBookkeepingAction, updateClientCategoryAction } from "@/app/(app)/clients/actions";
import {
  bookkeepingByLabels,
  bookkeepingFrequencyLabels,
  bookkeepingSoftwareLabels,
  clientCategoryLabels,
} from "@/lib/constants";

const softwareOptions = Object.entries(bookkeepingSoftwareLabels) as [BookkeepingSoftware, string][];
const byOptions = Object.entries(bookkeepingByLabels) as [BookkeepingBy, string][];
const categoryOptions = Object.entries(clientCategoryLabels) as [ClientCategory, string][];
const frequencyOptions = Object.entries(bookkeepingFrequencyLabels) as [BookkeepingFrequency, string][];

export function ClientBookkeepingInline({
  clientId,
  category: initialCategory,
  bookkeepingSoftware: initialSoftware,
  bookkeepingBy: initialBy,
  bookkeepingFrequency: initialFrequency,
}: {
  clientId: string;
  category: ClientCategory | null;
  bookkeepingSoftware: BookkeepingSoftware | null;
  bookkeepingBy: BookkeepingBy | null;
  bookkeepingFrequency: BookkeepingFrequency | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [category, setCategory] = useState<ClientCategory | "">(initialCategory ?? "MANUAL");
  const [software, setSoftware] = useState<BookkeepingSoftware | "">(initialSoftware ?? "");
  const [by, setBy] = useState<BookkeepingBy | "">(initialBy ?? "FIRM");
  const [frequency, setFrequency] = useState<BookkeepingFrequency | "">(initialFrequency ?? "");

  const isSoftware = category === "SOFTWARE";

  async function saveCategory(value: string) {
    const next = value as ClientCategory | "";
    setCategory(next);
    if (next !== "SOFTWARE") {
      setSoftware("");
      setBy("FIRM");
      setFrequency("");
    }

    setSaving(true);
    try {
      const catFd = new FormData();
      catFd.append("clientId", clientId);
      catFd.append("category", value);
      await updateClientCategoryAction(catFd);
    } finally {
      setSaving(false);
      router.refresh();
    }
  }

  async function saveBookkeeping(newSoftware: string, newBy: string, newFrequency: string) {
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("clientId", clientId);
      fd.append("bookkeepingSoftware", newSoftware);
      fd.append("bookkeepingBy", newBy);
      fd.append("bookkeepingFrequency", newFrequency);
      await updateClientBookkeepingAction(fd);
    } finally {
      setSaving(false);
      router.refresh();
    }
  }

  const selectClass =
    "h-7 rounded border border-input bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 w-full";

  return (
    <div className="flex flex-col gap-1 min-w-[140px]">
      <select
        className={selectClass}
        disabled={saving}
        onChange={(e) => { void saveCategory(e.target.value); }}
        value={category}
      >
        <option value="">— Category —</option>
        {categoryOptions.map(([val, label]) => (
          <option key={val} value={val}>{label}</option>
        ))}
      </select>

      {isSoftware && (
        <>
          <select
            className={selectClass}
            disabled={saving}
            onChange={(e) => {
              const next = e.target.value as BookkeepingSoftware | "";
              setSoftware(next);
              void saveBookkeeping(next, by, frequency);
            }}
            value={software}
          >
            <option value="">— Software —</option>
            {softwareOptions.map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>

          <select
            className={selectClass}
            disabled={saving}
            onChange={(e) => {
              const next = e.target.value as BookkeepingBy | "";
              setBy(next);
              void saveBookkeeping(software, next, frequency);
            }}
            value={by}
          >
            {byOptions.map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>

          <select
            aria-label="Software bookkeeping cycle"
            className={selectClass}
            disabled={saving}
            onChange={(e) => {
              const next = e.target.value as BookkeepingFrequency | "";
              setFrequency(next);
              void saveBookkeeping(software, by, next);
            }}
            value={frequency}
          >
            <option value="">— Monthly / Quarterly —</option>
            {frequencyOptions.map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </>
      )}

      {saving && <span className="text-[10px] text-muted-foreground">Saving…</span>}
    </div>
  );
}
