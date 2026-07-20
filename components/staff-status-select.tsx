"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import { clearStatusAction, setStatusAction } from "@/app/(app)/team-status/actions";

type JobOpt = { id: string; label: string };

export function StaffStatusSelect({
  currentJobId,
  jobs,
}: {
  currentJobId: string | null;
  jobs: JobOpt[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (jobs.length === 0 && !currentJobId) return null;

  const currentIsListed = currentJobId ? jobs.some((j) => j.id === currentJobId) : true;

  async function handleChange() {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    const jobId = (fd.get("jobId") as string) || null;
    setIsSubmitting(true);
    try {
      if (jobId) await setStatusAction(fd);
      else await clearStatusAction();
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form ref={formRef} className="hidden items-center gap-2 sm:flex">
      <span className="whitespace-nowrap text-xs text-muted-foreground">Working on:</span>
      <Select
        className="max-w-[220px] truncate"
        defaultValue={currentJobId ?? ""}
        disabled={isSubmitting}
        key={currentJobId ?? "idle"}
        name="jobId"
        onChange={handleChange}
        title={jobs.find((j) => j.id === currentJobId)?.label}
      >
        <option value="">Idle</option>
        {!currentIsListed && currentJobId ? <option value={currentJobId}>(current job)</option> : null}
        {jobs.map((job) => (
          <option key={job.id} title={job.label} value={job.id}>
            {job.label}
          </option>
        ))}
      </Select>
    </form>
  );
}
