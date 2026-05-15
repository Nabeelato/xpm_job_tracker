"use client";

import { usePathname } from "next/navigation";
import { navSections } from "@/components/nav-config";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function NavLinks({ unreadCount }: { unreadCount: number }) {
  const pathname = usePathname();
  const allHrefs = navSections.flatMap((s) => s.items.map((i) => i.href));

  function isActive(href: string) {
    if (pathname === href) return true;
    // Only use prefix matching when no other nav item lives under this path.
    const hasNavChildren = allHrefs.some((h) => h !== href && h.startsWith(href + "/"));
    if (hasNavChildren) return false;
    return pathname.startsWith(href + "/");
  }

  return (
    <>
      {navSections.map((section) => (
        <div className="space-y-1" key={section.label}>
          <div className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {section.label}
          </div>
          <div className="space-y-1">
            {section.items.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <a
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  href={item.href}
                  key={item.href}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.href === "/notifications" && unreadCount > 0 ? (
                    <Badge variant="destructive">{unreadCount}</Badge>
                  ) : null}
                </a>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
