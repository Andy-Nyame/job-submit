import type { ReactNode } from "react";

import {
  formatQuantityRule,
  readQuantityConfiguration,
  readSpecificationConfiguration,
} from "@/domain/service-configuration";
import {
  formatGhanaCediMinor,
  readPricingConfiguration,
} from "@/domain/service-pricing";
import type { PublicService } from "@/server/public/services";

const serviceDescriptions: Record<string, string> = {
  designing: "Design support for clearly briefed print materials and customer artwork.",
  "sav-sticker-printing": "Sticker and self-adhesive vinyl requests, organized from brief to pickup.",
  "flexi-banner-printing": "Banner printing requests reviewed against the artwork and instructions supplied.",
  "document-printing": "Document printing requests with files, quantities, and notes kept together.",
  "for-sale-sticker-printing": "Dedicated production for For Sale sticker printing requests.",
  "container-head-sticker-batch-numbers-printing": "Container identification and batch-number printing requests.",
};

function ServiceIcon({ slug }: { slug: string }) {
  let drawing: ReactNode;
  switch (slug) {
    case "designing":
      drawing = <><path d="m6 19 1.4-5.1L17.8 3.5a2 2 0 0 1 2.8 2.8L10.2 16.7 6 19Z" /><path d="m14.8 6.5 2.7 2.7M7.4 13.9l2.8 2.8" /></>;
      break;
    case "sav-sticker-printing":
    case "for-sale-sticker-printing":
      drawing = <><path d="M4 4h10l6 6-10 10-6-6V4Z" /><circle cx="9" cy="9" r="1.5" /></>;
      break;
    case "flexi-banner-printing":
      drawing = <><path d="M4 5h16v11H4zM7 16v4m10-4v4M8 9h8m-8 3h5" /></>;
      break;
    case "document-printing":
      drawing = <><path d="M7 3h8l4 4v14H7V3Z" /><path d="M15 3v5h4M10 12h6m-6 4h6" /></>;
      break;
    case "container-head-sticker-batch-numbers-printing":
      drawing = <><path d="M3 7h18v12H3zM7 7V4h10v3M7 11h2m3 0h2m3 0h1M7 15h10" /></>;
      break;
    default:
      drawing = <><path d="M5 4h14v16H5zM8 8h8m-8 4h8m-8 4h5" /></>;
  }
  return (
    <span className="grid size-11 place-items-center rounded-xl border border-accent/35 bg-accent/10 text-foreground">
      <svg aria-hidden="true" className="size-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45" viewBox="0 0 24 24">{drawing}</svg>
    </span>
  );
}

export function PublicServiceCard({ index, service }: { index: number; service: PublicService }) {
  const description = service.description ?? serviceDescriptions[service.slug] ?? "A service request reviewed against the details and artwork supplied.";
  const quantity = readQuantityConfiguration(service.quantityConfiguration);
  const specification = readSpecificationConfiguration(service.specificationConfiguration);
  const pricing = readPricingConfiguration(service.pricingConfiguration);
  const quantitySummary = formatQuantityRule(quantity);
  const specificationSummary = specification
    ? [
        specification.sizes.mode !== "NO_SIZE" ? "sizes" : null,
        specification.materials.options.length > 0 ? "materials" : null,
        specification.finishing.options.length > 0 ? "finishing" : null,
        specification.customerFields.length > 0 ? "customer details" : null,
      ].filter(Boolean)
    : [];

  return (
    <article className="group relative overflow-hidden rounded-2xl border bg-surface p-6 transition-[border-color,transform] hover:-translate-y-1 hover:border-accent/70 sm:p-7">
      <div className="flex items-start justify-between gap-4"><ServiceIcon slug={service.slug} /><span className="font-mono text-xs text-muted">{String(index + 1).padStart(2, "0")}</span></div>
      <h3 className="mt-8 max-w-xs text-xl font-semibold tracking-[-0.025em]">{service.name}</h3>
      <p className="mt-3 max-w-sm text-sm leading-6 text-muted">{description}</p>
      {quantitySummary || specificationSummary.length > 0 ? (
        <p className="mt-4 text-xs leading-5 text-muted">
          {quantitySummary}{quantitySummary && specificationSummary.length > 0 ? " · " : null}{specificationSummary.length > 0 ? `Options for ${specificationSummary.join(", ")}` : null}
        </p>
      ) : null}
      {pricing.mode === "FIXED" && pricing.fixed ? (
        <div className="mt-4 rounded-lg border border-accent/35 bg-accent/10 p-3">
          <p className="text-sm font-semibold">From {formatGhanaCediMinor(BigInt(pricing.fixed.startingPriceMinor))} for {pricing.fixed.startingQuantity.toLocaleString("en-US")} {quantity?.unit ?? "units"}</p>
          <p className="mt-1 text-xs leading-5 text-muted">Each additional {pricing.fixed.quantityStep.toLocaleString("en-US")}: +{formatGhanaCediMinor(BigInt(pricing.fixed.additionalStepPriceMinor))}.</p>
          <p className="mt-1 text-xs leading-5 text-muted">Covers: {pricing.fixed.coverage}</p>
        </div>
      ) : <p className="mt-4 text-sm font-semibold">Price on request</p>}
      <p className="mt-4 border-t pt-3 text-xs font-medium leading-5 text-muted">{service.onlineSubmissionEnabled ? "Prepared for future online submission; submission is not live yet." : "Available in the public catalogue; online submission is not enabled."}</p>
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 origin-left scale-x-0 bg-accent transition-transform group-hover:scale-x-100" />
    </article>
  );
}
