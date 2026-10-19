import {
  formatIndicativePriceRange,
  INDICATIVE_PRICE_DISCLAIMER,
  type ServiceQuantityConfiguration,
  type ServiceSpecificationConfiguration,
} from "@/domain/service-configuration";

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

function OptionList({
  label,
  options,
  required,
}: {
  label: string;
  options: string[];
  required: boolean;
}) {
  if (options.length === 0) {
    return null;
  }
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
        {label} {required ? "(required)" : "(optional)"}
      </dt>
      <dd className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => (
          <span
            className="rounded-full border bg-surface-muted px-3 py-1 text-xs"
            key={option}
          >
            {option}
          </span>
        ))}
      </dd>
    </div>
  );
}

export function ServiceCustomerPreview({
  description,
  indicativePriceDescription,
  indicativePriceMaximum,
  indicativePriceMinimum,
  name,
  onlineSubmissionEnabled,
  quantity,
  specification,
}: {
  description: string | null;
  indicativePriceDescription: string | null;
  indicativePriceMaximum: bigint | null;
  indicativePriceMinimum: bigint | null;
  name: string;
  onlineSubmissionEnabled: boolean;
  quantity: ServiceQuantityConfiguration | null;
  specification: ServiceSpecificationConfiguration | null;
}) {
  return (
    <article className="rounded-xl border bg-surface p-5 shadow-[0_16px_40px_-36px_var(--shadow-color)] sm:p-6">
      <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted">
        Customer preview · saved configuration
      </p>
      <h2 className="mt-3 text-xl font-semibold tracking-tight">{name}</h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        {description ?? "No public summary has been configured."}
      </p>

      <dl className="mt-6 space-y-5">
        {quantity ? (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              Quantity ({quantity.unit})
            </dt>
            <dd className="mt-2 text-sm leading-6">
              {quantity.minimum !== null
                ? `Minimum ${quantity.minimum.toLocaleString("en-US")}`
                : "Any positive quantity"}
              {quantity.maximum !== null
                ? ` · Maximum ${quantity.maximum.toLocaleString("en-US")}`
                : " · No configured maximum"}
              {quantity.increment !== null
                ? ` · Steps of ${quantity.increment.toLocaleString("en-US")}`
                : ""}
            </dd>
            {quantity.presets.length > 0 ? (
              <dd className="mt-2 text-xs leading-5 text-muted">
                Quick choices: {quantity.presets.map((value) => value.toLocaleString("en-US")).join(", ")}. Custom valid quantities remain available.
              </dd>
            ) : null}
          </div>
        ) : null}

        {specification ? (
          <>
            <OptionList
              label="Sizes"
              options={specification.sizes.options}
              required={specification.sizes.required}
            />
            <OptionList
              label="Materials"
              options={specification.materials.options}
              required={specification.materials.required}
            />
            <OptionList
              label="Finishing"
              options={specification.finishing.options}
              required={specification.finishing.required}
            />
            {specification.customDimensions.enabled ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                  Custom dimensions {specification.customDimensions.required ? "(required)" : "(optional)"}
                </dt>
                <dd className="mt-2 text-sm">
                  Width and height accepted in {specification.customDimensions.units.map((unit) => dimensionLabels[unit]).join(", ")}.
                </dd>
              </div>
            ) : null}
            {specification.artworkRequirement ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                  Artwork
                </dt>
                <dd className="mt-2 text-sm">
                  {artworkLabels[specification.artworkRequirement]}
                </dd>
              </div>
            ) : null}
            {specification.customInstructions ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                  What to provide
                </dt>
                <dd className="mt-2 text-sm leading-6">
                  {specification.customInstructions}
                </dd>
              </div>
            ) : null}
          </>
        ) : null}

        {indicativePriceMinimum !== null && indicativePriceMaximum !== null ? (
          <div className="rounded-lg border border-accent/35 bg-accent/10 p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              Indicative price range
            </dt>
            <dd className="mt-2 font-semibold">
              {formatIndicativePriceRange(
                indicativePriceMinimum,
                indicativePriceMaximum,
              )}
            </dd>
            {indicativePriceDescription ? (
              <dd className="mt-2 text-xs leading-5 text-muted">
                {indicativePriceDescription}
              </dd>
            ) : null}
            <dd className="mt-2 text-xs font-medium leading-5">
              {INDICATIVE_PRICE_DISCLAIMER}
            </dd>
          </div>
        ) : null}
      </dl>

      <p className="mt-6 border-t pt-4 text-xs font-medium leading-5 text-muted">
        {onlineSubmissionEnabled
          ? "This service is configured for future online submission. Online job submission is not live yet."
          : "This service is visible in the catalogue but is not enabled for online submission."}
      </p>
    </article>
  );
}
