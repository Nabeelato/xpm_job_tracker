import { NextRequest, NextResponse } from "next/server";
import {
  bookkeepingByLabels,
  bookkeepingSoftwareLabels,
  clientCategoryLabels,
  departmentNames,
} from "@/lib/constants";
import { getClientSummaries, type JobDataScope } from "@/lib/optimized-queries";
import {
  addReportWorksheet,
  createReportWorkbook,
  reportLimitResponse,
  REPORT_EXPORT_LIMIT,
  workbookResponse,
} from "@/lib/reports";
import { getCurrentUser } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const scope: JobDataScope = params.get("scope") === "visible" ? "visible" : "report";
  const { summaries, total } = await getClientSummaries({
    user,
    query: params.get("q") ?? undefined,
    filter: params.get("filter"),
    bookkeepingSoftware: params.get("bookkeepingSoftware"),
    bookkeepingBy: params.get("bookkeepingBy"),
    scope,
    page: 1,
    pageSize: REPORT_EXPORT_LIMIT,
  });

  if (total > REPORT_EXPORT_LIMIT) return reportLimitResponse(total);

  const workbook = createReportWorkbook({
    title: "Client Summary Report",
    generatedBy: user.name,
    filters: [
      { label: "Scope", value: scope === "visible" ? "Current screen visibility" : "Hierarchy report scope" },
      { label: "Search", value: params.get("q") },
      { label: "Client Filter", value: params.get("filter") },
      { label: "Bookkeeping Software", value: params.get("bookkeepingSoftware") },
      { label: "Bookkeeping By", value: params.get("bookkeepingBy") },
      { label: "Rows", value: total },
    ],
  });

  addReportWorksheet(
    workbook,
    "Clients",
    [
      { header: "Client", key: "client", width: 36 },
      { header: "Category", key: "category", width: 18 },
      { header: "Bookkeeping Software", key: "bookkeepingSoftware", width: 22 },
      { header: "Bookkeeping By", key: "bookkeepingBy", width: 18 },
      { header: "Total Jobs", key: "totalJobs", width: 12 },
      { header: "Active Jobs", key: "activeJobs", width: 12 },
      { header: "Completed Jobs", key: "completedJobs", width: 16 },
      { header: "Missing Latest", key: "missingJobs", width: 14 },
      { header: departmentNames.VAT, key: "vatJobs", width: 12 },
      { header: departmentNames.SOFTWARE_BK, key: "softwareBkJobs", width: 22 },
      { header: departmentNames.BK, key: "bkJobs", width: 14 },
      { header: departmentNames.AFS, key: "afsJobs", width: 12 },
      { header: departmentNames.QC, key: "qcJobs", width: 14 },
      { header: departmentNames.UNCLASSIFIED, key: "unclassifiedJobs", width: 16 },
    ],
    summaries.map((client) => ({
      client: client.displayName,
      category: client.category ? clientCategoryLabels[client.category] : "",
      bookkeepingSoftware: client.bookkeepingSoftware
        ? bookkeepingSoftwareLabels[client.bookkeepingSoftware]
        : "",
      bookkeepingBy: client.bookkeepingBy ? bookkeepingByLabels[client.bookkeepingBy] : "",
      totalJobs: client.totalJobs,
      activeJobs: client.activeJobs,
      completedJobs: client.completedJobs,
      missingJobs: client.missingJobs,
      vatJobs: client.departmentCounts.VAT ?? 0,
      softwareBkJobs: client.departmentCounts.SOFTWARE_BK ?? 0,
      bkJobs: client.departmentCounts.BK ?? 0,
      afsJobs: client.departmentCounts.AFS ?? 0,
      qcJobs: client.departmentCounts.QC ?? 0,
      unclassifiedJobs: client.departmentCounts.UNCLASSIFIED ?? 0,
    })),
  );

  return workbookResponse(workbook, `client-summary-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
