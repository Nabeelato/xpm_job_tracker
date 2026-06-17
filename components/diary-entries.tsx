"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ImageLightbox } from "@/components/image-lightbox";
import { formatDateTime } from "@/lib/utils";

type DiaryEntryItem = {
  id: string;
  entry: string;
  imageUrls: string[];
  createdAt: Date;
  author: { name: string | null };
  recipient: { name: string | null };
};

export function DiaryEntries({ entries }: { entries: DiaryEntryItem[] }) {
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <Card key={entry.id}>
          <CardContent className="p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                For {entry.recipient.name} | By {entry.author.name}
              </span>
              <span>{formatDateTime(entry.createdAt)}</span>
            </div>
            <p className="text-sm">{entry.entry}</p>
            {entry.imageUrls.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {entry.imageUrls.map((url, i) => (
                  <img
                    alt=""
                    className="h-20 w-20 cursor-pointer rounded object-cover ring-1 ring-border hover:opacity-90 transition-opacity"
                    key={url}
                    onClick={() => setLightbox({ images: entry.imageUrls, index: i })}
                    src={url}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
