import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import type { AssignmentRole, Prisma, UserRole } from "@prisma/client";
import { stateGroupWhere, xpmSubStateWhere, type JobStateGroup, type XpmSubState } from "@/lib/job-state";
import { formatDateTime, titleCaseEnum } from "@/lib/utils";
import { availableJobsWhere, visibleJobsWhere, type AppSessionUser } from "@/lib/rbac";

export const REPORT_EXPORT_LIMIT = 25_000;

export type JobReportScope = "report" | "visible";

export type ReportWorkbookMeta = {
  title: string;
  generatedBy?: string | null;
  filters?: Array<{ label: string; value: string | number | null | undefined }>;
};

export type ReportColumn = {
  header: string;
  key: string;
  width?: number;
  numFmt?: string;
};

export type ReportSearchParams = URLSearchParams | Record<string, string | string[] | undefined>;

function param(params: ReportSearchParams, key: string) {
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function toPositiveInt(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function multiParam(params: ReportSearchParams, key: string) {
  let rawValues: string[] = [];
  if (params instanceof URLSearchParams) {
    rawValues = params.getAll(key);
  } else {
    const value = params[key];
    if (Array.isArray(value)) rawValues = value;
    else if (typeof value === "string") rawValues = [value];
  }

  return rawValues
    .flatMap((value) => String(value).split(","))
    .map((part) => part.trim())
    .filter(Boolean);
}

function multiNumberParam(params: ReportSearchParams, key: string) {
  return multiParam(params, key)
    .map((value) => Number.parseInt(value, 10))
    .filter((number) => Number.isFinite(number) && number > 0);
}

function assignmentRoleFilterWhere(role: AssignmentRole, values: string[]) {
  if (!values.length) return null;

  const clauses: Prisma.JobWhereInput[] = [];
  if (values.includes("unassigned")) {
    clauses.push({ assignments: { none: { active: true, assignmentRole: role } } });
  }

  const userIds = values.filter((value) => value !== "unassigned");
  if (userIds.length) {
    clauses.push({
      assignments: {
        some: {
          active: true,
          assignmentRole: role,
          userId: { in: userIds },
        },
      },
    });
  }

  if (!clauses.length) return null;
  return clauses.length === 1 ? clauses[0] : { OR: clauses };
}

function isStateGroup(value: string | undefined): value is JobStateGroup {
  return value === "MAIN" || value === "OTHER" || value === "COMPLETED" || value === "CANCELLED";
}

function isXpmSubState(value: string | undefined): value is XpmSubState {
  return value === "ifza_check" || value === "job_on_hold";
}

function stateFilterWhere(value: string | undefined): Prisma.JobWhereInput | null | undefined {
  if (!value) return undefined;
  if (value === "all") return null;
  if (value === "main") return { jobStateNumber: { in: [2, 3, 4, 5, 6] } };
  if (value === "workflow") return { jobStateNumber: { in: [3, 4, 5, 6] } };
  if (value === "other") return stateGroupWhere("OTHER");
  if (value === "completed") return stateGroupWhere("COMPLETED");
  if (value === "cancelled") return stateGroupWhere("CANCELLED");

  const stateNumber = toPositiveInt(value);
  if (stateNumber > 0) return { jobStateNumber: stateNumber };
  return null;
}

export function reportScopeWhere(user: AppSessionUser): Prisma.JobWhereInput {
  if (user.role === "ADMIN" || user.departmentCode === "QC") return {};

  if (user.role === "MANAGER") {
    const scoped: Prisma.JobWhereInput[] = [
      { assignments: { some: { userId: user.id, active: true } } },
    ];

    if (user.departmentId) {
      scoped.push(
        { finalDepartmentId: user.departmentId },
        { assignments: { some: { active: true, user: { departmentId: user.departmentId } } } },
      );
    }

    return { OR: scoped };
  }

  if (user.role === "SUPERVISOR") {
    return {
      assignments: {
        some: {
          active: true,
          OR: [
            { userId: user.id },
            { user: { supervisorId: user.id } },
          ],
        },
      },
    };
  }

  return { assignments: { some: { userId: user.id, active: true } } };
}

export function reportUserScopeWhere(user: AppSessionUser): Prisma.UserWhereInput {
  if (user.role === "ADMIN" || user.departmentCode === "QC") return {};
  if (user.role === "MANAGER") {
    return user.departmentId
      ? { OR: [{ id: user.id }, { departmentId: user.departmentId }] }
      : { id: user.id };
  }
  if (user.role === "SUPERVISOR") {
    return { OR: [{ id: user.id }, { supervisorId: user.id }] };
  }
  return { id: user.id };
}

export function buildJobReportWhere(
  params: ReportSearchParams,
  user: AppSessionUser,
  options: { scope?: JobReportScope } = {},
): Prisma.JobWhereInput {
  const scope = options.scope ?? "report";
  const and: Prisma.JobWhereInput[] = [
    scope === "visible" ? visibleJobsWhere(user) : reportScopeWhere(user),
  ];

  const query = param(params, "q")?.trim();
  const departments = multiParam(params, "department");
  const priority = param(params, "priority")?.trim();
  const staffUserIds = multiParam(params, "staffUserId");
  const managerUserIds = multiParam(params, "managerUserId");
  const supervisorUserIds = multiParam(params, "supervisorUserId");
  const assignedUserIds = multiParam(params, "assignedUserId");
  const sourceManager = param(params, "sourceManager")?.trim();
  const sourcePartner = param(params, "sourcePartner")?.trim();
  const clientCategories = multiParam(params, "clientCategory");
  const stateFilter = param(params, "stateFilter");
  const stateFilters = multiParam(params, "stateFilter");
  const stateSet = param(params, "stateSet");
  const stateGroup = param(params, "stateGroup");
  const stateNumbers = multiNumberParam(params, "stateNumbers");
  const jobStateNumbers = multiNumberParam(params, "jobStateNumber");
  const missing = param(params, "missing");
  const archived = param(params, "archived") ?? "false";
  const xpmSubState = param(params, "xpmSubState");
  const myJobs = param(params, "myJobs");
  const availableJobs = param(params, "availableJobs");
  const queueVacancy = param(params, "queueVacancy");

  if (myJobs === "true") and.push({ assignments: { some: { userId: user.id, active: true } } });
  if (availableJobs === "true") and.push(availableJobsWhere(user));
  if (availableJobs === "true" && user.role === "ADMIN") {
    if (queueVacancy === "MANAGER" || queueVacancy === "SUPERVISOR" || queueVacancy === "STAFF") {
      and.push({ assignments: { none: { active: true, assignmentRole: queueVacancy } } });
    } else if (queueVacancy === "ANY") {
      and.push({
        OR: ["MANAGER", "SUPERVISOR", "STAFF"].map((assignmentRole) => ({
          assignments: { none: { active: true, assignmentRole: assignmentRole as AssignmentRole } },
        })),
      });
    } else if (queueVacancy === "UNASSIGNED") {
      and.push({ assignments: { none: { active: true } } });
    }
  }

  if (query) {
    and.push({
      OR: [
        { jobIdFromExcel: { contains: query, mode: "insensitive" } },
        { jobName: { contains: query, mode: "insensitive" } },
        { client: { displayName: { contains: query, mode: "insensitive" } } },
      ],
    });
  }

  if (departments.length) and.push({ finalDepartment: { code: { in: departments } } });

  if (clientCategories.length) {
    const clientCategoryClauses: Prisma.JobWhereInput[] = [];
    if (clientCategories.includes("SOFTWARE")) {
      clientCategoryClauses.push({ client: { category: "SOFTWARE" } });
    }
    if (clientCategories.includes("MANUAL")) {
      clientCategoryClauses.push({ client: { category: "MANUAL" } });
    }
    if (clientCategories.includes("uncategorized")) {
      clientCategoryClauses.push({ client: { category: null } });
    }
    if (clientCategoryClauses.length) and.push({ OR: clientCategoryClauses });
  }

  const selectedStateFilters = stateFilters.length ? stateFilters : stateFilter ? [stateFilter] : [];
  if (selectedStateFilters.length) {
    const stateFilterClauses = selectedStateFilters
      .map((value) => stateFilterWhere(value))
      .filter((clause): clause is Prisma.JobWhereInput => Boolean(clause));
    if (stateFilterClauses.length) {
      and.push({ OR: stateFilterClauses });
    }
  } else if (jobStateNumbers.length > 0) {
    and.push({ jobStateNumber: { in: jobStateNumbers } });
  } else if (stateNumbers.length) {
    and.push({ jobStateNumber: { in: stateNumbers } });
  } else if (stateGroup && isStateGroup(stateGroup)) {
    and.push(stateGroupWhere(stateGroup));
  } else if (stateSet === "main") {
    and.push({ jobStateNumber: { in: [2, 3, 4, 5, 6] } });
  } else if (stateSet === "workflow") {
    and.push({ jobStateNumber: { in: [3, 4, 5, 6] } });
  } else if (stateSet === "other") {
    and.push(stateGroupWhere("OTHER"));
  }

  if (priority) and.push({ priority: { contains: priority, mode: "insensitive" } });
  const staffFilter = assignmentRoleFilterWhere("STAFF", staffUserIds);
  if (staffFilter) and.push(staffFilter);

  const managerFilter = assignmentRoleFilterWhere("MANAGER", managerUserIds);
  if (managerFilter) and.push(managerFilter);

  const supervisorFilter = assignmentRoleFilterWhere("SUPERVISOR", supervisorUserIds);
  if (supervisorFilter) and.push(supervisorFilter);

  if (assignedUserIds.length) {
    const assigneeClauses: Prisma.JobWhereInput[] = [];
    if (assignedUserIds.includes("unassigned")) {
      assigneeClauses.push({ assignments: { none: { active: true } } });
    }
    const assignedIds = assignedUserIds.filter((value) => value !== "unassigned");
    if (assignedIds.length) {
      assigneeClauses.push({ assignments: { some: { userId: { in: assignedIds }, active: true } } });
    }
    if (assigneeClauses.length) and.push({ OR: assigneeClauses });
  }
  if (sourceManager) and.push({ sourceManagerName: { contains: sourceManager, mode: "insensitive" } });
  if (sourcePartner) and.push({ sourcePartnerName: { contains: sourcePartner, mode: "insensitive" } });
  if (missing === "true") and.push({ missingFromLatestImport: true });
  if (missing === "false") and.push({ missingFromLatestImport: false });
  if (archived === "true") and.push({ archived: true });
  if (archived === "false") and.push({ archived: false });
  if (isXpmSubState(xpmSubState)) and.push(xpmSubStateWhere(xpmSubState));

  return { AND: and };
}

export function buildJobReportOrderBy(params: ReportSearchParams): Prisma.JobOrderByWithRelationInput[] {
  const dir = param(params, "sortDir") === "desc" ? "desc" : "asc";

  switch (param(params, "sortBy")) {
    case "jobNo":
      return [{ jobIdFromExcel: dir }];
    case "client":
      return [{ client: { displayName: dir } }, { jobIdFromExcel: "asc" }];
    case "jobName":
      return [{ jobName: dir }, { jobIdFromExcel: "asc" }];
    case "department":
      return [{ finalDepartment: { code: dir } }, { jobIdFromExcel: "asc" }];
    case "state":
      return [{ jobStateNumber: dir }, { jobIdFromExcel: "asc" }];
    default:
      return [{ missingFromLatestImport: "desc" }, { jobIdFromExcel: "asc" }];
  }
}

export function createReportWorkbook(meta: ReportWorkbookMeta) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "XPM Job Portal";
  workbook.created = new Date();
  workbook.modified = new Date();

  const summary = workbook.addWorksheet("Summary");
  summary.columns = [
    { header: "Field", key: "field", width: 28 },
    { header: "Value", key: "value", width: 64 },
  ];
  summary.addRows([
    { field: "Report", value: meta.title },
    { field: "Generated At", value: formatDateTime(new Date()) },
    { field: "Generated By", value: meta.generatedBy ?? "-" },
    ...(meta.filters ?? [])
      .filter((filter) => filter.value !== undefined && filter.value !== null && String(filter.value).length > 0)
      .map((filter) => ({ field: filter.label, value: String(filter.value) })),
  ]);
  styleWorksheet(summary, 2);

  return workbook;
}

export function addReportWorksheet(
  workbook: ExcelJS.Workbook,
  name: string,
  columns: ReportColumn[],
  rows: Record<string, unknown>[],
) {
  const worksheet = workbook.addWorksheet(name);
  worksheet.columns = columns.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width ?? 18,
    style: column.numFmt ? { numFmt: column.numFmt } : undefined,
  }));
  worksheet.addRows(rows);
  styleWorksheet(worksheet, columns.length);
  return worksheet;
}

