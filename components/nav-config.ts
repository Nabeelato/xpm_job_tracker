import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Clock,
  ClipboardList,
  FileUp,
  Home,
  ListChecks,
  Users,
  XCircle,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

export const navSections: NavSection[] = [
  {
    label: "Work",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: Home },
      { href: "/jobs", label: "All Jobs", icon: BriefcaseBusiness },
      { href: "/jobs/my", label: "My Jobs", icon: ListChecks },
      { href: "/jobs/stale-48", label: "Stale Jobs", icon: Clock },
      { href: "/jobs/completed", label: "Completed Jobs", icon: CheckCircle2 },
      { href: "/jobs/cancelled", label: "Cancelled Jobs", icon: XCircle },
    ],
  },
  {
    label: "Browse",
    items: [
      { href: "/clients", label: "Clients", icon: Building2 },
      { href: "/imports", label: "Imports", icon: FileUp },
      { href: "/assignments", label: "Assignments", icon: ClipboardList },
      { href: "/notifications", label: "Notifications", icon: Bell },
      { href: "/diary", label: "Diary", icon: BookOpen },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/users", label: "Users", icon: Users },
      { href: "/reports", label: "Reports", icon: BarChart3 },
    ],
  },
];
