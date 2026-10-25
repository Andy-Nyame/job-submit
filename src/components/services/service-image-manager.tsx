"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import {
  ALLOWED_SERVICE_IMAGE_TYPES,
  MAX_SERVICE_IMAGE_BYTES,
  serviceImagePath,
} from "@/domain/service-images";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-controls";

export interface ManagedServiceImage {
  altText: string;
  id: string;
  isCover: boolean;
}

export function ServiceImageManager({
  images,
  serviceId,
  serviceName,
}: {
  images: ManagedServiceImage[];
  serviceId: string;
  serviceName: string;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [altText, setAltText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function send(operation: "COVER" | "REMOVE" | "REORDER", value: string | string[]) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/management/services/${serviceId}/images`, {
        body: JSON.stringify(operation === "REORDER" ? { imageIds: value, operation } : { imageId: value, operation }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const result = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || "The gallery could not be updated.");
      setMessage(result.message || "Service images updated.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The gallery could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadFiles(files: FileList | null, replacesImageId?: string) {
    if (!files?.length) return;
    const description = altText.trim();
    if (!description) {
      setMessage("Describe the image before uploading it.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const selected = Array.from(files);
      for (const [index, file] of selected.entries()) {
        if (!ALLOWED_SERVICE_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_SERVICE_IMAGE_TYPES)[number]) || file.size < 1 || file.size > MAX_SERVICE_IMAGE_BYTES) {
          throw new Error("Use a JPG, PNG, or WebP image no larger than 8 MB.");
        }
        const imageId = crypto.randomUUID();
        const imageAlt = selected.length > 1 ? `${description} ${index + 1}` : description;
        await upload(serviceImagePath(imageId, file.name), file, {
          access: "private",
          clientPayload: JSON.stringify({ altText: imageAlt, imageId, originalFilename: file.name, replacesImageId: replacesImageId ?? null }),
          contentType: file.type,
          handleUploadUrl: `/api/management/services/${serviceId}/images/upload`,
          multipart: file.size > 4 * 1024 * 1024,
        });
      }
      setAltText("");
      if (fileInput.current) fileInput.current.value = "";
      setMessage(selected.length === 1 ? "Image uploaded." : `${selected.length} images uploaded.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The images could not be uploaded.");
    } finally {
      setBusy(false);
    }
  }

  function moved(index: number, direction: -1 | 1) {
    const next = [...images];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    void send("REORDER", next.map((image) => image.id));
  }

  return (
    <section aria-labelledby="service-images-heading">
      <h2 id="service-images-heading" className="text-xl font-semibold">Service images</h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        Add up to 12 JPG, PNG, or WebP images. The cover image appears first on the customer service card.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div>
          <label className="text-sm font-medium" htmlFor="service-image-alt">Image description</label>
          <Input
            className="mt-2"
            id="service-image-alt"
            maxLength={240}
            onChange={(event) => setAltText(event.target.value)}
            placeholder={`Example: Finished ${serviceName.toLowerCase()} sample`}
            value={altText}
          />
        </div>
        <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-primary bg-primary px-5 text-sm font-semibold text-primary-foreground outline-none hover:bg-primary-hover focus-within:ring-2 focus-within:ring-ring">
          {busy ? "Working…" : "Add images"}
          <input
            ref={fileInput}
            accept={ALLOWED_SERVICE_IMAGE_TYPES.join(",")}
            className="sr-only"
            disabled={busy}
            multiple
            onChange={(event) => void uploadFiles(event.target.files)}
            type="file"
          />
        </label>
      </div>

      {images.length ? (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2" aria-label="Current service images">
          {images.map((image, index) => (
            <li className="overflow-hidden rounded-xl border bg-surface-raised" key={image.id}>
              {/* A normal img is used because content is streamed from an authenticated server-owned Blob route. */}
              <img alt={image.altText} className="aspect-[4/3] w-full bg-muted-surface object-cover" src={`/api/service-images/${image.id}`} />
              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm leading-5">{image.altText}</p>
                  {image.isCover ? <span className="rounded-full bg-accent/20 px-2 py-1 text-xs font-semibold">Cover</span> : null}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button disabled={busy || image.isCover} onClick={() => void send("COVER", image.id)} variant="outline">Make cover</Button>
                  <Button disabled={busy} onClick={() => {
                    if (window.confirm("Remove this image from the service gallery?")) void send("REMOVE", image.id);
                  }} variant="outline">Remove</Button>
                  <Button disabled={busy || index === 0} onClick={() => moved(index, -1)} variant="outline">Move up</Button>
                  <Button disabled={busy || index === images.length - 1} onClick={() => moved(index, 1)} variant="outline">Move down</Button>
                </div>
                <label className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg border border-border-strong bg-surface px-4 text-sm font-semibold outline-none hover:bg-surface-hover focus-within:ring-2 focus-within:ring-ring">
                  Replace image
                  <input
                    accept={ALLOWED_SERVICE_IMAGE_TYPES.join(",")}
                    className="sr-only"
                    disabled={busy}
                    onChange={(event) => void uploadFiles(event.target.files, image.id)}
                    type="file"
                  />
                </label>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-6 rounded-xl border border-dashed bg-muted-surface p-6 text-center text-sm text-muted">
          No service images yet. Customers will see a clean neutral placeholder.
        </div>
      )}
      {message ? <p className="mt-4 text-sm" role="status">{message}</p> : null}
    </section>
  );
}
