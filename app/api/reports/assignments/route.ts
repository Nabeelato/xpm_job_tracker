import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const fromDate = searchParams.get("from") ?? undefined;
  const toDate = searchParams.get("to") ?? undefined;
  const roleFilter = searchParams.get("role") ?? undefined;
  const nameSearch = searchParams.get("name") ?? undefined;

  const where: Prisma.JobChangeLogWhereInput = {
    fieldName: roleFilter === "supervisor"
      ? "supervisor_assignment"
      : roleFilter === "staff"
        ? "staff_assignment"
        : { in: ["supervisor_assignment", "staff_assignment"] },
    ...(fromDate || toDate
      ? {
          changedAt: {
            ...(fromDate ? { gte: new Date(fromDate) } : {}),
            ...(toDate ? { lte: new Date(`${toDate}T23:59:59`) } : {}),
          },
        }
      : {}),
    ...(nameSearch
      ? {
          OR: [
            { oldValue: { contains: nameSearch, mode: "insensitive" as const } },
            { newValue: { contains: nameSearch, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const logs = await prisma.jobChangeLog.findMany({
    where,
    orderBy: { changedAt: "desc" },
    take: 5000,
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

  const rows = logs.map((log) => ({
    Date: new Date(log.changedAt).toLocaleString("en-GB"),
    "Job No.": log.job.jobIdFromExcel,
    Client: log.job.client.displayName,
    Role: log.fieldName === "supervisor_assignment" ? "Supervisor" : "Staff",
    "Assigned From": log.oldValue ?? "",
    "Assigned To": log.newValue ?? "",
    "Changed By": log.changedBy?.name ?? "",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Assignment History");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="assignment-history-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
