"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { defaultJobFiltersFromForm } from "@/lib/job-filter-preferences";
import { requireUser } from "@/lib/rbac";

export async function saveAllJobsDefaultFiltersAction(formData: FormData) {
  const user = await requireUser();
  const departments = await prisma.department.findMany({
    where: { active: true },
    select: { code: true },
  });
  const defaults = defaultJobFiltersFromForm(formData, new Set(departments.map((department) => department.code)));
  const hasDefaults = defaults.departments.length > 0 || defaults.stateFilters.length > 0;

  await prisma.user.update({
    where: { id: user.id },
    data: { defaultJobFilters: hasDefaults ? defaults : Prisma.DbNull },
  });

  revalidatePath("/jobs");
  redirect("/jobs");
}

export async function clearAllJobsDefaultFiltersAction() {
  const user = await requireUser();
  await prisma.user.update({
    where: { id: user.id },
    data: { defaultJobFilters: Prisma.DbNull },
  });

  revalidatePath("/jobs");
  redirect("/jobs?defaultFilters=off");
}
