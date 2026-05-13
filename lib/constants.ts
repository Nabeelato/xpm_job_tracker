import type { AssignmentRole, InternalStatus, UserRole } from "@prisma/client";

export const requiredUploadHeaders = ["[Job] Job No.", "[Client] Client", "[Job] Name"] as const;

export const defaultUploadHeaders = {
  jobId: "[Job] Job No.",
  clientName: "[Client] Client",
  jobName: "[Job] Name",
  priority: "[Job] Priority",
  xpmState: "[State] State",
  manager: "[Job] Manager",
  partner: "[Job] Partner",
} as const;

export const departments = ["VAT", "SOFTWARE_BK", "BK", "AFS", "QC", "UNCLASSIFIED"] as const;

export const departmentNames: Record<(typeof departments)[number], string> = {
  VAT: "VAT",
  SOFTWARE_BK: "Software Bookkeeping",
  BK: "Bookkeeping",
  AFS: "AFS",
  QC: "QC Department",
  UNCLASSIFIED: "Unclassified",
};

export const jobStateOptions = [
  { number: 1, code: "01", label: "01. Planned" },
  { number: 2, code: "02", label: "02. RFI / Email to client sent" },
  { number: 3, code: "03", label: "03. Info sent to Lahore / Job started" },
  { number: 4, code: "04", label: "04. Missing info / Chase client" },
  { number: 5, code: "05", label: "05. Lahore to proceed / client Info complete" },
  { number: 6, code: "06", label: "06. For review with Jack" },
  { number: 7, code: "07", label: "07. Pending approval with client" },
  { number: 8, code: "08", label: "08. For invoicing" },
  { number: 9, code: "09", label: "09. For client E signature" },
  { number: 10, code: "10", label: "10. Pending CT return submission" },
  { number: 11, code: "11", label: "11. Completed" },
  { number: 12, code: "12", label: "12. Cancelled (Not Applicable) - DO NOT USE" },
] as const;

export const internalStatuses: InternalStatus[] = [
  "UNASSIGNED",
  "ASSIGNED",
  "IN_PROGRESS",
  "SUBMITTED_FOR_REVIEW",
  "CHANGES_REQUIRED",
  "COMPLETED",
  "ON_HOLD",
  "ARCHIVED",
];

export const assignmentRoles: AssignmentRole[] = ["PRIMARY", "REVIEWER", "SUPERVISOR", "HELPER"];

export const userRoles: UserRole[] = ["ADMIN", "MANAGER", "SUPERVISOR", "STAFF"];

export const maxUploadSizeBytes = 15 * 1024 * 1024;
