import Link from "next/link";

import { serviceCataloguePriceLabel } from "@/domain/service-catalogue";
import type { PublicService } from "@/server/public/services";
import { ServiceCatalogueImage } from "@/components/services/service-catalogue-image";
import { ServiceGalleryPreview } from "@/components/services/service-gallery-preview";

export function PublicServiceCard({ service }: { service: PublicService }) {
  const images = service.images ?? [];
  const cover = images.find((image) => image.isCover) ?? images[0];

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-surface transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-sm">
      <div className="relative overflow-hidden">
        <ServiceCatalogueImage alt={cover?.altText ?? ""} imageId={cover?.id} name={service.name} />
        <ServiceGalleryPreview images={images} serviceName={service.name} />
      </div>
      <div className="flex min-w-0 grow flex-col p-2.5 sm:p-3">
        <h3 className="break-words text-sm font-semibold leading-5 sm:text-[0.95rem]">{service.name}</h3>
        <p className="mt-1.5 text-xs font-semibold leading-5 text-primary">{serviceCataloguePriceLabel(service)}</p>
        {service.onlineSubmissionEnabled ? (
          <Link
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-2 text-center text-xs font-semibold text-primary-foreground outline-none hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            href={`/app/jobs/new?service=${encodeURIComponent(service.slug)}`}
          >
            Select Service
          </Link>
        ) : (
          <span aria-disabled="true" className="mt-3 inline-flex min-h-11 items-center justify-center rounded-lg border bg-muted-surface px-2 text-center text-xs font-semibold text-muted">
            Not available online
          </span>
        )}
      </div>
    </article>
  );
}
