import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/rbac";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <AppShell user={user}>{children}</AppShell>;
}
