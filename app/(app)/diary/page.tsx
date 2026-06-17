import { EmptyState } from "@/components/empty-state";
import { DiaryEntries } from "@/components/diary-entries";
import { DiaryForm } from "@/components/diary-form";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { canWriteDiary, requireUser } from "@/lib/rbac";

export default async function DiaryPage() {
  const user = await requireUser();
  const canWrite = canWriteDiary(user);
  const [entries, users] = await Promise.all([
    prisma.diaryEntry.findMany({
      where: {
        OR: [{ recipientId: user.id }, { authorId: user.id }],
      },
      select: {
        id: true,
        entry: true,
        imageUrls: true,
        createdAt: true,
        author: { select: { name: true } },
        recipient: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    canWrite ? prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, role: true } }) : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader description="Private notes visible to the recipient and the author." title="Diary Book" />
      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        {canWrite ? <DiaryForm users={users} /> : null}

        {entries.length ? (
          <DiaryEntries entries={entries} />
        ) : (
          <EmptyState title="No diary entries" description="Diary notes written for you or by you will appear here." />
        )}
      </div>
    </>
  );
}
