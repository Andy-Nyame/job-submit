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
        className="flex aspect-[4/3] items-center justify-center bg-[linear-gradient(145deg,var(--primary-surface),var(--muted-surface))] p-6 text-center"
        role="img"
      >
        <span className="flex size-16 items-center justify-center rounded-2xl border border-primary/20 bg-surface/80 text-2xl font-semibold text-primary">
          {name.slice(0, 1).toUpperCase()}
        </span>
      </div>
    );
  }
  // The source is an opaque application route that streams an authorized private Blob.
  return <img alt={alt} className="aspect-[4/3] w-full bg-muted-surface object-cover" onError={() => setFailed(true)} src={`/api/service-images/${imageId}`} />;
}
