"use client";

import { useState } from "react";
import { ImageLightbox } from "@/components/image-lightbox";
import { JobCommentForm } from "@/components/job-comment-form";
import { formatDateTime } from "@/lib/utils";

type CommentItem = {
  id: string;
  comment: string;
  imageUrls: string[];
  createdAt: Date;
  user: { name: string | null };
};

export function JobComments({
  jobId,
  comments,
  canComment = true,
}: {
  jobId: string;
  comments: CommentItem[];
  canComment?: boolean;
}) {
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);

  return (
    <>
      {canComment ? <JobCommentForm jobId={jobId} /> : null}
      <div className="space-y-3">
        {comments.length ? (
          comments.map((comment) => (
            <div className="rounded-md border bg-muted/30 p-3" key={comment.id}>
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>{comment.user.name}</span>
                <span>{formatDateTime(comment.createdAt)}</span>
              </div>
              <p className="text-sm">{comment.comment}</p>
              {comment.imageUrls.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {comment.imageUrls.map((url, i) => (
                    <img
                      alt=""
                      className="h-20 w-20 cursor-pointer rounded object-cover ring-1 ring-border hover:opacity-90 transition-opacity"
                      key={url}
                      onClick={() => setLightbox({ images: comment.imageUrls, index: i })}
                      src={url}
                    />
                  ))}
                </div>
              )}
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        )}
      </div>
      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  );
}