function styleWorksheet(worksheet: ExcelJS.Worksheet, columnCount: number) {
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columnCount },
  };

  const header = worksheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F2937" },
  };
  header.alignment = { vertical: "middle" };

  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
      cell.alignment = { vertical: "top", wrapText: true };
    });
    if (rowNumber > 1 && rowNumber % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF9FAFB" },
        };
      });
    }
  });
}

export async function workbookResponse(workbook: ExcelJS.Workbook, filename: string) {
  const output = await workbook.xlsx.writeBuffer();
  const body = Buffer.isBuffer(output) ? output : Buffer.from(output as ArrayBuffer);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export function reportLimitResponse(total: number) {
  return NextResponse.json(
    {
      error: `This report has ${total.toLocaleString()} rows. Please narrow the filters to ${REPORT_EXPORT_LIMIT.toLocaleString()} rows or fewer.`,
    },
    { status: 400 },
  );
}

export function parseDateBoundary(value: string | undefined, endOfDay = false) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "invalid" as const;
  const suffix = endOfDay ? "T23:59:59.999" : "T00:00:00.000";
  const date = new Date(`${value}${suffix}`);
  return Number.isNaN(date.getTime()) ? ("invalid" as const) : date;
}

export function invalidDateResponse(label: string) {
  return NextResponse.json({ error: `${label} must be a valid YYYY-MM-DD date.` }, { status: 400 });
}

export function roleLabel(role: UserRole | string | null | undefined) {
  return role ? titleCaseEnum(role) : "-";
}
