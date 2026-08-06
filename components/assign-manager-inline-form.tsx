"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { assignJobAction } from "@/app/(app)/jobs/actions";
import { useClientCategoryConfirm } from "@/components/client-category-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { isIrfanSourcePerson, isTaahaSourcePerson } from "@/lib/import/department";

type Candidate = { id: string; name: string | null; role: string };

export function AssignManagerInlineForm({
  jobId,
  clientName,
  candidates,
}: {
  jobId: string;
  clientName: string;
  candidates: Candidate[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [isPending, startTransition] = useTransition();
  const { confirm: confirmClientCategory, dialog } = useClientCategoryConfirm();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) return;
    const target = candidates.find((candidate) => candidate.id === userId);
    const formData = new FormData(event.currentTarget);

    if (target && (isIrfanSourcePerson(target.name) || isTaahaSourcePerson(target.name))) {
      const choice = await confirmClientCategory(target.name ?? "This manager", clientName);
      if (!choice) return;
      formData.set("clientCategory", choice);
    }

    startTransition(async () => {
      await assignJobAction(formData);
      setUserId("");
      router.refresh();
    });
  }

  return (
    <>
      {dialog}
      <form className="grid gap-2 sm:grid-cols-[1fr_auto]" onSubmit={submit} ref={formRef}>
        <input name="jobId" type="hidden" value={jobId} />
        <input name="assignmentRole" type="hidden" value="MANAGER" />
        <Select
          aria-label="Select manager"
          disabled={isPending}
          name="userId"
          onChange={(event) => setUserId(event.target.value)}
          required
          value={userId}
        >
          <option value="">Select manager</option>
          {candidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name} ({candidate.role})
            </option>
          ))}
        </Select>
        <Button disabled={isPending} loading={isPending} loadingLabel="Adding..." type="submit">
          <UserPlus className="h-4 w-4" />
          Add Manager
        </Button>
      </form>
    </>
  );
}
