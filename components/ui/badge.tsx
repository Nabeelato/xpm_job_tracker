import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-muted text-muted-foreground",
        outline: "text-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        vat: "border-teal-200 bg-teal-50 text-teal-800",
        softwareBk: "border-sky-200 bg-sky-50 text-sky-800",
        bk: "border-amber-200 bg-amber-50 text-amber-800",
        afs: "border-indigo-200 bg-indigo-50 text-indigo-800",
        qc: "border-rose-200 bg-rose-50 text-rose-800",
        unclassified: "border-zinc-200 bg-zinc-100 text-zinc-700",
        success: "border-emerald-200 bg-emerald-50 text-emerald-800",
        warning: "border-orange-200 bg-orange-50 text-orange-800",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
