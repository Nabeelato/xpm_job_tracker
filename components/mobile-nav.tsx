import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { navSections } from "@/components/nav-config";
import { cn } from "@/lib/utils";

export function MobileNav({ unreadCount }: { unreadCount: number }) {
  return (
    <div className="lg:hidden">
      <input className="peer sr-only" id="mobile-nav-toggle" type="checkbox" />
      <label
        aria-label="Open navigation menu"
        className={cn(buttonVariants({ size: "icon", variant: "ghost" }), "cursor-pointer")}
        htmlFor="mobile-nav-toggle"
      >
        <Menu className="h-5 w-5" />
      </label>

      <div className="fixed inset-0 z-40 hidden peer-checked:block">
        <label aria-label="Close navigation menu" className="absolute inset-0 cursor-pointer bg-slate-950/40" htmlFor="mobile-nav-toggle" />
        <div className="absolute left-0 top-0 flex h-full w-80 max-w-[86vw] flex-col border-r bg-white shadow-2xl">
          <div className="flex h-16 items-center justify-between border-b px-5">
            <Link className="text-base font-semibold" href="/dashboard">
              TI Job Management System
            </Link>
            <label
              aria-label="Close navigation menu"
              className={cn(buttonVariants({ size: "icon", variant: "ghost" }), "cursor-pointer")}
              htmlFor="mobile-nav-toggle"
            >
              <X className="h-5 w-5" />
            </label>
          </div>
          <nav className="flex-1 space-y-4 overflow-y-auto p-3">
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
                      <span className="flex-1">{item.label}</span>
                      {item.href === "/notifications" && unreadCount > 0 ? <Badge variant="destructive">{unreadCount}</Badge> : null}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}
