import ExcelJS from "exceljs";
import { parse } from "csv-parse/sync";
import { createHash } from "crypto";
import { z } from "zod";
import { defaultUploadHeaders, maxUploadSizeBytes, requiredUploadHeaders } from "@/lib/constants";
import { detectDepartment, detectDepartmentFromManager, type DepartmentCode } from "@/lib/import/department";
import { normalizeHeader, optionalText, sanitizeText } from "@/lib/import/normalize";
import { parseJobStateNumber } from "@/lib/job-state";

export type ParsedImportRow = {
  rowNumber: number;
  rawData: Record<string, string>;
  jobId: string;
  clientName: string;
  jobName: string;
  priority: string | null;
  xpmState: string | null;
  jobStateNumber: number | null;
  managerName: string | null;
  partnerName: string | null;
  detectedDepartmentCode: DepartmentCode;
  errorMessage: string | null;
};

export type ParsedUpload = {
  fileName: string;
  fileHash: string;
  rows: ParsedImportRow[];
  missingHeaders: string[];
};

export class ImportFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportFileError";
  }
}

const uploadSchema = z.object({
  name: z.string().min(1),
  size: z.number().max(maxUploadSizeBytes),
});

const columnAliases = {
  jobId: [defaultUploadHeaders.jobId, "job no", "job number", "job id", "job"],
  clientName: [defaultUploadHeaders.clientName, "client", "client name"],
  jobName: [defaultUploadHeaders.jobName, "job name", "name"],
  priority: [defaultUploadHeaders.priority, "priority"],
  xpmState: [defaultUploadHeaders.xpmState, "state", "job state", "xpm state"],
  managerName: [defaultUploadHeaders.manager, "manager", "job manager"],
  partnerName: [defaultUploadHeaders.partner, "partner", "job partner"],
} as const;

type FieldKey = keyof typeof columnAliases;

function findHeader(headers: string[], field: FieldKey) {
  const normalizedHeaders = new Map(headers.map((header) => [normalizeHeader(header), header]));
  for (const alias of columnAliases[field]) {
    const found = normalizedHeaders.get(normalizeHeader(alias));
    if (found) return found;
  }
  return null;
}

function buildRows(records: Array<{ rowNumber: number; rawData: Record<string, string> }>, headers: string[]): ParsedImportRow[] {
  const mapping = {
    jobId: findHeader(headers, "jobId"),
    clientName: findHeader(headers, "clientName"),
    jobName: findHeader(headers, "jobName"),
    priority: findHeader(headers, "priority"),
    xpmState: findHeader(headers, "xpmState"),
    managerName: findHeader(headers, "managerName"),
    partnerName: findHeader(headers, "partnerName"),
  };

  return records.map(({ rowNumber, rawData }) => {
    const jobId = sanitizeText(mapping.jobId ? rawData[mapping.jobId] : "");
    const clientName = sanitizeText(mapping.clientName ? rawData[mapping.clientName] : "");
    const jobName = sanitizeText(mapping.jobName ? rawData[mapping.jobName] : "");
    const xpmState = optionalText(mapping.xpmState ? rawData[mapping.xpmState] : null);
    const managerName = optionalText(mapping.managerName ? rawData[mapping.managerName] : null);
    const partnerName = optionalText(mapping.partnerName ? rawData[mapping.partnerName] : null);
    const errors: string[] = [];

    if (!jobId) errors.push("Missing [Job] Job No.");
    if (!clientName) errors.push("Missing [Client] Client");
    if (!jobName) errors.push("Missing [Job] Name");

    return {
      rowNumber,
      rawData,
      jobId,
      clientName,
      jobName,
      priority: optionalText(mapping.priority ? rawData[mapping.priority] : null),
      xpmState,
      jobStateNumber: parseJobStateNumber(xpmState),
      managerName,
      partnerName,
      detectedDepartmentCode: detectDepartmentFromManager(managerName) ?? detectDepartment(jobName, clientName),
      errorMessage: errors.length ? errors.join(" ") : null,
    };
  });
}

async function parseCsv(buffer: Buffer) {
  const records = parse(buffer.toString("utf8"), {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    relax_quotes: true,
  }) as Record<string, unknown>[];

  const headers = records[0] ? Object.keys(records[0]) : [];
  const rows = records.map((record, index) => ({
    rowNumber: index + 2,
    rawData: Object.fromEntries(headers.map((header) => [header, sanitizeText(record[header])])),
  }));

  return { headers, rows };
}

async function parseXlsx(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return { headers: [], rows: [] };

  const headerRow = worksheet.getRow(1);
  const headerValues = Array.isArray(headerRow.values) ? headerRow.values : [];
  const headers = headerValues
    .slice(1)
    .map((value) => sanitizeText(value))
    .filter(Boolean);

  const rows: Array<{ rowNumber: number; rawData: Record<string, string> }> = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const rawData: Record<string, string> = {};
    let hasAnyValue = false;
    headers.forEach((header, index) => {
      const text = sanitizeText(row.getCell(index + 1).text || row.getCell(index + 1).value);
      if (text) hasAnyValue = true;
      rawData[header] = text;
    });
    if (hasAnyValue) rows.push({ rowNumber, rawData });
  });

  return { headers, rows };
}

export async function parseImportFile(file: File): Promise<ParsedUpload> {
  const parsedFile = uploadSchema.safeParse({ name: file.name, size: file.size });
  if (!parsedFile.success) {
    throw new ImportFileError(`Upload must be a CSV/XLSX file no larger than ${Math.floor(maxUploadSizeBytes / 1024 / 1024)}MB.`);
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !["csv", "xlsx"].includes(extension)) {
    throw new ImportFileError("Only .csv and .xlsx uploads are accepted.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileHash = createHash("sha256").update(buffer).digest("hex");
  let parsed: Awaited<ReturnType<typeof parseCsv>>;
  try {
    parsed = extension === "csv" ? await parseCsv(buffer) : await parseXlsx(buffer);
  } catch {
    throw new ImportFileError("Could not read the uploaded file. Check that it is a valid CSV/XLSX export and try again.");
  }
  const missingHeaders = requiredUploadHeaders.filter((header) => !parsed.headers.some((candidate) => normalizeHeader(candidate) === normalizeHeader(header)));

  if (missingHeaders.length > 0) {
    throw new ImportFileError(`Missing required column(s): ${missingHeaders.join(", ")}`);
  }

  return {
    fileName: file.name,
    fileHash,
    rows: buildRows(parsed.rows, parsed.headers),
    missingHeaders,
  };
}
