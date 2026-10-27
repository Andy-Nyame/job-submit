"use client";

import { useMemo, useState } from "react";

import type { SubmissionService } from "@/domain/job-submission";
import {
  filterCatalogueServices,
  serviceCataloguePriceLabel,
} from "@/domain/service-catalogue";
import { Input } from "@/components/ui/form-controls";
import { ServiceCatalogueImage } from "@/components/services/service-catalogue-image";
import { ServiceGalleryPreview } from "@/components/services/service-gallery-preview";

export function CustomerServiceCatalogue({
  onClearSelection,
  onSelect,
  selectedServiceId,
  services,
}: {
  onClearSelection: () => void;
  onSelect: (serviceId: string) => void;
  selectedServiceId: string;
  services: SubmissionService[];
}) {
  const [query, setQuery] = useState("");
  const visibleServices = useMemo(
    () => filterCatalogueServices(services, query),
    [query, services],
  );
  const selectedService = services.find((service) => service.id === selectedServiceId);

  return (
    <>
      <div className="mt-5" role="search">
        <label className="sr-only" htmlFor="service-search">Search services</label>
        <div className="flex items-center gap-2">
          <Input
            autoComplete="off"
            id="service-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search services..."
            type="search"
            value={query}
          />
          {query ? (
            <button
              className="min-h-11 shrink-0 rounded-lg border px-3 text-sm font-semibold outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setQuery("")}
              type="button"
            >
              Clear
            </button>
          ) : null}
        </div>
        <p aria-live="polite" className="mt-2 text-xs text-muted">
          {visibleServices.length} {visibleServices.length === 1 ? "service" : "services"}
        </p>
      </div>

      {visibleServices.length ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visibleServices.map((service) => {
            const selected = service.id === selectedServiceId;
            const images = service.images ?? [];
            const cover = images.find((image) => image.isCover) ?? images[0];
            return (
              <article
                className={selected
                  ? "flex min-w-0 flex-col overflow-hidden rounded-xl border-2 border-primary bg-primary-surface shadow-sm"
                  : "flex min-w-0 flex-col overflow-hidden rounded-xl border bg-surface transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-sm"}
                key={service.id}
              >
                <div className="relative overflow-hidden">
                  <ServiceCatalogueImage alt={cover?.altText ?? ""} imageId={cover?.id} name={service.name} />
                  <ServiceGalleryPreview images={images} serviceName={service.name} />
                </div>
                <div className="flex min-w-0 grow flex-col p-2.5 sm:p-3">
                  <h3 className="break-words text-sm font-semibold leading-5 sm:text-[0.95rem]">{service.name}</h3>
                  <p className="mt-1.5 text-xs font-semibold leading-5 text-primary">{serviceCataloguePriceLabel(service)}</p>
                  <button
                    aria-pressed={selected}
                    className={selected
                      ? "mt-3 min-h-11 w-full rounded-lg border border-primary bg-primary-surface-foreground px-2 text-xs font-semibold text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      : "mt-3 min-h-11 w-full rounded-lg bg-primary px-2 text-xs font-semibold text-primary-foreground outline-none hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"}
                    onClick={() => onSelect(service.id)}
                    type="button"
                  >
                    {selected ? "Selected" : "Select Service"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed bg-muted-surface p-6 text-center" role="status">
          <p className="font-semibold">No services match your search.</p>
          <p className="mt-1 text-sm text-muted">Try another word, such as sticker, banner, poster, label, or website.</p>
          <button className="mt-4 min-h-11 rounded-lg border px-4 text-sm font-semibold outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setQuery("")} type="button">Clear search</button>
        </div>
      )}

      {selectedService ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary-surface p-3" role="status">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Selected service</p>
            <p className="mt-1 font-semibold">{selectedService.name}</p>
            <p className="mt-1 text-xs text-primary">{serviceCataloguePriceLabel(selectedService)}</p>
          </div>
          <button className="min-h-11 rounded-lg border border-primary/35 bg-surface px-3 text-sm font-semibold outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring" onClick={onClearSelection} type="button">Remove</button>
        </div>
      ) : null}
    </>
  );
}
