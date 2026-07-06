"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BookkeepingBy, BookkeepingSoftware, ClientCategory } from "@prisma/client";
import { updateClientBookkeepingAction, updateClientCategoryAction } from "@/app/(app)/clients/actions";
import { bookkeepingByLabels, bookkeepingSoftwareLabels, clientCategoryLabels } from "@/lib/constants";

const softwareOptions = Object.entries(bookkeepingSoftwareLabels) as [BookkeepingSoftware, string][];
const byOptions = Object.entries(bookkeepingByLabels) as [BookkeepingBy, string][];
const categoryOptions = Object.entries(clientCategoryLabels) as [ClientCategory, string][];

export function ClientBookkeepingInline({
  clientId,
  category: initialCategory,
  bookkeepingSoftware: initialSoftware,
  bookkeepingBy: initialBy,
}: {
  clientId: string;
  category: ClientCategory | null;
  bookkeepingSoftware: BookkeepingSoftware | null;
  bookkeepingBy: BookkeepingBy | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [category, setCategory] = useState<ClientCategory | "">(initialCategory ?? "MANUAL");
  const [software, setSoftware] = useState<BookkeepingSoftware | "">(initialSoftware ?? "");
  const [by, setBy] = useState<BookkeepingBy | "">(initialBy ?? "FIRM");

  const isSoftware = category === "SOFTWARE";

  async function saveCategory(value: string) {
    const next = value as ClientCategory | "";
    setCategory(next);
    if (next !== "SOFTWARE") {
      setSoftware("");
      setBy("FIRM");
    }

    setSaving(true);
    try {
      const catFd = new FormData();
      catFd.append("clientId", clientId);
      catFd.append("category", value);
      await updateClientCategoryAction(catFd);

      if (next !== "SOFTWARE") {
        const bkFd = new FormData();
        bkFd.append("clientId", clientId);
        bkFd.append("bookkeepingSoftware", "");
        bkFd.append("bookkeepingBy", "FIRM");
        await updateClientBookkeepingAction(bkFd);
      }
    } finally {
      setSaving(false);
      router.refresh();
    }
  }

  async function saveBookkeeping(newSoftware: string, newBy: string) {
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("clientId", clientId);
      fd.append("bookkeepingSoftware", newSoftware);
      fd.append("bookkeepingBy", newBy);
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
              void saveBookkeeping(next, by);
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
              void saveBookkeeping(software, next);
            }}
            value={by}
          >
            {byOptions.map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </>
      )}

      {saving && <span className="text-[10px] text-muted-foreground">Saving…</span>}
    </div>
  );
}
