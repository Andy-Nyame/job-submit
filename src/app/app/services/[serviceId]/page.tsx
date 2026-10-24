import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Container } from "@/components/layout/container";
import { ApprovedServiceForm } from "@/components/services/approved-service-form";
import { ServiceCustomerPreview } from "@/components/services/service-customer-preview";
import { ServiceStatusForm } from "@/components/services/service-status-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  readQuantityConfiguration,
  readSpecificationConfiguration,
} from "@/domain/service-configuration";
import { readPricingConfiguration } from "@/domain/service-pricing";
import { requireBusinessMembership } from "@/server/auth/authorization";
import { getManagedService } from "@/server/services/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Manage service" };

interface ServicePageProps {
  params: Promise<{ serviceId: string }>;
}

export default async function ServicePage({ params }: ServicePageProps) {
  const principal = await requireBusinessMembership();
  if (principal.role !== "OWNER" && principal.role !== "ADMIN") {
    redirect("/app");
  }

  const { serviceId } = await params;
  const { service } = await getManagedService(serviceId);
  if (!service) {
    notFound();
  }
  const quantity = readQuantityConfiguration(service.quantityConfiguration);
  const specification = readSpecificationConfiguration(
    service.specificationConfiguration,
  );
  const pricing = readPricingConfiguration(service.pricingConfiguration);

  return (
    <main id="main-content" className="py-10 sm:py-14">
      <Container className="max-w-5xl">
        <Link
          className="text-sm font-medium text-muted underline decoration-accent underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          href="/app/services"
        >
          Back to services
        </Link>
        <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              Service settings
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {service.name}
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              Edit the existing record while preserving its stable identity and
              historical relationships.
            </p>
          </div>
          <Badge>{service.isActive ? "ACTIVE" : "INACTIVE"}</Badge>
        </header>

        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
          <Card>
            <h2 className="text-xl font-semibold">Service configuration</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Service defaults guide future review only. They never determine
              an individual job&apos;s final classification or customer price.
            </p>
            <div className="mt-6">
              <ApprovedServiceForm
                allowPriceNegotiation={service.allowPriceNegotiation}
                description={service.description ?? ""}
                name={service.name}
                onlineSubmissionEnabled={service.onlineSubmissionEnabled}
                pricingConfiguration={service.pricingConfiguration}
                serviceId={service.id}
                slug={service.slug}
                version={service.version}
              />
            </div>
          </Card>

          <aside className="space-y-6">
            <ServiceCustomerPreview
              description={service.description}
              name={service.name}
              onlineSubmissionEnabled={service.onlineSubmissionEnabled}
              pricing={pricing}
              quantity={quantity}
              specification={specification}
            />

            <Card className="p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Catalogue status</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                {service.isActive
                  ? "Deactivation removes this service from the public catalogue without deleting its record or history."
                  : "Restoration makes this service eligible for the public active catalogue again."}
              </p>
              <div className="mt-5">
                <ServiceStatusForm
                  active={service.isActive}
                  serviceId={service.id}
                  version={service.version}
                />
              </div>
            </Card>
          </aside>
        </div>
      </Container>
    </main>
  );
}
