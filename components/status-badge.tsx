import { Badge } from "@/components/ui/badge";
import { titleCaseEnum } from "@/lib/utils";

export function StatusBadge({ value }: { value: string }) {
  const variant = value === "COMPLETED" ? "success" : value === "ARCHIVED" || value === "ON_HOLD" ? "warning" : "secondary";
  return <Badge variant={variant}>{titleCaseEnum(value)}</Badge>;
}
