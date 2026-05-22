"use client";

import { useRef } from "react";
import type { ClientCategory } from "@prisma/client";
import { Select } from "@/components/ui/select";
import { clientCategories, clientCategoryLabels } from "@/lib/constants";
import { updateClientCategoryAction } from "@/app/(app)/clients/actions";

export function ClientCategorySelect({
  clientId,
  current,
}: {
  clientId: string;
  current: ClientCategory | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form action={updateClientCategoryAction} ref={formRef}>
      <input name="clientId" type="hidden" value={clientId} />
      <Select
        className="min-w-[180px]"
        defaultValue={current ?? ""}
        name="category"
        onChange={() => formRef.current?.requestSubmit()}
      >
        <option value="">Uncategorized</option>
        {clientCategories.map((cat) => (
          <option key={cat} value={cat}>
            {clientCategoryLabels[cat]}
          </option>
        ))}
      </Select>
    </form>
  );
}
