import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { prisma } from "@/lib/db";
import { canWriteDiary, requireUser } from "@/lib/rbac";
import { formatDateTime } from "@/lib/utils";
import { createDiaryEntryAction } from "./actions";

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
        {canWrite ? (
          <Card>
            <CardHeader>
              <CardTitle>Write Entry</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createDiaryEntryAction} className="space-y-3">
                <Select name="recipientId" required>
                  <option value="">Select user</option>
                  {users.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name} ({candidate.role})
                    </option>
                  ))}
                </Select>
                <Textarea name="entry" placeholder="Diary note" required />
                <Button type="submit">Add diary entry</Button>
              </form>
            </CardContent>
          </Card>
        ) : null}

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
