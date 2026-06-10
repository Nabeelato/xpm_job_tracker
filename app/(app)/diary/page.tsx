import { EmptyState } from "@/components/empty-state";
import { DiaryForm } from "@/components/diary-form";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { canWriteDiary, requireUser } from "@/lib/rbac";
import { formatDateTime } from "@/lib/utils";

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

        <div className="space-y-3">
          {entries.length ? (
            entries.map((entry) => (
              <Card key={entry.id}>
                <CardContent className="p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      For {entry.recipient.name} | By {entry.author.name}
                    </span>
                    <span>{formatDateTime(entry.createdAt)}</span>
                  </div>
                  <p className="text-sm">{entry.entry}</p>
                </CardContent>
              </Card>
            ))
          ) : (
            <EmptyState title="No diary entries" description="Diary notes written for you or by you will appear here." />
          )}
        </div>
      </div>
    </>
  );
}
