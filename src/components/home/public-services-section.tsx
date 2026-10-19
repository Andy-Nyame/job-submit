import { Container } from "@/components/layout/container";
import type { PublicServicesResult } from "@/server/public/services";

import { PublicServiceCard } from "./public-service-card";

export function PublicServicesSection({ result }: { result: PublicServicesResult }) {
  return (
    <section aria-labelledby="services-heading" className="scroll-mt-24 border-y bg-surface-muted/55 py-20 sm:py-28" id="services" tabIndex={-1}>
      <Container>
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div>
            <p className="section-kicker">What we do</p>
            <h2 className="mt-4 max-w-xl text-3xl font-semibold tracking-[-0.04em] text-balance sm:text-5xl" id="services-heading">Print and design services, organized around your request.</h2>
          </div>
          <p className="max-w-2xl text-base leading-7 text-muted lg:justify-self-end lg:text-lg lg:leading-8">Explore the active service categories currently configured for Capt. Bob Cedi&apos;s Artworks. Each card clearly indicates fixed pricing or when individual pricing is required.</p>
        </div>

        {result.status === "ready" && result.services.length > 0 ? (
          <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {result.services.map((service, index) => <PublicServiceCard index={index} key={service.slug} service={service} />)}
          </div>
        ) : (
          <div className="mt-12 rounded-2xl border bg-surface p-7 sm:p-9" role="status">
            <p className="font-semibold">Service information is temporarily unavailable.</p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">The public catalogue could not be loaded safely. Please try again later or sign in if you already have JobSubmit access.</p>
          </div>
        )}
      </Container>
    </section>
  );
}
