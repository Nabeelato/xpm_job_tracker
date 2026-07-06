import { sanitizeText } from "@/lib/import/normalize";

export type DepartmentCode = "VAT" | "SOFTWARE_BK" | "BK" | "AFS" | "QC" | "UNCLASSIFIED";

// Maps manager names from the import file to their department.
// Matching is done on exact full-name patterns for the special managers.
const managerRules: Array<{ code: DepartmentCode; patterns: RegExp[] }> = [
  { code: "BK", patterns: [/\btaaha\s+sheikh\b/i] },
  { code: "SOFTWARE_BK", patterns: [/\birfan\s+tanvir\b/i] },
  { code: "AFS", patterns: [/\bmaaz\b/i] },
  { code: "VAT", patterns: [/\bfaizan\b/i] },
];

export function detectDepartmentFromManager(managerName: string | null | undefined): DepartmentCode | null {
  if (!managerName) return null;
  const name = sanitizeText(managerName);
  for (const rule of managerRules) {
    if (rule.patterns.some((pattern) => pattern.test(name))) return rule.code;
  }
  return null;
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
      /\bmanagement accounts\b/i,
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
