import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Container } from "@/components/layout/container";
import { CreateServiceForm } from "@/components/services/create-service-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form-controls";
import { requireBusinessMembership } from "@/server/auth/authorization";
import {
  getServicesPageData,
  type ServiceListFilter,
} from "@/server/services/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Services" };

const serviceFilters = new Set<ServiceListFilter>([
  "ALL",
  "ACTIVE",
  "INACTIVE",
]);

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

interface ServicesPageProps {
  searchParams: Promise<{ q?: string; status?: string }>;
}

export default async function ServicesPage({ searchParams }: ServicesPageProps) {
  const principal = await requireBusinessMembership();
  if (principal.role !== "OWNER" && principal.role !== "ADMIN") {
    redirect("/app");
  }

  const params = await searchParams;
  const requestedStatus = (params.status?.toUpperCase() ??
    "ALL") as ServiceListFilter;
  const status = serviceFilters.has(requestedStatus) ? requestedStatus : "ALL";
  const query = params.q?.slice(0, 160) ?? "";
  const data = await getServicesPageData({ query, status });

  return (
    <main id="main-content" className="py-10 sm:py-14">
      <Container>
        <header className="max-w-3xl">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Catalogue management
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Services
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Manage the service categories customers can discover, including
            quantity, pricing, size, customer-information, and availability
            rules in straightforward sections.
          </p>
        </header>

        <div className="mt-8 space-y-10">
          <section aria-labelledby="service-list-heading">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="text-xl font-semibold" id="service-list-heading">
                Service catalogue
              </h2>
              <form className="grid w-full gap-3 sm:grid-cols-[1fr_10rem_auto] lg:max-w-2xl">
                <div>
                  <label className="sr-only" htmlFor="service-search">
                    Search services by name
                  </label>
                  <Input
                    defaultValue={query}
                    id="service-search"
                    maxLength={160}
                    name="q"
                    placeholder="Search service name"
                    type="search"
                  />
                </div>
                <div>
                  <label className="sr-only" htmlFor="service-status-filter">
                    Filter services by status
                  </label>
                  <Select
                    defaultValue={status}
                    id="service-status-filter"
                    name="status"
                  >
                    <option value="ALL">All states</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </Select>
                </div>
                <button
                  className="min-h-11 rounded-lg border border-primary bg-primary px-4 text-sm font-semibold text-primary-foreground outline-none transition-colors hover:border-primary-hover hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  type="submit"
                >
                  Apply
                </button>
              </form>
            </div>

            {data.services.length === 0 ? (
              <Card className="mt-5">
                <p className="text-sm text-muted">
                  No services match the current search and filter.
                </p>
              </Card>
            ) : (
              <div className="mt-5 grid gap-4">
                {data.services.map((service) => (
                  <Card className="p-5 sm:p-6" key={service.id}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold">{service.name}</h3>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">
                          {service.description ?? "No public summary configured."}
                        </p>
                      </div>
                      <Badge>{service.isActive ? "ACTIVE" : "INACTIVE"}</Badge>
                    </div>
                    <dl className="mt-4 grid gap-2 text-xs text-muted sm:grid-cols-3">
                      <div>
                        <dt className="font-medium text-foreground">Online</dt>
                        <dd>
                          {service.onlineSubmissionEnabled
                            ? "Eligible when launched"
                            : "Not enabled"}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-medium text-foreground">Setup</dt>
                        <dd>
                          {service.quantityConfiguration ||
                          service.specificationConfiguration ||
                          service.pricingConfiguration
                            ? "Service options configured"
                            : "Basic catalogue details"}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-medium text-foreground">Updated</dt>
                        <dd>{formatDate(service.updatedAt)}</dd>
                      </div>
                    </dl>
                    <Link
                      className="mt-5 inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-medium outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring"
                      href={`/app/services/${service.id}`}
                    >
                      Manage service
                    </Link>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby="create-service-heading">
            <Card className="p-5 sm:p-6 lg:p-8">
              <h2 className="text-xl font-semibold" id="create-service-heading">
                Create service
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                Add a distinct service category. Catalogue order is assigned
                automatically; advanced options can stay blank when they are not
                relevant.
              </p>
              <div className="mt-6 max-w-5xl">
                <CreateServiceForm />
              </div>
            </Card>
          </section>
        </div>
      </Container>
    </main>
  );
}
