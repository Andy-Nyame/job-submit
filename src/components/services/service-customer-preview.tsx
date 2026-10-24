import {
  formatQuantityRule,
  type ServiceQuantityConfiguration,
  type ServiceSpecificationConfiguration,
} from "@/domain/service-configuration";
import {
  formatGhanaCediMinor,
  type ServicePricingConfiguration,
} from "@/domain/service-pricing";

const artworkLabels = {
  BUSINESS_DESIGN: "The business will design the artwork.",
  CUSTOMER_PROVIDED: "Customer-provided artwork is required.",
  EITHER: "Provide artwork or ask the business to design it.",
  NOT_REQUIRED: "No artwork is required.",
} as const;

const dimensionLabels = {
  CM: "cm",
  FEET: "feet",
  INCHES: "inches",
  MM: "mm",
} as const;

function OptionList({ label, options, required }: { label: string; options: string[]; required: boolean }) {
  if (options.length === 0) return null;
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{label} {required ? "(required)" : "(optional)"}</dt>
      <dd className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => <span className="rounded-full border bg-surface-muted px-3 py-1 text-xs" key={option}>{option}</span>)}
      </dd>
    </div>
  );
}

function SizePreview({ specification }: { specification: ServiceSpecificationConfiguration }) {
  const { sizes } = specification;
  if (sizes.mode === "NO_SIZE") return null;
  if (sizes.mode === "FIXED" && sizes.fixed) {
    return (
      <div>
        <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Fixed size</dt>
        <dd className="mt-2 text-sm">{sizes.fixed.width} × {sizes.fixed.height} {dimensionLabels[sizes.fixed.unit]}</dd>
      </div>
    );
  }
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Size</dt>
      {sizes.options.length > 0 ? <dd className="mt-2 flex flex-wrap gap-2">{sizes.options.map((option) => <span className="rounded-full border bg-surface-muted px-3 py-1 text-xs" key={option}>{option}</span>)}</dd> : null}
      {sizes.customUnits.length > 0 ? <dd className="mt-2 text-sm">Custom width and height accepted in {sizes.customUnits.map((unit) => dimensionLabels[unit]).join(", ")}.</dd> : null}
    </div>
  );
}

export function ServiceCustomerPreview({
  description,
  name,
  onlineSubmissionEnabled,
  pricing,
  quantity,
  specification,
}: {
  description: string | null;
  name: string;
  onlineSubmissionEnabled: boolean;
  pricing: ServicePricingConfiguration;
  quantity: ServiceQuantityConfiguration | null;
  specification: ServiceSpecificationConfiguration | null;
}) {
  const quantitySummary = formatQuantityRule(quantity);
  return (
    <article className="rounded-xl border bg-surface p-5 shadow-[0_16px_40px_-36px_var(--shadow-color)] sm:p-6">
      <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted">Customer preview · saved configuration</p>
      <h2 className="mt-3 text-xl font-semibold tracking-tight">{name}</h2>
      <p className="mt-2 text-sm leading-6 text-muted">{description ?? "No public summary has been configured."}</p>

      <dl className="mt-6 space-y-5">
        {quantity && quantitySummary ? (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Quantity</dt>
            <dd className="mt-2 text-sm leading-6">{quantitySummary}{quantity.increment !== null ? ` · Multiples of ${quantity.increment.toLocaleString("en-US")}` : ""}</dd>
            {quantity.presets.length > 0 ? <dd className="mt-2 text-xs leading-5 text-muted">Quick choices: {quantity.presets.map((value) => value.toLocaleString("en-US")).join(", ")}. Other valid quantities remain available.</dd> : null}
          </div>
        ) : null}

        {specification ? (
          <>
            <SizePreview specification={specification} />
            <OptionList label="Materials" options={specification.materials.options} required={specification.materials.required} />
            <OptionList label="Finishing" options={specification.finishing.options} required={specification.finishing.required} />
            {specification.variations.enabled ? <div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Variations</dt><dd className="mt-2 text-sm leading-6">Several variations may be included. Quantity rules apply to their combined total.</dd></div> : null}
            {specification.customerFields.length > 0 ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Customer information</dt>
                <dd className="mt-2 space-y-1 text-sm leading-6">{specification.customerFields.map((field) => <p key={field.id}>{field.label} · {field.required ? "required" : "optional"} · {field.scope === "VARIATION" ? "for each variation" : "once per job"}</p>)}</dd>
              </div>
            ) : null}
            {specification.artworkRequirement ? <div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Artwork</dt><dd className="mt-2 text-sm">{artworkLabels[specification.artworkRequirement]}</dd></div> : null}
            {specification.customInstructions ? <div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">What to provide</dt><dd className="mt-2 text-sm leading-6">{specification.customInstructions}</dd></div> : null}
          </>
        ) : null}

        {pricing.mode === "FIXED" && pricing.fixed ? (
          <div className="rounded-lg border border-accent/35 bg-accent/10 p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Fixed pricing</dt>
            <dd className="mt-2 font-semibold">{pricing.fixed.startingQuantity.toLocaleString("en-US")} {quantity?.unit ?? "units"}: {formatGhanaCediMinor(BigInt(pricing.fixed.startingPriceMinor))}</dd>
            <dd className="mt-1 text-sm">Each additional {pricing.fixed.quantityStep.toLocaleString("en-US")}: +{formatGhanaCediMinor(BigInt(pricing.fixed.additionalStepPriceMinor))}</dd>
            <dd className="mt-2 text-xs leading-5 text-muted">Covers: {pricing.fixed.coverage}</dd>
            <dd className="mt-2 text-xs font-medium leading-5">Different sizes, materials, or finishes require individual review.</dd>
          </div>
        ) : (
          <div className="rounded-lg border bg-surface-muted p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Pricing</dt>
            <dd className="mt-2 font-semibold">Price on request</dd>
            <dd className="mt-1 text-xs leading-5 text-muted">The Owner currently confirms pricing after reviewing the job. No automatic total is calculated.</dd>
          </div>
        )}
      </dl>

      <p className="mt-6 border-t pt-4 text-xs font-medium leading-5 text-muted">
        {onlineSubmissionEnabled ? "Customers can choose this service for online job requests while the shop is open." : "This service is visible in the catalogue but is not enabled for online job requests."}
      </p>
    </article>
  );
}
