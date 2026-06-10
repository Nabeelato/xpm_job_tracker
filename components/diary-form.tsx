"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createDiaryEntryAction } from "@/app/(app)/diary/actions";

type User = { id: string; name: string | null; role: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button disabled={pending} type="submit">
      {pending ? "Saving…" : "Add diary entry"}
    </Button>
  );
}

export function DiaryForm({ users }: { users: User[] }) {
  return (
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
          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  );
}
