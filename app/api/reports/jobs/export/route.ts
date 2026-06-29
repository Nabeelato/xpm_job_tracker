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
import { formatDateTime, titleCaseEnum } from "@/lib/utils";

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

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const scope: JobReportScope = params.get("scope") === "visible" ? "visible" : "report";
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
      priority: true,
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
      { label: "Scope", value: scope === "visible" ? "Current screen visibility" : "Hierarchy report scope" },
      { label: "Search", value: params.get("q") },
      { label: "Department", value: params.get("department") },
      { label: "Client Category", value: clientCategoryFilterLabel(params.get("clientCategory")) },
      { label: "Job State", value: params.get("stateFilter") ?? params.get("jobStateNumber") ?? params.get("stateSet") ?? params.get("stateGroup") },
      { label: "Assigned User", value: params.get("assignedUserId") },
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
      { header: "State No.", key: "stateNo", width: 10 },
      { header: "Priority", key: "priority", width: 14 },
      { header: "Manager", key: "manager", width: 22 },
      { header: "Supervisor", key: "supervisor", width: 22 },
      { header: "Staff", key: "staff", width: 22 },
      { header: "Source Manager", key: "sourceManager", width: 22 },
      { header: "Source Partner", key: "sourcePartner", width: 22 },
      { header: "Client Category", key: "clientCategory", width: 20 },
      { header: "Bookkeeping Software", key: "bookkeepingSoftware", width: 20 },
      { header: "Bookkeeping By", key: "bookkeepingBy", width: 18 },
      { header: "Internal Status", key: "internalStatus", width: 22 },
      { header: "Missing Latest", key: "missingLatest", width: 15 },
      { header: "Archived", key: "archived", width: 12 },
      { header: "State Entered At", key: "stateEnteredAt", width: 22 },
      { header: "Last Seen At", key: "lastSeenAt", width: 22 },
      { header: "Created At", key: "createdAt", width: 22 },
      { header: "Updated At", key: "updatedAt", width: 22 },
    ],
    jobs.map((job) => ({
      jobNo: job.jobIdFromExcel,
      client: job.client.displayName,
      jobName: job.jobName,
      department: job.finalDepartment.name,
      sourceState: job.xpmState ?? "-",
      stateNo: job.jobStateNumber ?? "",
      priority: job.priority ?? "",
      manager: assignmentNames(job.assignments, "MANAGER"),
      supervisor: assignmentNames(job.assignments, "SUPERVISOR"),
      staff: assignmentNames(job.assignments, "STAFF"),
      sourceManager: job.sourceManagerName ?? "",
      sourcePartner: job.sourcePartnerName ?? "",
      clientCategory: job.client.category ? clientCategoryLabels[job.client.category] : "",
      bookkeepingSoftware: job.client.bookkeepingSoftware
        ? bookkeepingSoftwareLabels[job.client.bookkeepingSoftware]
        : "",
      bookkeepingBy: job.client.bookkeepingBy ? bookkeepingByLabels[job.client.bookkeepingBy] : "",
      internalStatus: titleCaseEnum(job.internalStatus),
      missingLatest: job.missingFromLatestImport ? "Yes" : "No",
      archived: job.archived ? "Yes" : "No",
      stateEnteredAt: formatDateTime(job.stateEnteredAt),
      lastSeenAt: formatDateTime(job.lastSeenAt),
      createdAt: formatDateTime(job.createdAt),
      updatedAt: formatDateTime(job.updatedAt),
    })),
  );

  const filename = `jobs-detail-${roleLabel(user.role).toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return workbookResponse(workbook, filename);
}
