import { Badge } from "@/components/ui/badge";

export function DepartmentBadge({ code }: { code?: string | null }) {
  const normalized = code ?? "UNCLASSIFIED";
  const variant =
    normalized === "VAT"
      ? "vat"
      : normalized === "SOFTWARE_BK"
        ? "softwareBk"
        : normalized === "BK"
          ? "bk"
          : normalized === "AFS"
            ? "afs"
            : normalized === "QC"
              ? "qc"
              : "unclassified";

  const label = normalized === "UNCLASSIFIED" ? "Unclassified" : normalized === "SOFTWARE_BK" ? "Software BK" : normalized;
  return <Badge variant={variant}>{label}</Badge>;
}
