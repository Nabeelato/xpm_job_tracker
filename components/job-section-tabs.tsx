"use client";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const JOB_TABS = [
  { key: "all",       label: "All Jobs"   },
  { key: "my",        label: "My Jobs"    },
  { key: "completed", label: "Completed"  },
  { key: "cancelled", label: "Cancelled"  },
] as const;

export type JobTabKey = (typeof JOB_TABS)[number]["key"];

const jobTabHref: Record<JobTabKey, string> = {
  all: "/jobs",
  my: "/jobs/my",
  completed: "/jobs/completed",
  cancelled: "/jobs/cancelled",
};

export function JobSectionTabs({ activeTab }: { activeTab: string }) {
  return (
    <div className="mb-4 flex gap-1.5 overflow-x-auto rounded-lg border bg-white p-2">
      {JOB_TABS.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <a
            aria-current={isActive ? "page" : undefined}
            className={cn(
              buttonVariants({ variant: isActive ? "default" : "ghost", size: "sm" }),
              "shrink-0",
            )}
            href={jobTabHref[tab.key]}
            key={tab.key}
          >
            {tab.label}
          </a>
        );
      })}
    </div>
  );
}
