"use client";

import { useState } from "react";

export function ServiceCatalogueImage({
  alt,
  imageId,
  name,
}: {
  alt: string;
  imageId?: string;
  name: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!imageId || failed) {
    return (
      <div
        aria-label={`${name} image not added yet`}
        className="flex aspect-[4/5] items-center justify-center bg-[linear-gradient(145deg,var(--primary-surface),var(--muted-surface))] p-4 text-center"
        role="img"
      >
        <span className="flex size-12 items-center justify-center rounded-xl border border-primary/20 bg-surface/80 text-xl font-semibold text-primary sm:size-14 sm:text-2xl">
          {name.slice(0, 1).toUpperCase()}
        </span>
      </div>
    );
  }
  // The source is an opaque application route that streams an authorized private Blob.
  return (
    <img
      alt={alt}
      className="aspect-[4/5] w-full bg-muted-surface object-cover"
      decoding="async"
      loading="lazy"
      onError={() => setFailed(true)}
      sizes="(max-width: 639px) 42vw, (max-width: 1023px) 28vw, 18vw"
      src={`/api/service-images/${imageId}`}
    />
  );
}
