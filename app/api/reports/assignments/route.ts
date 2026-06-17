import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  addReportWorksheet,
  createReportWorkbook,
  invalidDateResponse,
  parseDateBoundary,
  reportLimitResponse,
  REPORT_EXPORT_LIMIT,
  reportScopeWhere,
  workbookResponse,
} from "@/lib/reports";
import { getCurrentUser } from "@/lib/rbac";
import { formatDateTime } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const fromDate = searchParams.get("from") ?? undefined;
  const toDate = searchParams.get("to") ?? undefined;
  const roleFilter = searchParams.get("role") ?? undefined;
  const nameSearch = searchParams.get("name") ?? undefined;
  const changedById = searchParams.get("changedById") ?? undefined;
  const from = parseDateBoundary(fromDate);
  const to = parseDateBoundary(toDate, true);

  if (from === "invalid") return invalidDateResponse("From");
  if (to === "invalid") return invalidDateResponse("To");

  const where: Prisma.JobChangeLogWhereInput = {
    job: reportScopeWhere(user),
    fieldName: roleFilter === "supervisor"
      ? "supervisor_assignment"
      : roleFilter === "staff"
        ? "staff_assignment"
        : { in: ["supervisor_assignment", "staff_assignment"] },
    ...(from || to
      ? {
          changedAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
    ...(changedById ? { changedById } : {}),
    ...(nameSearch
      ? {
          OR: [
            { oldValue: { contains: nameSearch, mode: "insensitive" as const } },
            { newValue: { contains: nameSearch, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const total = await prisma.jobChangeLog.count({ where });
  if (total > REPORT_EXPORT_LIMIT) return reportLimitResponse(total);

  const logs = await prisma.jobChangeLog.findMany({
    where,
    orderBy: { changedAt: "desc" },
    take: REPORT_EXPORT_LIMIT,
    select: {
      changedAt: true,
      fieldName: true,
      oldValue: true,
      newValue: true,
      changedBy: { select: { name: true } },
      job: {
        select: {
          jobIdFromExcel: true,
          client: { select: { displayName: true } },
        },
      },
    },
  });

  const workbook = createReportWorkbook({
    title: "Assignment Change History",
    generatedBy: user.name,
    filters: [
      { label: "From", value: fromDate },
      { label: "To", value: toDate },
      { label: "Role", value: roleFilter },
      { label: "Name Search", value: nameSearch },
      { label: "Changed By", value: changedById },
      { label: "Rows", value: total },
    ],
  });

  addReportWorksheet(
    workbook,
    "Assignment History",
    [
      { header: "Date", key: "date", width: 22 },
      { header: "Job No.", key: "jobNo", width: 16 },
      { header: "Client", key: "client", width: 34 },
      { header: "Role", key: "role", width: 14 },
      { header: "Assigned From", key: "assignedFrom", width: 24 },
      { header: "Assigned To", key: "assignedTo", width: 24 },
      { header: "Changed By", key: "changedBy", width: 24 },
    ],
    logs.map((log) => ({
      date: formatDateTime(log.changedAt),
      jobNo: log.job.jobIdFromExcel,
      client: log.job.client.displayName,
      role: log.fieldName === "supervisor_assignment" ? "Supervisor" : "Staff",
      assignedFrom: log.oldValue ?? "",
      assignedTo: log.newValue ?? "Unassigned",
      changedBy: log.changedBy?.name ?? "",
    })),
  );

  return workbookResponse(workbook, `assignment-history-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
