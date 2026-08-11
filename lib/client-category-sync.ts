import { ClientCategory, type Prisma } from "@prisma/client";

// Mirrors the MANUAL side-effect in app/(app)/clients/actions.ts:updateClientCategoryAction —
// a manually bookkept client has no software vendor, and defaults to the firm doing the books.
export async function applyClientCategory(tx: Prisma.TransactionClient, clientId: string, category: ClientCategory) {
  const data: Prisma.ClientUpdateInput =
    category === ClientCategory.MANUAL
      ? { category, bookkeepingSoftware: null, bookkeepingBy: "FIRM" }
      : { category };

  await tx.client.update({ where: { id: clientId }, data });
}

// Software BK / BK are the only departments that imply a bookkeeping category — VAT/AFS/QC/UNCLASSIFIED
// jobs don't tell us anything about how a client's books are kept, so they're left untouched.
export async function applyClientCategoryForDepartment(
  tx: Prisma.TransactionClient,
  clientId: string,
  departmentCode: string,
) {
  if (departmentCode === "SOFTWARE_BK") {
    await applyClientCategory(tx, clientId, ClientCategory.SOFTWARE);
  } else if (departmentCode === "BK") {
    await applyClientCategory(tx, clientId, ClientCategory.MANUAL);
  }
}
