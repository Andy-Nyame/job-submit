import { Input, Select, Textarea } from "@/components/ui/form-controls";
import {
  DIMENSION_UNITS,
  MAX_QUANTITY_UNIT_LENGTH,
  MAX_SERVICE_INSTRUCTIONS_LENGTH,
  MAX_SERVICE_QUANTITY,
  MAX_SPECIFICATION_OPTION_LENGTH,
  type ArtworkRequirement,
  type DimensionUnit,
} from "@/domain/service-configuration";
import {
  MAX_SERVICE_DESCRIPTION_LENGTH,
  MAX_SERVICE_NAME_LENGTH,
  type ServiceComplexityDefault,
  type ServiceWorkloadDefault,
} from "@/domain/service-policy";

export interface ServiceFormValues {
  artworkRequirement: ArtworkRequirement | "";
  customDimensionsEnabled: boolean;
  customDimensionsRequired: boolean;
  customInstructions: string;
  defaultComplexity: ServiceComplexityDefault | null;
  defaultWorkloadClass: ServiceWorkloadDefault | null;
  description: string;
  dimensionUnits: DimensionUnit[];
  finishingOptions: string;
  finishingRequired: boolean;
  indicativePriceDescription: string;
  indicativePriceMaximum: string;
  indicativePriceMinimum: string;
  isActive: boolean;
  materialOptions: string;
  materialsRequired: boolean;
  name: string;
  onlineSubmissionEnabled: boolean;
  proofRequiredByDefault: boolean | null;
  quantityIncrement: string;
  quantityMaximum: string;
  quantityMinimum: string;
  quantityPresets: string;
  quantityUnit: string;
  sizeOptions: string;
  sizesRequired: boolean;
}

const sectionClassName =
  "rounded-lg border bg-surface-raised p-4 open:shadow-[0_10px_30px_-28px_var(--shadow-color)] sm:p-5";
const summaryClassName =
  "cursor-pointer list-none rounded-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const checkboxClassName =
  "mt-1 size-4 shrink-0 accent-[var(--accent)] focus-visible:ring-2 focus-visible:ring-ring";

function RequiredToggle({
  defaultChecked,
  label,
  name,
}: {
  defaultChecked: boolean;
  label: string;
  name: string;
}) {
  return (
    <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted">
      <input
        className={checkboxClassName}
        defaultChecked={defaultChecked}
        name={name}
        type="checkbox"
      />
      <span>Customers must choose {label} when this option is shown.</span>
    </label>
  );
}

function OptionsField({
  defaultValue,
  description,
  id,
  label,
  name,
  placeholder,
  required,
  requiredName,
}: {
  defaultValue: string;
  description: string;
  id: string;
  label: string;
  name: string;
  placeholder: string;
  required: boolean;
  requiredName: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      <Textarea
        aria-describedby={`${id}-help`}
        className="mt-2 min-h-24"
        defaultValue={defaultValue}
        id={id}
        name={name}
        placeholder={placeholder}
      />
      <p className="mt-1.5 text-xs leading-5 text-muted" id={`${id}-help`}>
        {description} One customer-facing option per line, up to 20; each may
        contain up to {MAX_SPECIFICATION_OPTION_LENGTH} characters.
      </p>
      <RequiredToggle
        defaultChecked={required}
        label={label.toLocaleLowerCase("en")}
        name={requiredName}
      />
    </div>
  );
}

