import { NextRequest, NextResponse } from "next/server";
import type { AssignmentRole, Prisma, UserRole } from "@prisma/client";
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
import { titleCaseEnum } from "@/lib/utils";

const assignmentRoleOrder: AssignmentRole[] = ["MANAGER", "SUPERVISOR", "STAFF"];

type UserJob = {
  id: string;
  jobNo: string;
  client: string;
  jobName: string;
  department: string;
  stateNumber: number | null;
  sourceState: string | null;
  internalStatus: string;
  missingLatest: boolean;
  roles: Set<AssignmentRole>;
  firstAssignedAt: Date;
};

type WorkloadUser = {
  userName: string;
  username: string;
  role: UserRole;
  department: string;
  supervisor: string;
  jobs: Map<string, UserJob>;
};

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
  return value && ["ADMIN", "MANAGER", "SUPERVISOR", "STAFF"].includes(value) ? (value as UserRole) : null;
}

function uniqueWorksheetName(preferred: string, fallback: string, usedNames: Set<string>) {
  const cleaned = preferred
    .replace(/[\\/?*\[\]:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^'+|'+$/g, "");
  const base = (cleaned || fallback).slice(0, 31) || "User";
  let candidate = base;
  let suffixNumber = 2;

  while (usedNames.has(candidate.toLowerCase())) {
    const suffix = ` (${suffixNumber})`;
    candidate = `${base.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`;
    suffixNumber += 1;
  }

  usedNames.add(candidate.toLowerCase());
  return candidate;
}

function quotedSheetName(name: string) {
  return `'${name.replace(/'/g, "''")}'`;
}

function formulaCriterion(value: string) {
  return value.replace(/"/g, '""');
}

function isWorkflowJob(job: UserJob) {
  return [3, 4, 5, 6].includes(job.stateNumber ?? 0) &&
    !job.sourceState?.includes("3.1") &&
    !job.sourceState?.includes("3.2");
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
  if (userId) userFilters.push({ id: userId });

  const [reportUsers, departments] = await Promise.all([
    prisma.user.findMany({
      where: { active: true, AND: userFilters },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        department: { select: { name: true } },
        supervisor: { select: { name: true } },
      },
      orderBy: [{ name: "asc" }, { username: "asc" }],
    }),
    prisma.department.findMany({
      where: { active: true },
      select: { code: true, name: true },
      orderBy: { code: "asc" },
    }),
  ]);

  const reportUserIds = reportUsers.map((reportUser) => reportUser.id);
  const assignmentWhere: Prisma.JobAssignmentWhereInput = {
    active: true,
    job: jobWhere,
    userId: { in: reportUserIds.length ? reportUserIds : ["__none__"] },
  };

  const totalAssignments = reportUserIds.length
    ? await prisma.jobAssignment.count({ where: assignmentWhere })
    : 0;
  if (totalAssignments > REPORT_EXPORT_LIMIT) return reportLimitResponse(totalAssignments);

  const assignments = reportUserIds.length
    ? await prisma.jobAssignment.findMany({
        where: assignmentWhere,
        take: REPORT_EXPORT_LIMIT,
        select: {
          userId: true,
          assignmentRole: true,
          assignedAt: true,
          job: {
            select: {
              id: true,
              jobIdFromExcel: true,
              jobName: true,
              jobStateNumber: true,
              xpmState: true,
              internalStatus: true,
              missingFromLatestImport: true,
              client: { select: { displayName: true } },
              finalDepartment: { select: { name: true } },
            },
          },
        },
        orderBy: [{ userId: "asc" }, { job: { jobIdFromExcel: "asc" } }],
      })
    : [];

  const grouped = new Map<string, WorkloadUser>(
    reportUsers.map((reportUser) => [
      reportUser.id,
      {
        userName: reportUser.name ?? reportUser.username,
        username: reportUser.username,
        role: reportUser.role,
        department: reportUser.department?.name ?? "",
        supervisor: reportUser.supervisor?.name ?? "",
        jobs: new Map<string, UserJob>(),
      },
    ]),
  );

  for (const assignment of assignments) {
    const reportUser = grouped.get(assignment.userId);
    if (!reportUser) continue;

    const existingJob = reportUser.jobs.get(assignment.job.id);
    if (existingJob) {
      existingJob.roles.add(assignment.assignmentRole);
      if (assignment.assignedAt < existingJob.firstAssignedAt) existingJob.firstAssignedAt = assignment.assignedAt;
      continue;
    }

    reportUser.jobs.set(assignment.job.id, {
      id: assignment.job.id,
      jobNo: assignment.job.jobIdFromExcel,
      client: assignment.job.client.displayName,
      jobName: assignment.job.jobName,
      department: assignment.job.finalDepartment.name,
      stateNumber: assignment.job.jobStateNumber,
      sourceState: assignment.job.xpmState,
      internalStatus: assignment.job.internalStatus,
      missingLatest: assignment.job.missingFromLatestImport,
      roles: new Set([assignment.assignmentRole]),
      firstAssignedAt: assignment.assignedAt,
    });
  }

  const selectedUserName = userId ? grouped.get(userId)?.userName : null;
  const selectedSupervisorName = supervisorId ? reportUsers.find((reportUser) => reportUser.id === supervisorId)?.name : null;
  const workbook = createReportWorkbook({
    title: "User Workload Report",
    generatedBy: user.name,
    filters: [
      { label: "Department", value: params.get("department") },
      { label: "User Role", value: params.get("role") },
      { label: "User", value: selectedUserName ?? params.get("userId") },
      { label: "Supervisor", value: selectedSupervisorName ?? params.get("supervisorId") },
      { label: "Status Group", value: params.get("statusGroup") },
      { label: "Users Included", value: reportUsers.length },
      { label: "Assignments Scanned", value: totalAssignments },
    ],
  });
  workbook.calcProperties.fullCalcOnLoad = true;

  const usedSheetNames = new Set(["summary"]);
  const sheetNameByUserId = new Map<string, string>();
  reportUsers.forEach((reportUser, index) => {
    sheetNameByUserId.set(
      reportUser.id,
      uniqueWorksheetName(reportUser.name ?? reportUser.username, `User ${index + 1}`, usedSheetNames),
    );
  });

  for (const reportUser of reportUsers) {
    const groupedUser = grouped.get(reportUser.id);
    const sheetName = sheetNameByUserId.get(reportUser.id);
    if (!groupedUser || !sheetName) continue;

    const jobs = [...groupedUser.jobs.values()].sort((left, right) =>
      left.department.localeCompare(right.department) || left.jobNo.localeCompare(right.jobNo),
    );
    addReportWorksheet(
      workbook,
      sheetName,
      [
        { header: "Job No.", key: "jobNo", width: 16 },
        { header: "Client", key: "client", width: 30 },
        { header: "Job Name", key: "jobName", width: 42 },
        { header: "Department", key: "department", width: 22 },
        { header: "Assignment Role(s)", key: "assignmentRoles", width: 22 },
        { header: "State Number", key: "stateNumber", width: 14, numFmt: "0" },
        { header: "Source State", key: "sourceState", width: 32 },
        { header: "Internal Status", key: "internalStatus", width: 22 },
        { header: "Missing Latest", key: "missingLatest", width: 15 },
        { header: "First Assigned At", key: "firstAssignedAt", width: 22, numFmt: "yyyy-mm-dd hh:mm" },
      ],
      jobs.map((job) => ({
        jobNo: job.jobNo,
        client: job.client,
        jobName: job.jobName,
        department: job.department,
        assignmentRoles: assignmentRoleOrder
          .filter((assignmentRole) => job.roles.has(assignmentRole))
          .map((assignmentRole) => roleLabel(assignmentRole))
          .join(", "),
        stateNumber: job.stateNumber,
        sourceState: job.sourceState ?? "",
        internalStatus: titleCaseEnum(job.internalStatus),
        missingLatest: job.missingLatest ? "Yes" : "No",
        firstAssignedAt: job.firstAssignedAt,
      })),
    );
  }

  const summary = workbook.getWorksheet("Summary");
  if (!summary) throw new Error("The report summary worksheet could not be created.");

  const summaryStartRow = summary.rowCount + 2;
  const fixedSummaryColumns = [
    { header: "User", width: 26 },
    { header: "Username", width: 18 },
    { header: "User Role", width: 16 },
    { header: "Home Department", width: 22 },
    { header: "Supervisor", width: 24 },
    { header: "Total Jobs", width: 12 },
  ];
  const departmentSummaryColumns = departments.map((department) => ({
    header: `${department.name} Jobs`,
    width: Math.max(14, Math.min(26, department.name.length + 7)),
    departmentName: department.name,
  }));
  const trailingSummaryColumns = [
    { header: "Workflow Jobs", width: 14 },
    { header: "Completed Jobs", width: 16 },
    { header: "Cancelled Jobs", width: 16 },
    { header: "Missing Latest", width: 14 },
    { header: "As Manager", width: 12 },
    { header: "As Supervisor", width: 14 },
    { header: "As Staff", width: 12 },
  ];
  const summaryColumns = [...fixedSummaryColumns, ...departmentSummaryColumns, ...trailingSummaryColumns];
  const summaryHeader = summary.getRow(summaryStartRow);
  summaryHeader.values = summaryColumns.map((column) => column.header);
  summaryHeader.height = 24;
  summaryHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
  summaryHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
  summaryHeader.alignment = { vertical: "middle", wrapText: true };

  summaryColumns.forEach((column, index) => {
    summary.getColumn(index + 1).width = Math.max(summary.getColumn(index + 1).width ?? 0, column.width);
  });

  reportUsers.forEach((reportUser, index) => {
    const groupedUser = grouped.get(reportUser.id);
    const sheetName = sheetNameByUserId.get(reportUser.id);
    if (!groupedUser || !sheetName) return;

    const jobs = [...groupedUser.jobs.values()];
    const detailEndRow = Math.max(2, jobs.length + 1);
    const sheetReference = quotedSheetName(sheetName);
    const row = summary.getRow(summaryStartRow + index + 1);
    row.getCell(1).value = { text: groupedUser.userName, hyperlink: `#${sheetReference}!A1` };
    row.getCell(1).font = { color: { argb: "FF2563EB" }, underline: true };
    row.getCell(2).value = groupedUser.username;
    row.getCell(3).value = roleLabel(groupedUser.role);
    row.getCell(4).value = groupedUser.department;
    row.getCell(5).value = groupedUser.supervisor;
    row.getCell(6).value = {
      formula: `COUNTA(${sheetReference}!$A$2:$A$${detailEndRow})`,
      result: jobs.length,
    };

    departmentSummaryColumns.forEach((column, departmentIndex) => {
      const result = jobs.filter((job) => job.department === column.departmentName).length;
      row.getCell(7 + departmentIndex).value = {
        formula: `COUNTIF(${sheetReference}!$D$2:$D$${detailEndRow},"${formulaCriterion(column.departmentName)}")`,
        result,
      };
    });

    const trailingStart = 7 + departmentSummaryColumns.length;
    const workflowCount = jobs.filter(isWorkflowJob).length;
    const completedCount = jobs.filter((job) => job.stateNumber === 11).length;
    const cancelledCount = jobs.filter((job) => job.stateNumber === 12).length;
    const missingCount = jobs.filter((job) => job.missingLatest).length;
    row.getCell(trailingStart).value = {
      formula: `COUNTIFS(${sheetReference}!$F$2:$F$${detailEndRow},">=3",${sheetReference}!$F$2:$F$${detailEndRow},"<=6",${sheetReference}!$G$2:$G$${detailEndRow},"<>*3.1*",${sheetReference}!$G$2:$G$${detailEndRow},"<>*3.2*")`,
      result: workflowCount,
    };
    row.getCell(trailingStart + 1).value = {
      formula: `COUNTIF(${sheetReference}!$F$2:$F$${detailEndRow},11)`,
      result: completedCount,
    };
    row.getCell(trailingStart + 2).value = {
      formula: `COUNTIF(${sheetReference}!$F$2:$F$${detailEndRow},12)`,
      result: cancelledCount,
    };
    row.getCell(trailingStart + 3).value = {
      formula: `COUNTIF(${sheetReference}!$J$2:$J$${detailEndRow},"Yes")`,
      result: missingCount,
    };
    assignmentRoleOrder.forEach((assignmentRole, roleIndex) => {
      row.getCell(trailingStart + 4 + roleIndex).value = {
        formula: `COUNTIF(${sheetReference}!$E$2:$E$${detailEndRow},"*${roleLabel(assignmentRole)}*")`,
        result: jobs.filter((job) => job.roles.has(assignmentRole)).length,
      };
    });

    row.eachCell((cell) => {
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = { bottom: { style: "thin", color: { argb: "FFE5E7EB" } } };
      if (index % 2 === 1 && !cell.fill) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
      }
    });
  });

  summary.views = [{ state: "frozen", ySplit: summaryStartRow }];
  summary.autoFilter = {
    from: { row: summaryStartRow, column: 1 },
    to: { row: summaryStartRow, column: summaryColumns.length },
  };

  return workbookResponse(workbook, `user-workload-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
