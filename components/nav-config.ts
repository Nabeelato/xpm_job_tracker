import type { LucideIcon } from "lucide-react";
import type { UserRole } from "@prisma/client";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  CircleX,
  FileUp,
  Home,
  Inbox,
  Network,
  TriangleAlert,
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
  roles?: UserRole[];
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
      { href: "/jobs/queue", label: "Available Queue", icon: Inbox },
      { href: "/jobs/my", label: "My Jobs", icon: User },
      { href: "/jobs/completed", label: "Completed", icon: CheckCircle2 },
      { href: "/jobs/cancelled", label: "Cancelled", icon: CircleX },
    ],
  },
  {
    label: "Browse",
    items: [
      { href: "/clients", label: "Clients", icon: Building2 },
      { href: "/imports", label: "Imports", icon: FileUp },
      { href: "/notifications", label: "Notifications", icon: Bell },
      { href: "/diary", label: "Diary", icon: BookOpen },
    ],
  },
  {
    label: "Team",
    roles: ["ADMIN", "MANAGER", "SUPERVISOR"],
    items: [
      { href: "/team-status", label: "Staff Status", icon: Activity },
      { href: "/reports/hierarchy", label: "Job Hierarchy", icon: Network },
    ],
  },
  {
    label: "Admin",
    roles: ["ADMIN"],
    items: [
      { href: "/users", label: "Users", icon: Users },
      { href: "/reports/exceptions", label: "Exception Reports", icon: TriangleAlert },
      { href: "/reports/bk-conflicts", label: "BK/Software Conflicts", icon: TriangleAlert },
      { href: "/reports", label: "Reports", icon: BarChart3 },
    ],
  },
];
