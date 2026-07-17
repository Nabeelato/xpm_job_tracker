import { NextRequest, NextResponse } from "next/server";
import type { AssignmentRole } from "@prisma/client";
import { bookkeepingByLabels, bookkeepingSoftwareLabels, clientCategoryLabels } from "@/lib/constants";
import { prisma } from "@/lib/db";
import {
  addReportWorksheet,
  buildJobReportOrderBy,
  buildJobReportWhere,
  createReportWorkbook,
  reportLimitResponse,
  REPORT_EXPORT_LIMIT,
  roleLabel,
  workbookResponse,
  type JobReportScope,
} from "@/lib/reports";
import { getCurrentUser } from "@/lib/rbac";
import { summarizeJobStateTime } from "@/lib/job-state";
import { formatDateTime, formatElapsedMilliseconds, titleCaseEnum } from "@/lib/utils";

function assignmentNames(
  assignments: Array<{ assignmentRole: AssignmentRole; user: { name: string | null } }>,
  role: AssignmentRole,
) {
  return assignments
    .filter((assignment) => assignment.assignmentRole === role)
    .map((assignment) => assignment.user.name)
    .filter(Boolean)
    .join(", ");
}

function clientCategoryFilterLabel(value: string | null | undefined) {
  if (value === "SOFTWARE" || value === "category_software") return clientCategoryLabels.SOFTWARE;
  if (value === "MANUAL" || value === "category_manual") return clientCategoryLabels.MANUAL;
  if (value === "uncategorized" || value === "category_uncategorized") return "Uncategorized";
  return value;
}

function assignmentFilterLabel(value: string) {
  if (value === "unassigned") return "Unassigned";
  return value;
}

