"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type HierarchyUser = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  departmentId: string | null;
  supervisorId: string | null;
  active: boolean;
};

const roleColors: Record<string, string> = {
  ADMIN: "bg-red-100 text-red-800",
  MANAGER: "bg-blue-100 text-blue-800",
  SUPERVISOR: "bg-purple-100 text-purple-800",
  STAFF: "bg-green-100 text-green-800",
};

function UserNode({
  user,
  depth,
  deptById,
  nameById,
  children,
}: {
  user: HierarchyUser;
  depth: number;
  deptById: Map<string, string>;
  nameById: Map<string, string | null>;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-3 border-b py-2 text-sm last:border-0",
          !user.active && "opacity-40",
        )}
        style={{ paddingLeft: `${depth * 1.5}rem` }}
      >
        {depth > 0 && (
          <span className="select-none text-muted-foreground">
            {"└─ "}
          </span>
        )}
        <span className="font-medium">{user.name ?? user.email}</span>
        <span className="text-xs text-muted-foreground">{user.email}</span>
        <Badge className={cn("text-xs", roleColors[user.role] ?? "")} variant="outline">
          {user.role}
        </Badge>
        {user.departmentId && (
          <span className="text-xs text-muted-foreground">{deptById.get(user.departmentId)}</span>
        )}
        {!user.active && <span className="text-xs text-red-500">(inactive)</span>}
      </div>
      {children}
    </div>
  );
}

export function HierarchyView({
  users,
  departments,
}: {
  users: HierarchyUser[];
  departments: { id: string; name: string }[];
}) {
  const deptById = new Map(departments.map((d) => [d.id, d.name]));
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  // Build children map: parentId → direct reports
  const childrenOf = new Map<string | null, HierarchyUser[]>();
  for (const u of users) {
    const key = u.supervisorId ?? null;
    const list = childrenOf.get(key) ?? [];
    list.push(u);
    childrenOf.set(key, list);
  }

  // Roots: users with no supervisor
  const roots = childrenOf.get(null) ?? [];

  function renderSubtree(user: HierarchyUser, depth: number): React.ReactNode {
    const reports = childrenOf.get(user.id) ?? [];
    return (
      <UserNode deptById={deptById} depth={depth} key={user.id} nameById={nameById} user={user}>
        {reports.map((child) => renderSubtree(child, depth + 1))}
      </UserNode>
    );
  }

  // Detect orphaned users: users whose supervisorId points to a non-existent user
  const userIds = new Set(users.map((u) => u.id));
  const orphans = users.filter((u) => u.supervisorId && !userIds.has(u.supervisorId));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Org Hierarchy</CardTitle>
      </CardHeader>
      <CardContent>
        {roots.length === 0 && orphans.length === 0 && (
          <p className="text-sm text-muted-foreground">No users found.</p>
        )}
        {roots.map((root) => renderSubtree(root, 0))}
        {orphans.length > 0 && (
          <div className="mt-4">
            <div className="mb-1 text-xs font-medium text-muted-foreground">
              Users with missing supervisor
            </div>
            {orphans.map((u) => (
              <UserNode deptById={deptById} depth={0} key={u.id} nameById={nameById} user={u} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
