import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Container } from "@/components/layout/container";
import { EditServiceForm } from "@/components/services/edit-service-form";
import { ServiceCustomerPreview } from "@/components/services/service-customer-preview";
import { ServiceStatusForm } from "@/components/services/service-status-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  formatMoneyInput,
  readQuantityConfiguration,
  readSpecificationConfiguration,
} from "@/domain/service-configuration";
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
              <EditServiceForm
                serviceId={service.id}
                values={{
                  artworkRequirement:
                    specification?.artworkRequirement ?? "",
                  customDimensionsEnabled:
                    specification?.customDimensions.enabled ?? false,
                  customDimensionsRequired:
                    specification?.customDimensions.required ?? false,
                  customInstructions:
                    specification?.customInstructions ?? "",
                  defaultComplexity: service.defaultComplexity,
                  defaultWorkloadClass: service.defaultWorkloadClass,
                  description: service.description ?? "",
                  dimensionUnits:
                    specification?.customDimensions.units ?? [],
                  finishingOptions:
                    specification?.finishing.options.join("\n") ?? "",
                  finishingRequired:
                    specification?.finishing.required ?? false,
                  indicativePriceDescription:
                    service.indicativePriceDescription ?? "",
                  indicativePriceMaximum: formatMoneyInput(
                    service.indicativePriceMaxMinor,
                  ),
                  indicativePriceMinimum: formatMoneyInput(
                    service.indicativePriceMinMinor,
                  ),
                  isActive: service.isActive,
                  materialOptions:
                    specification?.materials.options.join("\n") ?? "",
                  materialsRequired:
                    specification?.materials.required ?? false,
                  name: service.name,
                  onlineSubmissionEnabled: service.onlineSubmissionEnabled,
                  proofRequiredByDefault: service.proofRequiredByDefault,
                  quantityIncrement: quantity?.increment?.toString() ?? "",
                  quantityMaximum: quantity?.maximum?.toString() ?? "",
                  quantityMinimum: quantity?.minimum?.toString() ?? "",
                  quantityPresets: quantity?.presets.join(", ") ?? "",
                  quantityUnit: quantity?.unit ?? "",
                  sizeOptions: specification?.sizes.options.join("\n") ?? "",
                  sizesRequired: specification?.sizes.required ?? false,
                }}
                version={service.version}
              />
            </div>
          </Card>

          <aside className="space-y-6">
            <ServiceCustomerPreview
              description={service.description}
              indicativePriceDescription={service.indicativePriceDescription}
              indicativePriceMaximum={service.indicativePriceMaxMinor}
              indicativePriceMinimum={service.indicativePriceMinMinor}
              name={service.name}
              onlineSubmissionEnabled={service.onlineSubmissionEnabled}
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
