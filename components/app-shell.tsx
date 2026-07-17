import Link from "next/link";
import { MobileNav } from "@/components/mobile-nav";
import { NavLinks } from "@/components/nav-links";
import { LogoutButton } from "@/components/logout-button";
import { prisma } from "@/lib/db";
import type { AppSessionUser } from "@/lib/rbac";

export async function AppShell({ user, children }: { user: AppSessionUser; children: React.ReactNode }) {
  const unreadCount = await prisma.notification.count({ where: { recipientId: user.id, readAt: null } });

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col overflow-hidden border-r bg-white lg:flex">
        <div className="flex h-16 shrink-0 items-center border-b px-5">
          <Link className="text-base font-semibold" href="/dashboard">
            TI Job Management System
          </Link>
        </div>
        <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-3">
          <NavLinks role={user.role} unreadCount={unreadCount} />
        </nav>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-white px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <MobileNav role={user.role} unreadCount={unreadCount} />
            <Link className="font-semibold lg:hidden" href="/dashboard">
              TI Job Management System
            </Link>
            <div className="hidden text-sm text-muted-foreground lg:block">Simple job management workspace</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-medium">{user.name}</div>
              <div className="text-xs text-muted-foreground">{user.role}</div>
            </div>
            <LogoutButton />
          </div>
        </header>
        <main className="px-4 py-6 lg:px-6">{children}</main>
      </div>
    </div>
  );
}
