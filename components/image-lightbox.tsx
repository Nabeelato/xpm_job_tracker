"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export function ImageLightbox({
  images,
  initialIndex,
  onClose,
}: {
  images: string[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIndex((i) => Math.min(images.length - 1, i + 1));
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [images.length, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <button
        className="absolute right-4 top-4 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"
        onClick={onClose}
        type="button"
      >
        <X className="h-5 w-5" />
      </button>

      {images.length > 1 && (
        <span className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
          {index + 1} / {images.length}
        </span>
      )}

      {images.length > 1 && index > 0 && (
        <button
          className="absolute left-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
          onClick={(e) => { e.stopPropagation(); setIndex(index - 1); }}
          type="button"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      <img
        alt=""
        className="max-h-[90vh] max-w-[90vw] rounded object-contain"
        onClick={(e) => e.stopPropagation()}
        src={images[index]}
      />

      {images.length > 1 && index < images.length - 1 && (
        <button
          className="absolute right-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
          onClick={(e) => { e.stopPropagation(); setIndex(index + 1); }}
          type="button"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}
