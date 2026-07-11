import { NextRequest, NextResponse } from "next/server";
import { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  addReportWorksheet,
  buildJobReportWhere,
  createReportWorkbook,
  reportLimitResponse,
  REPORT_EXPORT_LIMIT,
  reportUserScopeWhere,
  roleLabel,
  workbookResponse,
} from "@/lib/reports";
import { getCurrentUser } from "@/lib/rbac";

function workloadJobParams(params: URLSearchParams) {
  const next = new URLSearchParams(params);
  const statusGroup = params.get("statusGroup");

  if (!next.get("jobStateNumber")) {
    if (statusGroup === "workflow") next.set("stateSet", "workflow");
    if (statusGroup === "completed") next.set("stateGroup", "COMPLETED");
    if (statusGroup === "cancelled") next.set("stateGroup", "CANCELLED");
  }
  if (statusGroup === "missing") next.set("missing", "true");

  return next;
}

function userRoleParam(value: string | null): UserRole | null {
  return value && Object.values(UserRole).includes(value as UserRole) ? (value as UserRole) : null;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const jobWhere = buildJobReportWhere(workloadJobParams(params), user, { scope: "report" });
  const role = userRoleParam(params.get("role"));
  const userId = params.get("userId");
  const supervisorId = params.get("supervisorId");
  const userFilters: Prisma.UserWhereInput[] = [reportUserScopeWhere(user)];
  if (role) userFilters.push({ role });
  if (supervisorId) userFilters.push({ OR: [{ id: supervisorId }, { supervisorId }] });

  const where: Prisma.JobAssignmentWhereInput = {
    active: true,
    job: jobWhere,
    ...(userId ? { userId } : {}),
    user: { AND: userFilters },
  };

  const totalAssignments = await prisma.jobAssignment.count({ where });
  if (totalAssignments > REPORT_EXPORT_LIMIT) return reportLimitResponse(totalAssignments);

  const assignments = await prisma.jobAssignment.findMany({
    where,
    take: REPORT_EXPORT_LIMIT,
    select: {
      assignmentRole: true,
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          role: true,
          department: { select: { name: true } },
          supervisor: { select: { name: true } },
        },
      },
      job: {
        select: {
          id: true,
          jobStateNumber: true,
          xpmState: true,
          missingFromLatestImport: true,
          finalDepartment: { select: { code: true, name: true } },
        },
      },
    },
    orderBy: [{ user: { name: "asc" } }, { assignmentRole: "asc" }],
  });

  const grouped = new Map<
    string,
    {
      userName: string;
      username: string;
      role: UserRole;
      department: string;
      supervisor: string;
      uniqueJobs: Set<string>;
      workflowJobs: Set<string>;
      completedJobs: Set<string>;
      cancelledJobs: Set<string>;
      missingJobs: Set<string>;
      managerAssignments: number;
      supervisorAssignments: number;
      staffAssignments: number;
      departments: Map<string, number>;
    }
  >();

  for (const assignment of assignments) {
    const existing = grouped.get(assignment.user.id) ?? {
      userName: assignment.user.name ?? assignment.user.username,
      username: assignment.user.username,
      role: assignment.user.role,
      department: assignment.user.department?.name ?? "",
      supervisor: assignment.user.supervisor?.name ?? "",
      uniqueJobs: new Set<string>(),
      workflowJobs: new Set<string>(),
      completedJobs: new Set<string>(),
      cancelledJobs: new Set<string>(),
      missingJobs: new Set<string>(),
      managerAssignments: 0,
      supervisorAssignments: 0,
      staffAssignments: 0,
      departments: new Map<string, number>(),
    };

    existing.uniqueJobs.add(assignment.job.id);
    const isWorkflowState = [3, 4, 5, 6].includes(assignment.job.jobStateNumber ?? 0) &&
      !assignment.job.xpmState?.includes("3.1") && !assignment.job.xpmState?.includes("3.2");
    if (isWorkflowState) existing.workflowJobs.add(assignment.job.id);
    if (assignment.job.jobStateNumber === 11) existing.completedJobs.add(assignment.job.id);
    if (assignment.job.jobStateNumber === 12) existing.cancelledJobs.add(assignment.job.id);
    if (assignment.job.missingFromLatestImport) existing.missingJobs.add(assignment.job.id);

    if (assignment.assignmentRole === "MANAGER") existing.managerAssignments += 1;
    if (assignment.assignmentRole === "SUPERVISOR") existing.supervisorAssignments += 1;
    if (assignment.assignmentRole === "STAFF") existing.staffAssignments += 1;

    const department = assignment.job.finalDepartment.name;
    existing.departments.set(department, (existing.departments.get(department) ?? 0) + 1);
    grouped.set(assignment.user.id, existing);
  }

  const workbook = createReportWorkbook({
    title: "User Workload Report",
    generatedBy: user.name,
    filters: [
      { label: "Department", value: params.get("department") },
      { label: "User Role", value: params.get("role") },
      { label: "User", value: params.get("userId") },
      { label: "Supervisor", value: params.get("supervisorId") },
      { label: "Status Group", value: params.get("statusGroup") },
      { label: "Assignments Scanned", value: totalAssignments },
    ],
  });

  addReportWorksheet(
    workbook,
    "Workload",
    [
      { header: "User", key: "user", width: 26 },
      { header: "Username", key: "username", width: 18 },
      { header: "User Role", key: "role", width: 16 },
      { header: "Department", key: "department", width: 22 },
      { header: "Supervisor", key: "supervisor", width: 24 },
      { header: "Unique Jobs", key: "uniqueJobs", width: 12 },
      { header: "Workflow Jobs", key: "workflowJobs", width: 14 },
      { header: "Completed Jobs", key: "completedJobs", width: 16 },
      { header: "Cancelled Jobs", key: "cancelledJobs", width: 16 },
      { header: "Missing Latest", key: "missingJobs", width: 14 },
      { header: "As Manager", key: "managerAssignments", width: 12 },
      { header: "As Supervisor", key: "supervisorAssignments", width: 14 },
      { header: "As Staff", key: "staffAssignments", width: 12 },
      { header: "Department Mix", key: "departmentMix", width: 42 },
    ],
    [...grouped.values()].map((row) => ({
      user: row.userName,
      username: row.username,
      role: roleLabel(row.role),
      department: row.department,
      supervisor: row.supervisor,
      uniqueJobs: row.uniqueJobs.size,
      workflowJobs: row.workflowJobs.size,
      completedJobs: row.completedJobs.size,
      cancelledJobs: row.cancelledJobs.size,
      missingJobs: row.missingJobs.size,
      managerAssignments: row.managerAssignments,
      supervisorAssignments: row.supervisorAssignments,
      staffAssignments: row.staffAssignments,
      departmentMix: [...row.departments.entries()].map(([name, count]) => `${name}: ${count}`).join(", "),
    })),
  );

  return workbookResponse(workbook, `user-workload-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