function joinParamValues(params: URLSearchParams, key: string, mapValue?: (value: string) => string) {
  const values = Array.from(
    new Set(
      params
        .getAll(key)
        .flatMap((value) => value.split(","))
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
  if (!values.length) return null;
  return values.map((value) => (mapValue ? mapValue(value) : value)).join(", ");
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const requestedScope = params.get("scope");
  const scope: JobReportScope = requestedScope === "all" ? "all" : requestedScope === "visible" ? "visible" : "report";
  const where = buildJobReportWhere(params, user, { scope });
  const total = await prisma.job.count({ where });

  if (total > REPORT_EXPORT_LIMIT) return reportLimitResponse(total);

  const jobs = await prisma.job.findMany({
    where,
    orderBy: buildJobReportOrderBy(params),
    take: REPORT_EXPORT_LIMIT,
    select: {
      jobIdFromExcel: true,
      jobName: true,
      xpmState: true,
      jobStateNumber: true,
      sourceManagerName: true,
      sourcePartnerName: true,
      internalStatus: true,
      missingFromLatestImport: true,
      archived: true,
      stateEnteredAt: true,
      lastSeenAt: true,
      createdAt: true,
      updatedAt: true,
      client: {
        select: {
          displayName: true,
          category: true,
          bookkeepingSoftware: true,
          bookkeepingBy: true,
        },
      },
      finalDepartment: { select: { code: true, name: true } },
      stateTimeRecords: {
        where: { stateNumber: { gte: 1, lte: 6 } },
        select: { stateNumber: true, enteredAt: true, exitedAt: true },
      },
      assignments: {
        where: { active: true },
        select: {
          assignmentRole: true,
          assignedAt: true,
          user: { select: { name: true } },
        },
        orderBy: { assignedAt: "desc" },
      },
    },
  });

  const workbook = createReportWorkbook({
    title: "Jobs Detail Report",
    generatedBy: user.name,
    filters: [
      {
        label: "Scope",
        value: scope === "all" ? "All jobs" : scope === "visible" ? "Current screen visibility" : "Hierarchy report scope",
      },
      { label: "Search", value: params.get("q") },
      { label: "Department", value: joinParamValues(params, "department") },
      { label: "Staff", value: joinParamValues(params, "staffUserId", assignmentFilterLabel) },
      { label: "Manager", value: joinParamValues(params, "managerUserId", assignmentFilterLabel) },
      { label: "Supervisor", value: joinParamValues(params, "supervisorUserId", assignmentFilterLabel) },
      { label: "Client Category", value: joinParamValues(params, "clientCategory", (value) => clientCategoryFilterLabel(value) ?? value) },
      {
        label: "Job State",
        value:
          joinParamValues(params, "stateFilter", (value) => {
            if (value === "main") return "Main 02-06";
            if (value === "workflow") return "Workflow 03-06";
            if (value === "other") return "Other states";
            if (value === "completed") return "Completed";
            if (value === "cancelled") return "Cancelled";
            return value;
          }) ?? joinParamValues(params, "jobStateNumber") ?? joinParamValues(params, "stateNumbers") ?? params.get("stateSet") ?? params.get("stateGroup"),
      },
      { label: "Assigned User", value: joinParamValues(params, "assignedUserId", (value) => (value === "unassigned" ? "Unassigned" : value)) },
      { label: "Missing", value: params.get("missing") },
      { label: "Archived", value: params.get("archived") ?? "false" },
      { label: "Sort", value: params.get("sortBy") ? `${params.get("sortBy")} ${params.get("sortDir") ?? "asc"}` : null },
      { label: "Rows", value: total },
    ],
  });

  addReportWorksheet(
    workbook,
    "Jobs",
    [
      { header: "Job No.", key: "jobNo", width: 16 },
      { header: "Client", key: "client", width: 32 },
      { header: "Job Name", key: "jobName", width: 42 },
      { header: "Department", key: "department", width: 22 },
      { header: "Source State", key: "sourceState", width: 32 },
      { header: "Client Category", key: "clientCategory", width: 20 },
      { header: "Bookkeeping Software", key: "bookkeepingSoftware", width: 20 },
      { header: "Bookkeeping By", key: "bookkeepingBy", width: 18 },
      { header: "State Idle Time", key: "stateIdleTime", width: 18 },
      { header: "Manager", key: "manager", width: 22 },
      { header: "Supervisor", key: "supervisor", width: 22 },
      { header: "Staff", key: "staff", width: 22 },
      { header: "Source Manager", key: "sourceManager", width: 22 },
      { header: "Source Partner", key: "sourcePartner", width: 22 },
      { header: "Internal Status", key: "internalStatus", width: 22 },
      { header: "Missing Latest", key: "missingLatest", width: 15 },
      { header: "Archived", key: "archived", width: 12 },
      { header: "State Entered At", key: "stateEnteredAt", width: 22 },
      { header: "Last Seen At", key: "lastSeenAt", width: 22 },
      { header: "Created At", key: "createdAt", width: 22 },
      { header: "Updated At", key: "updatedAt", width: 22 },
    ],
    jobs.map((job) => {
      const stateTime = summarizeJobStateTime(job.stateTimeRecords, job.jobStateNumber);
      const activeElapsedMs = stateTime.activeEnteredAt
        ? Math.max(0, Date.now() - stateTime.activeEnteredAt.getTime())
        : 0;
      const stateIdleTime = job.jobStateNumber !== null && job.jobStateNumber >= 1 && job.jobStateNumber <= 6
        ? `State ${job.jobStateNumber} · ${formatElapsedMilliseconds(stateTime.accumulatedMs + activeElapsedMs)}`
        : "";
      return {
        jobNo: job.jobIdFromExcel,
        client: job.client.displayName,
        jobName: job.jobName,
        department: job.finalDepartment.name,
        sourceState: job.xpmState ?? "-",
        clientCategory: job.client.category ? clientCategoryLabels[job.client.category] : "",
        bookkeepingSoftware: job.client.bookkeepingSoftware
          ? bookkeepingSoftwareLabels[job.client.bookkeepingSoftware]
          : "",
        bookkeepingBy: job.client.bookkeepingBy ? bookkeepingByLabels[job.client.bookkeepingBy] : "",
        stateIdleTime,
        manager: assignmentNames(job.assignments, "MANAGER"),
        supervisor: assignmentNames(job.assignments, "SUPERVISOR"),
        staff: assignmentNames(job.assignments, "STAFF"),
        sourceManager: job.sourceManagerName ?? "",
        sourcePartner: job.sourcePartnerName ?? "",
        internalStatus: titleCaseEnum(job.internalStatus),
        missingLatest: job.missingFromLatestImport ? "Yes" : "No",
        archived: job.archived ? "Yes" : "No",
        stateEnteredAt: formatDateTime(job.stateEnteredAt),
        lastSeenAt: formatDateTime(job.lastSeenAt),
        createdAt: formatDateTime(job.createdAt),
        updatedAt: formatDateTime(job.updatedAt),
      };
    }),
  );

  const filename = `jobs-detail-${roleLabel(user.role).toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return workbookResponse(workbook, filename);
}
