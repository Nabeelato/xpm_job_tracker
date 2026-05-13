import Link from "next/link";
import { MobileNav } from "@/components/mobile-nav";
import { navSections } from "@/components/nav-config";
import { LogoutButton } from "@/components/logout-button";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import type { AppSessionUser } from "@/lib/rbac";

export async function AppShell({ user, children }: { user: AppSessionUser; children: React.ReactNode }) {
  const unreadCount = await prisma.notification.count({ where: { recipientId: user.id, readAt: null } });

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-white lg:block">
        <div className="flex h-16 items-center border-b px-5">
          <Link className="text-base font-semibold" href="/dashboard">
            TI Job Management System
          </Link>
        </div>
        <nav className="space-y-4 p-3">
          {navSections.map((section) => (
            <div className="space-y-1" key={section.label}>
              <div className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{section.label}</div>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <Link
                    className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                    href={item.href}
                    key={item.href}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                    {item.href === "/notifications" && unreadCount > 0 ? <Badge variant="destructive">{unreadCount}</Badge> : null}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-white px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <MobileNav unreadCount={unreadCount} />
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
