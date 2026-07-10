"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowRightLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import { userRoles } from "@/lib/constants";
import { titleCaseEnum } from "@/lib/utils";
import {
  deleteUserAction,
  transferAssignmentsAction,
  updateUserAction,
  type ActionResult,
} from "./actions";

type Department = { id: string; name: string };
type Supervisor = { id: string; name: string };
type TransferTarget = { id: string; name: string };

export type UserRowData = {
  id: string;
  name: string;
  username: string;
  role: string;
  departmentId: string | null;
  supervisorId: string | null;
  active: boolean;
  activeAssignmentCount: number;
};

export function UserRow({
  user,
  departments,
  supervisors,
  transferTargets,
  currentUserId,
}: {
  user: UserRowData;
  departments: Department[];
  supervisors: Supervisor[];
  transferTargets: TransferTarget[];
  currentUserId: string;
}) {
  const [updateState, setUpdateState] = useState<ActionResult | null>(null);
  const [updatePending, setUpdatePending] = useState(false);
  const [deleteState, deleteAction, deletePending] = useActionState<ActionResult | null, FormData>(
    deleteUserAction,
    null,
  );
  const [transferState, transferAction, transferPending] = useActionState<ActionResult | null, FormData>(
    transferAssignmentsAction,
    null,
  );
  const [transferOpen, setTransferOpen] = useState(false);
  const [draft, setDraft] = useState({
    username: user.username,
    role: user.role,
    departmentId: user.departmentId ?? "",
    supervisorId: user.supervisorId ?? "",
    active: user.active,
  });
  const passwordRef = useRef<HTMLInputElement>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const initialDraftRef = useRef(true);

  useEffect(() => {
    if (initialDraftRef.current) {
      initialDraftRef.current = false;
      return;
    }
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => queueSave(draft), 700);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps

  const isSelf = user.id === currentUserId;
  const eligibleTargets = transferTargets.filter((t) => t.id !== user.id);

  function handleDeleteSubmit(e: React.FormEvent<HTMLFormElement>) {
    const assignmentNote =
      user.activeAssignmentCount > 0
        ? ` ${user.activeAssignmentCount} active job assignment${user.activeAssignmentCount === 1 ? "" : "s"} will be removed.`
        : "";
    if (!confirm(`Permanently delete ${user.name}?${assignmentNote} This cannot be undone.`)) {
      e.preventDefault();
    }
  }

  function handleTransferSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!confirm(`Transfer ${user.activeAssignmentCount} active job assignments from ${user.name}?`)) {
      e.preventDefault();
    }
  }

  function queueSave(snapshot: typeof draft, password = "") {
    const run = async () => {
      setUpdatePending(true);
      const formData = new FormData();
      formData.set("id", user.id);
      formData.set("username", snapshot.username);
      formData.set("role", snapshot.role);
      formData.set("departmentId", snapshot.departmentId);
      formData.set("supervisorId", snapshot.supervisorId);
      if (snapshot.active) formData.set("active", "on");
      formData.set("newPassword", password);
      const result = await updateUserAction(null, formData);
      setUpdateState(result);
      setUpdatePending(false);
      if (result.ok && passwordRef.current) passwordRef.current.value = "";
    };
    saveQueueRef.current = saveQueueRef.current.then(run, run);
  }

  function saveNow(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = passwordRef.current?.value ?? "";
    if (password && password.length < 8) {
      setUpdateState({ ok: false, error: "Password must be at least 8 characters." });
      return;
    }
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    queueSave(draft, password);
  }

  return (
    <TableRow>
      <TableCell className="font-medium align-top">{user.name}</TableCell>
      <TableCell className="align-top font-mono text-sm">{user.username}</TableCell>
      <TableCell colSpan={5}>
        <form className="space-y-2" onSubmit={saveNow}>
          <input name="id" type="hidden" value={user.id} />
          <Input
            onChange={(event) => setDraft((current) => ({ ...current, username: event.target.value }))}
            name="username"
            placeholder="Username"
            required
            value={draft.username}
          />
          <div className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto_auto]">
            <Select name="role" onChange={(event) => setDraft((current) => ({
              ...current,
              role: event.target.value,
              supervisorId: event.target.value === "STAFF" ? current.supervisorId : "",
            }))} value={draft.role}>
              {userRoles.map((role) => (
                <option key={role} value={role}>
                  {titleCaseEnum(role)}
                </option>
              ))}
            </Select>
            <Select name="departmentId" onChange={(event) => setDraft((current) => ({ ...current, departmentId: event.target.value }))} value={draft.departmentId}>
              <option value="">No department</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
            <Select disabled={draft.role !== "STAFF"} name="supervisorId" onChange={(event) => setDraft((current) => ({ ...current, supervisorId: event.target.value }))} value={draft.supervisorId}>
              <option value="">No supervisor</option>
              {supervisors
                .filter((supervisor) => supervisor.id !== user.id)
                .map((supervisor) => (
                  <option key={supervisor.id} value={supervisor.id}>
                    {supervisor.name}
                  </option>
                ))}
            </Select>
            <label className="flex items-center gap-2 text-sm">
              <input checked={draft.active} name="active" onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))} type="checkbox" />
              Active
            </label>
            <Button disabled={updatePending} size="sm" type="submit" variant="outline">
              {updatePending ? "Saving..." : "Save now"}
            </Button>
          </div>
          <Input
            minLength={8}
            name="newPassword"
            placeholder="Leave blank to keep current password"
            ref={passwordRef}
            type="password"
          />
          <p className="text-xs text-muted-foreground">
            Settings save automatically after you stop editing. Use Save now for password changes.
          </p>
          {updateState && !updateState.ok && (
            <p className="text-sm text-destructive">{updateState.error}</p>
          )}
          {updateState?.ok && <p className="text-sm text-emerald-700">{updateState.message ?? "Saved."}</p>}
        </form>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            disabled={user.activeAssignmentCount === 0}
            onClick={() => setTransferOpen((v) => !v)}
            size="sm"
            title={
              user.activeAssignmentCount === 0
                ? "No active assignments to transfer"
                : "Transfer this user's active job assignments to another user"
            }
            type="button"
            variant="secondary"
          >
            <ArrowRightLeft className="mr-1 h-3.5 w-3.5" />
            Transfer ({user.activeAssignmentCount})
          </Button>
          <form action={deleteAction} onSubmit={handleDeleteSubmit}>
            <input name="id" type="hidden" value={user.id} />
            <Button
              disabled={deletePending || isSelf}
              size="sm"
              title={isSelf ? "You cannot delete your own account" : undefined}
              type="submit"
              variant="destructive"
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              {deletePending ? "Deleting..." : "Delete"}
            </Button>
          </form>
        </div>
        {deleteState && !deleteState.ok && (
          <p className="mt-1 text-sm text-destructive">{deleteState.error}</p>
        )}
        {deleteState?.ok && deleteState.message && (
          <p className="mt-1 text-sm text-emerald-700">{deleteState.message}</p>
        )}

        {transferOpen && (
          <form
            action={transferAction}
            className="mt-3 space-y-2 rounded-md border bg-muted/30 p-3"
            onSubmit={handleTransferSubmit}
          >
            <input name="fromUserId" type="hidden" value={user.id} />
            <div className="text-sm font-medium">
              Transfer {user.activeAssignmentCount} active assignment
              {user.activeAssignmentCount === 1 ? "" : "s"} from {user.name} to:
            </div>
            <Select defaultValue="" name="toUserId" required>
              <option disabled value="">
                Select target user...
              </option>
              {eligibleTargets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            <label className="flex items-center gap-2 text-sm">
              <input name="deactivate" type="checkbox" />
              Also deactivate {user.name} after transfer
            </label>
            <div className="flex gap-2">
              <Button disabled={transferPending} size="sm" type="submit">
                {transferPending ? "Transferring..." : "Confirm Transfer"}
              </Button>
              <Button
                onClick={() => setTransferOpen(false)}
                size="sm"
                type="button"
                variant="ghost"
              >
                Cancel
              </Button>
            </div>
            {transferState && !transferState.ok && (
              <p className="text-sm text-destructive">{transferState.error}</p>
            )}
            {transferState?.ok && (
              <p className="text-sm text-emerald-700">{transferState.message}</p>
            )}
          </form>
        )}
      </TableCell>
    </TableRow>
  );
}
