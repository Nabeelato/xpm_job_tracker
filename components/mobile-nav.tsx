import Link from "next/link";
import { Menu, X } from "lucide-react";
import { NavLinks } from "@/components/nav-links";
import { buttonVariants } from "@/components/ui/button";
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
            <NavLinks unreadCount={unreadCount} />
          </nav>
        </div>
      </div>
    </div>
  );
}
