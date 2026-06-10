import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  CircleX,
  FileUp,
  Home,
  Search,
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
      { href: "/jobs/completed", label: "Completed", icon: CheckCircle2 },
      { href: "/jobs/cancelled", label: "Cancelled", icon: CircleX },
      { href: "/jobs/ifza-check", label: "IFZA Check", icon: Search },
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
    label: "Admin",
    items: [
      { href: "/users", label: "Users", icon: Users },
      { href: "/reports", label: "Reports", icon: BarChart3 },
    ],
  },
];
