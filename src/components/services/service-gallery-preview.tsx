"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { ServiceCatalogueImage } from "./service-catalogue-image";

export interface ServiceGalleryImage {
  altText: string;
  id: string;
}

export function ServiceGalleryPreview({
  images,
  serviceName,
}: {
  images: ServiceGalleryImage[];
  serviceName: string;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : triggerRef.current;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        setActiveIndex((current) =>
          event.key === "ArrowRight"
            ? (current + 1) % images.length
            : (current - 1 + images.length) % images.length,
        );
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      window.requestAnimationFrame(() => previousFocus?.focus());
    };
  }, [close, images.length, open]);

  if (images.length < 2) return null;
  const active = images[activeIndex] ?? images[0];

  return (
    <>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        className="absolute inset-x-2 bottom-2 min-h-11 rounded-lg border border-white/30 bg-brand-panel/90 px-2 text-xs font-semibold text-brand-panel-foreground shadow-sm outline-none hover:bg-brand-panel focus-visible:ring-2 focus-visible:ring-white"
        onClick={() => {
          setActiveIndex(0);
          setOpen(true);
        }}
        ref={triggerRef}
        type="button"
      >
        View examples ({images.length})
      </button>

      {open && typeof document !== "undefined" ? createPortal(
        <div
          aria-labelledby={titleId}
          aria-modal="true"
          className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/65 p-4 sm:p-8"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) close();
          }}
          ref={dialogRef}
          role="dialog"
        >
          <div className="my-auto w-full max-w-3xl rounded-2xl border bg-surface p-4 shadow-xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Service examples</p>
                <h2 className="mt-1 text-xl font-semibold" id={titleId}>{serviceName}</h2>
              </div>
              <button
                aria-label="Close service examples"
                className="grid size-11 shrink-0 place-items-center rounded-full border text-xl outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring"
                onClick={close}
                type="button"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <div className="mx-auto mt-4 max-w-sm overflow-hidden rounded-xl border bg-muted-surface">
              <ServiceCatalogueImage alt={active.altText} imageId={active.id} name={serviceName} />
            </div>
            <p aria-live="polite" className="mt-3 text-center text-xs text-muted">
              Image {activeIndex + 1} of {images.length}
            </p>

            <div className="mt-4 flex items-center justify-between gap-3">
              <button className="min-h-11 rounded-lg border px-4 text-sm font-semibold outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setActiveIndex((activeIndex - 1 + images.length) % images.length)} type="button">Previous</button>
              <button className="min-h-11 rounded-lg border px-4 text-sm font-semibold outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setActiveIndex((activeIndex + 1) % images.length)} type="button">Next</button>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6" aria-label="Choose an example image">
              {images.map((image, index) => (
                <button
                  aria-label={`View ${serviceName} example ${index + 1}`}
                  aria-pressed={index === activeIndex}
                  className={index === activeIndex ? "overflow-hidden rounded-lg border-2 border-primary outline-none focus-visible:ring-2 focus-visible:ring-ring" : "overflow-hidden rounded-lg border outline-none hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring"}
                  key={image.id}
                  onClick={() => setActiveIndex(index)}
                  type="button"
                >
                  <ServiceCatalogueImage alt="" imageId={image.id} name={serviceName} />
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