export function ServiceFormFields({
  includeActiveState,
  prefix,
  values,
}: {
  includeActiveState: boolean;
  prefix: string;
  values: ServiceFormValues;
}) {
  return (
    <div className="space-y-5">
      <fieldset className="space-y-5 rounded-lg border bg-surface-raised p-4 sm:p-5">
        <legend className="px-1 font-semibold">Basic information</legend>
        <div>
          <label className="text-sm font-medium" htmlFor={`${prefix}-name`}>
            Service name
          </label>
          <Input
            className="mt-2"
            defaultValue={values.name}
            id={`${prefix}-name`}
            maxLength={MAX_SERVICE_NAME_LENGTH}
            name="name"
            required
          />
        </div>

        <div>
          <label
            className="text-sm font-medium"
            htmlFor={`${prefix}-description`}
          >
            Public summary
          </label>
          <Textarea
            className="mt-2"
            defaultValue={values.description}
            id={`${prefix}-description`}
            maxLength={MAX_SERVICE_DESCRIPTION_LENGTH}
            name="description"
            placeholder="A concise, factual description of this service"
          />
          <p className="mt-1.5 text-xs leading-5 text-muted">
            If present, this summary can appear in the public catalogue.
          </p>
        </div>
      </fieldset>

      <details className={sectionClassName} open>
        <summary className={summaryClassName}>Quantity rules</summary>
        <p className="mt-2 text-xs leading-5 text-muted">
          Leave this section blank when quantity does not apply. Presets are
          shortcuts only; future customers may enter any valid custom quantity.
        </p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium" htmlFor={`${prefix}-unit`}>
              Quantity unit
            </label>
            <Input
              className="mt-2"
              defaultValue={values.quantityUnit}
              id={`${prefix}-unit`}
              maxLength={MAX_QUANTITY_UNIT_LENGTH}
              name="quantityUnit"
              placeholder="e.g. pieces, copies, sheets"
            />
          </div>
          <div>
            <label
              className="text-sm font-medium"
              htmlFor={`${prefix}-increment`}
            >
              Quantity increment
            </label>
            <Input
              className="mt-2"
              defaultValue={values.quantityIncrement}
              id={`${prefix}-increment`}
              max={MAX_SERVICE_QUANTITY}
              min={1}
              name="quantityIncrement"
              placeholder="Optional"
              type="number"
            />
          </div>
          <div>
            <label
              className="text-sm font-medium"
              htmlFor={`${prefix}-minimum`}
            >
              Minimum quantity
            </label>
            <Input
              className="mt-2"
              defaultValue={values.quantityMinimum}
              id={`${prefix}-minimum`}
              max={MAX_SERVICE_QUANTITY}
              min={1}
              name="quantityMinimum"
              placeholder="No service-specific minimum"
              type="number"
            />
          </div>
          <div>
            <label
              className="text-sm font-medium"
              htmlFor={`${prefix}-maximum`}
            >
              Maximum quantity
            </label>
            <Input
              className="mt-2"
              defaultValue={values.quantityMaximum}
              id={`${prefix}-maximum`}
              max={MAX_SERVICE_QUANTITY}
              min={1}
              name="quantityMaximum"
              placeholder="No configured upper bound"
              type="number"
            />
          </div>
        </div>
        <div className="mt-5">
          <label className="text-sm font-medium" htmlFor={`${prefix}-presets`}>
            Quantity presets
          </label>
          <Input
            className="mt-2"
            defaultValue={values.quantityPresets}
            id={`${prefix}-presets`}
            name="quantityPresets"
            placeholder="50, 100, 200, 500"
          />
          <p className="mt-1.5 text-xs leading-5 text-muted">
            Enter unique values in ascending order. With an increment, valid
            quantities start at the minimum (or the increment when no minimum
            is set) and advance by that step.
          </p>
        </div>
      </details>

      <details className={sectionClassName}>
        <summary className={summaryClassName}>Sizes &amp; specifications</summary>
        <p className="mt-2 text-xs leading-5 text-muted">
          Add only options the business actually offers for this service.
        </p>
        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <OptionsField
            defaultValue={values.sizeOptions}
            description="Examples: A4, A3, Custom dimensions."
            id={`${prefix}-sizes`}
            label="Size options"
            name="sizeOptions"
            placeholder={"A4\nA3"}
            required={values.sizesRequired}
            requiredName="sizesRequired"
          />
          <OptionsField
            defaultValue={values.materialOptions}
            description="Examples only: paper, white SAV, banner material."
            id={`${prefix}-materials`}
            label="Material options"
            name="materialOptions"
            placeholder={"Paper\nWhite SAV"}
            required={values.materialsRequired}
            requiredName="materialsRequired"
          />
          <OptionsField
            defaultValue={values.finishingOptions}
            description="Examples only: cutting, binding, eyelets."
            id={`${prefix}-finishing`}
            label="Finishing options"
            name="finishingOptions"
            placeholder={"Cutting\nBinding"}
            required={values.finishingRequired}
            requiredName="finishingRequired"
          />
          <fieldset>
            <legend className="text-sm font-medium">Custom dimensions</legend>
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input
                className={checkboxClassName}
                defaultChecked={values.customDimensionsEnabled}
                name="customDimensionsEnabled"
                type="checkbox"
              />
              <span>Allow width and height</span>
            </label>
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input
                className={checkboxClassName}
                defaultChecked={values.customDimensionsRequired}
                name="customDimensionsRequired"
                type="checkbox"
              />
              <span>Custom dimensions are required</span>
            </label>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-3">
              {DIMENSION_UNITS.map((unit) => (
                <label className="flex items-center gap-2 text-sm" key={unit}>
                  <input
                    className={checkboxClassName}
                    defaultChecked={values.dimensionUnits.includes(unit)}
                    name="dimensionUnits"
                    type="checkbox"
                    value={unit}
                  />
                  {unit === "INCHES" ? "inches" : unit === "FEET" ? "feet" : unit.toLowerCase()}
                </label>
              ))}
            </div>
            <p className="mt-3 text-xs leading-5 text-muted">
              Enable dimensions and select at least one measurement unit before
              saving.
            </p>
          </fieldset>
        </div>
      </details>

      <details className={sectionClassName}>
        <summary className={summaryClassName}>Artwork &amp; instructions</summary>
        <div className="mt-5 space-y-5">
          <div>
            <label
              className="text-sm font-medium"
              htmlFor={`${prefix}-artwork`}
            >
              Artwork requirement
            </label>
            <Select
              className="mt-2"
              defaultValue={values.artworkRequirement}
              id={`${prefix}-artwork`}
              name="artworkRequirement"
            >
              <option value="">Not configured</option>
              <option value="CUSTOMER_PROVIDED">Customer artwork required</option>
              <option value="BUSINESS_DESIGN">Business will design the artwork</option>
              <option value="EITHER">Customer artwork or business design</option>
              <option value="NOT_REQUIRED">No artwork required</option>
            </Select>
          </div>
          <div>
            <label
              className="text-sm font-medium"
              htmlFor={`${prefix}-instructions`}
            >
              Customer instructions
            </label>
            <Textarea
              className="mt-2"
              defaultValue={values.customInstructions}
              id={`${prefix}-instructions`}
              maxLength={MAX_SERVICE_INSTRUCTIONS_LENGTH}
              name="customInstructions"
              placeholder="What should a customer prepare or explain?"
            />
            <p className="mt-1.5 text-xs leading-5 text-muted">
              Plain text only. Keep this short and specific to the service.
            </p>
          </div>
        </div>
      </details>

      <details className={sectionClassName}>
        <summary className={summaryClassName}>Optional price guidance</summary>
        <p className="mt-2 text-xs leading-5 text-muted">
          Informational range only—not a quotation or automatic job price. Set
          both endpoints or leave both blank.
        </p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium" htmlFor={`${prefix}-price-min`}>
              Minimum estimate (GH₵)
            </label>
            <Input
              className="mt-2"
              defaultValue={values.indicativePriceMinimum}
              id={`${prefix}-price-min`}
              inputMode="decimal"
              name="indicativePriceMinimum"
              pattern="(?:0|[1-9][0-9]{0,6})(?:\.[0-9]{1,2})?"
              placeholder="e.g. 50.00"
            />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor={`${prefix}-price-max`}>
              Maximum estimate (GH₵)
            </label>
            <Input
              className="mt-2"
              defaultValue={values.indicativePriceMaximum}
              id={`${prefix}-price-max`}
              inputMode="decimal"
              name="indicativePriceMaximum"
              pattern="(?:0|[1-9][0-9]{0,6})(?:\.[0-9]{1,2})?"
              placeholder="e.g. 150.00"
            />
          </div>
        </div>
        <div className="mt-5">
          <label
            className="text-sm font-medium"
            htmlFor={`${prefix}-price-description`}
          >
            Estimate context
          </label>
          <Textarea
            className="mt-2 min-h-24"
            defaultValue={values.indicativePriceDescription}
            id={`${prefix}-price-description`}
            maxLength={MAX_SERVICE_INSTRUCTIONS_LENGTH}
            name="indicativePriceDescription"
            placeholder="Explain any quantity, size, material, or specification assumptions."
          />
        </div>
      </details>

      <details className={sectionClassName}>
        <summary className={summaryClassName}>Workflow &amp; availability</summary>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <label
              className="text-sm font-medium"
              htmlFor={`${prefix}-complexity`}
            >
              Default complexity
            </label>
            <Select
              className="mt-2"
              defaultValue={values.defaultComplexity ?? ""}
              id={`${prefix}-complexity`}
              name="defaultComplexity"
            >
              <option value="">No default</option>
              <option value="SIMPLE">Simple</option>
              <option value="MEDIUM">Medium</option>
              <option value="COMPLEX">Complex</option>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor={`${prefix}-workload`}>
              Default workload
            </label>
            <Select
              className="mt-2"
              defaultValue={values.defaultWorkloadClass ?? ""}
              id={`${prefix}-workload`}
              name="defaultWorkloadClass"
            >
              <option value="">No default</option>
              <option value="QUICK">Quick</option>
              <option value="STANDARD">Standard</option>
              <option value="FOCUS">Focus</option>
            </Select>
          </div>
        </div>
        <div className="mt-5">
          <label className="text-sm font-medium" htmlFor={`${prefix}-proof`}>
            Proof requirement default
          </label>
          <Select
            className="mt-2"
            defaultValue={
              values.proofRequiredByDefault === null
                ? ""
                : values.proofRequiredByDefault
                  ? "required"
                  : "not-required"
            }
            id={`${prefix}-proof`}
            name="proofRequiredByDefault"
          >
            <option value="">Decide per job</option>
            <option value="required">Proof normally required</option>
            <option value="not-required">Proof not required by default</option>
          </Select>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted">
          Workflow defaults guide future review only. Every job may receive its
          own classification.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="flex min-h-11 items-start gap-3 rounded-md border bg-surface-muted p-4 text-sm">
            <input
              className={checkboxClassName}
              defaultChecked={values.onlineSubmissionEnabled}
              name="onlineSubmissionEnabled"
              type="checkbox"
            />
            <span>
              <span className="font-medium">Online submission eligible</span>
              <span className="mt-1 block leading-5 text-muted">
                Configuration only; job submission is not live yet.
              </span>
            </span>
          </label>

          {includeActiveState ? (
            <label className="flex min-h-11 items-start gap-3 rounded-md border bg-surface-muted p-4 text-sm">
              <input
                className={checkboxClassName}
                defaultChecked={values.isActive}
                name="isActive"
                type="checkbox"
              />
              <span>
                <span className="font-medium">Create as active</span>
                <span className="mt-1 block leading-5 text-muted">
                  Active services appear in the public catalogue.
                </span>
              </span>
            </label>
          ) : null}
        </div>
      </details>
    </div>
  );
}
