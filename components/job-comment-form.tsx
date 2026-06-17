"use client";

import { useRef, useState } from "react";
import { ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addCommentAction } from "@/app/(app)/jobs/actions";

type Preview = { file: File; objectUrl: string };

export function JobCommentForm({ jobId }: { jobId: string }) {
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const next: Preview[] = Array.from(files).map((file) => ({
      file,
      objectUrl: URL.createObjectURL(file),
    }));
    setPreviews((prev) => [...prev, ...next]);
  }

  function handlePaste(e: React.ClipboardEvent) {
    const files = Array.from(e.clipboardData.items)
      .filter((item) => item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((f): f is File => f !== null);
    if (files.length === 0) return;
    setPreviews((prev) => [
      ...prev,
      ...files.map((file) => ({ file, objectUrl: URL.createObjectURL(file) })),
    ]);
  }

  function removeImage(index: number) {
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[index].objectUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      for (const { file } of previews) {
        const body = new FormData();
        body.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          alert(`Upload failed: ${(err as { error?: string }).error ?? res.statusText}`);
          return;
        }
        const { url } = await res.json() as { url: string };
        formData.append("imageUrls", url);
      }

      await addCommentAction(formData);

      formRef.current?.reset();
      previews.forEach((p) => URL.revokeObjectURL(p.objectUrl));
      setPreviews([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit} ref={formRef}>
      <input name="jobId" type="hidden" value={jobId} />
      <Textarea name="comment" onPaste={handlePaste} placeholder="Add a comment — paste images directly" required />

      <div className="space-y-2">
        <button
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          <ImageIcon className="h-4 w-4" />
          Attach images
        </button>
        <input
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          ref={fileInputRef}
          type="file"
        />
        {previews.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {previews.map((p, i) => (
              <div className="relative" key={p.objectUrl}>
                <img
                  alt=""
                  className="h-20 w-20 rounded object-cover ring-1 ring-border"
                  src={p.objectUrl}
                />
                <button
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white"
                  onClick={() => removeImage(i)}
                  type="button"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Button disabled={submitting} type="submit">
        {submitting ? "Saving…" : "Add comment"}
      </Button>
    </form>
  );
}
