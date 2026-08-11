import { sanitizeText } from "@/lib/import/normalize";

export type DepartmentCode = "VAT" | "SOFTWARE_BK" | "BK" | "AFS" | "QC" | "UNCLASSIFIED";

const taahaPattern = /\btaaha\s+(?:imran|sheikh)\b/i;
const irfanManagerPattern = /\birfan\s+tan(?:v|w)ir\b/i;
const maazManagerPattern = /\bmaaz\s+imran\b/i;
const faizanManagerPattern = /\bfaizan\s+ali\b/i;
const afsJobTitlePattern = /\b(?:ye\s*\/\s*pe|pe\s*\/\s*ye)\b/i;

export function isTaahaSourcePerson(value: unknown) {
  return taahaPattern.test(sanitizeText(value));
}

export function isIrfanSourcePerson(value: unknown) {
  return irfanManagerPattern.test(sanitizeText(value));
}

export function hasAfsJobTitle(jobName: unknown) {
  return afsJobTitlePattern.test(sanitizeText(jobName));
}

// Import department rules are intentionally manager-led. Taaha Sheikh is kept
// as an alias because that is the name currently supplied by the XPM export.
export function detectDepartmentFromManager(
  managerName: string | null | undefined,
  jobName?: unknown,
): DepartmentCode | null {
  if (!managerName) return null;
  const name = sanitizeText(managerName);
  if (taahaPattern.test(name)) return "BK";
  if (irfanManagerPattern.test(name)) return "SOFTWARE_BK";
  if (faizanManagerPattern.test(name)) return "VAT";
  if (maazManagerPattern.test(name)) return "AFS";
  return null;
}

export function detectImportDepartment(managerName: string | null | undefined, jobName: unknown): DepartmentCode {
  const managerDepartment = detectDepartmentFromManager(managerName, jobName);
  if (managerDepartment) return managerDepartment;
  const titleDepartment = detectDepartment(jobName);
  return titleDepartment === "UNCLASSIFIED" ? "AFS" : titleDepartment;
}

const rules: Array<{ code: DepartmentCode; patterns: RegExp[] }> = [
  {
    code: "VAT",
    patterns: [
      /\bvat\b/i,
      /\bvat returns?\b/i,
      /\bqe vat\b/i,
      /\bvat deregistration\b/i,
      /\btax registration number\b/i,
    ],
  },
  {
    code: "SOFTWARE_BK",
    patterns: [
      /\bsoftware\b/i,
      /\bsystem(s)?\b/i,
      /\bimplementation\b/i,
      /\bapplication\b/i,
      /\bintegration\b/i,
      /\bautomation\b/i,
      /\bplatform\b/i,
      /\bsaas\b/i,
    ],
  },
  {
    code: "BK",
    patterns: [
      /\bbook\s*keeping\b/i,
      /\bbookkeeping\b/i,
      /\bbk\b/i,
      /\bmanagement accounts?\b/i,
      /\bmonthly accounts\b/i,
      /\baccounting services\b/i,
      /\baccounts maintenance\b/i,
    ],
  },
  {
    code: "AFS",
    patterns: [
      /\bafs\b/i,
      /\bpe\s*\/\s*ye\b/i,
      /\bye\s*\/\s*pe\b/i,
      /\byear end\b/i,
      /\byear-end\b/i,
      /\bannual accounts\b/i,
      /\bfinancial statements\b/i,
      /\bstatutory accounts\b/i,
      /\baccounts preparation\b/i,
      /\bfinal accounts\b/i,
      /\bperiod end\b/i,
      /\bpreparation of accounts\b/i,
      /\bcessation (?:of )?accounts?\b/i,
    ],
  },
];

export function detectDepartment(jobName: unknown, clientName?: unknown): DepartmentCode {
  const name = `${sanitizeText(jobName)} ${sanitizeText(clientName)}`.trim();
  for (const rule of rules) {
    if (rule.patterns.some((pattern) => pattern.test(name))) return rule.code;
  }
  return "UNCLASSIFIED";
}

export function detectDepartmentMismatch(
  jobName: unknown,
  currentDepartmentCode: string | null | undefined,
  sourceManagerName?: string | null,
): DepartmentCode | null {
  if (!currentDepartmentCode || currentDepartmentCode === "QC") {
    return null;
  }

  const expectedDepartmentCode = sourceManagerName === undefined
    ? detectDepartment(jobName)
    : detectImportDepartment(sourceManagerName, jobName);
  if (expectedDepartmentCode === "UNCLASSIFIED" || expectedDepartmentCode === currentDepartmentCode) {
    return null;
  }

  return expectedDepartmentCode;
}
