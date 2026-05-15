import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  CircleX,
  Clock,
  FileUp,
  Home,
  SquareCheckBig,
  User,
  Users,
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
    ],
  },
  {
    label: "Jobs",
    items: [
      { href: "/jobs", label: "All Jobs", icon: BriefcaseBusiness },
      { href: "/jobs/my", label: "My Jobs", icon: User },
      { href: "/jobs/stale-48", label: "Stale 48h+", icon: Clock },
      { href: "/jobs/completed", label: "Completed", icon: CheckCircle2 },
      { href: "/jobs/cancelled", label: "Cancelled", icon: CircleX },
    ],
  },
  {
    label: "Browse",
    items: [
      { href: "/clients", label: "Clients", icon: Building2 },
      { href: "/imports", label: "Imports", icon: FileUp },
      { href: "/assignments/bulk", label: "Job Assignments", icon: SquareCheckBig },
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
