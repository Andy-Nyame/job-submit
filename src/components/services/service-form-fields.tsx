"use client";

import { useState } from "react";

import { Input, Select, Textarea } from "@/components/ui/form-controls";
import {
  CUSTOMER_FIELD_SCOPES,
  CUSTOMER_FIELD_TYPES,
  DIMENSION_UNITS,
  MAX_CUSTOM_FIELDS,
  MAX_LONG_TEXT_LENGTH,
  MAX_QUANTITY_UNIT_LENGTH,
  MAX_SERVICE_INSTRUCTIONS_LENGTH,
  MAX_SERVICE_QUANTITY,
  MAX_SHORT_TEXT_LENGTH,
  MAX_SPECIFICATION_OPTION_LENGTH,
  SIZE_MODES,
  type CustomerFieldConfigurationInput,
} from "@/domain/service-configuration";
import {
  MAX_SERVICE_DESCRIPTION_LENGTH,
  MAX_SERVICE_NAME_LENGTH,
  SERVICE_DIFFICULTY_DEFAULTS,
  type ServiceComplexityDefault,
} from "@/domain/service-policy";

export interface ServiceFormValues {
  allowPriceNegotiation: boolean;
  additionalStepPrice: string;
  artworkRequirement: string;
  customDimensionUnits: string[];
  customFields: CustomerFieldConfigurationInput[];
  customInstructions: string;
  defaultComplexity: ServiceComplexityDefault | null;
  description: string;
  finishingOptions: string;
  finishingRequired: boolean;
  fixedPriceCoverage: string;
  fixedSizeHeight: string;
  fixedSizeUnit: string;
  fixedSizeWidth: string;
  isActive: boolean;
  materialOptions: string;
  materialsRequired: boolean;
  name: string;
  onlineSubmissionEnabled: boolean;
  pricingMode: "FIXED" | "ON_REQUEST";
  quantityIncrement: string;
  quantityMaximum: string;
  quantityMinimum: string;
  quantityPresets: string;
  quantityUnit: string;
  sizeMode: string;
  standardSizeOptions: string;
  startingPrice: string;
  startingQuantity: string;
  variationsEnabled: boolean;
}

const sectionClassName =
  "rounded-lg border bg-surface-raised p-4 open:shadow-[0_10px_30px_-28px_var(--shadow-color)] sm:p-5";
const summaryClassName =
  "cursor-pointer list-none rounded-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const checkboxClassName =
  "mt-1 size-4 shrink-0 accent-[var(--accent)] focus-visible:ring-2 focus-visible:ring-ring";

function OptionsField({
  defaultValue,
  description,
  id,
  label,
  name,
  placeholder,
}: {
  defaultValue: string;
  description: string;
  id: string;
  label: string;
  name: string;
  placeholder: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium" htmlFor={id}>{label}</label>
      <Textarea
        aria-describedby={`${id}-help`}
        className="mt-2 min-h-24"
        defaultValue={defaultValue}
        id={id}
        name={name}
        placeholder={placeholder}
      />
      <p className="mt-1.5 text-xs leading-5 text-muted" id={`${id}-help`}>
        {description} One option per line; each may contain up to {MAX_SPECIFICATION_OPTION_LENGTH} characters.
      </p>
    </div>
  );
}

function newCustomerField(): CustomerFieldConfigurationInput {
  return {
    helpText: "",
    id: `field-${crypto.randomUUID().toLowerCase()}`,
    label: "",
    maxLength: String(MAX_SHORT_TEXT_LENGTH),
    options: "",
    required: false,
    scope: "JOB",
    type: "SHORT_TEXT",
  };
}

function CustomerFieldsEditor({
  initialFields,
  prefix,
  variationsEnabled,
}: {
  initialFields: CustomerFieldConfigurationInput[];
  prefix: string;
  variationsEnabled: boolean;
}) {
  const [fields, setFields] = useState(initialFields);

  function updateField(
    index: number,
    update: Partial<CustomerFieldConfigurationInput>,
  ) {
    setFields((current) =>
      current.map((field, fieldIndex) =>
        fieldIndex === index ? { ...field, ...update } : field,
      ),
    );
  }

  return (
    <div className="space-y-4">
      <input
        name="customerFields"
        readOnly
        type="hidden"
        value={JSON.stringify(
          variationsEnabled
            ? fields
            : fields.map((field) => ({ ...field, scope: "JOB" })),
        )}
      />
      {fields.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-sm leading-6 text-muted">
          No customer information fields have been added. Add only details this service genuinely needs.
        </p>
      ) : null}
      {fields.map((field, index) => {
        const fieldPrefix = `${prefix}-customer-field-${index}`;
        const textField = field.type === "SHORT_TEXT" || field.type === "LONG_TEXT";
        return (
          <fieldset className="rounded-lg border bg-surface p-4" key={field.id}>
            <legend className="px-1 text-sm font-semibold">Customer field {index + 1}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium" htmlFor={`${fieldPrefix}-label`}>Field label</label>
                <Input
                  className="mt-2"
                  id={`${fieldPrefix}-label`}
                  maxLength={80}
                  onChange={(event) => updateField(index, { label: event.target.value })}
                  placeholder="e.g. Batch Number"
                  required
                  value={field.label}
                />
              </div>
              <div>
                <label className="text-sm font-medium" htmlFor={`${fieldPrefix}-type`}>Answer type</label>
                <Select
                  className="mt-2"
                  id={`${fieldPrefix}-type`}
                  onChange={(event) => {
                    const type = event.target.value;
                    updateField(index, {
                      maxLength:
                        type === "SHORT_TEXT"
                          ? String(MAX_SHORT_TEXT_LENGTH)
                          : type === "LONG_TEXT"
                            ? String(MAX_LONG_TEXT_LENGTH)
                            : "",
                      options: type === "SELECTION" ? field.options : "",
                      type,
                    });
                  }}
                  value={field.type}
                >
                  {CUSTOMER_FIELD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type === "SHORT_TEXT" ? "Short text" : type === "LONG_TEXT" ? "Long text" : type === "SELECTION" ? "Choose from a list" : type.charAt(0) + type.slice(1).toLowerCase()}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium" htmlFor={`${fieldPrefix}-scope`}>Customer enters this</label>
                <Select
                  className="mt-2"
                  disabled={!variationsEnabled}
                  id={`${fieldPrefix}-scope`}
                  onChange={(event) => updateField(index, { scope: event.target.value })}
                  value={variationsEnabled ? field.scope : "JOB"}
                >
                  {CUSTOMER_FIELD_SCOPES.map((scope) => (
                    <option key={scope} value={scope}>
                      {scope === "JOB" ? "Once for the whole job" : "For every variation"}
                    </option>
                  ))}
                </Select>
              </div>
              {textField ? (
                <div>
                  <label className="text-sm font-medium" htmlFor={`${fieldPrefix}-limit`}>Maximum characters</label>
                  <Input
                    className="mt-2"
                    id={`${fieldPrefix}-limit`}
                    max={MAX_LONG_TEXT_LENGTH}
                    min={1}
                    onChange={(event) => updateField(index, { maxLength: event.target.value })}
                    type="number"
                    value={field.maxLength}
                  />
                </div>
              ) : null}
            </div>
            <div className="mt-4">
              <label className="text-sm font-medium" htmlFor={`${fieldPrefix}-help`}>Help text (optional)</label>
              <Input
                className="mt-2"
                id={`${fieldPrefix}-help`}
                maxLength={200}
                onChange={(event) => updateField(index, { helpText: event.target.value })}
                placeholder="Briefly explain what the customer should enter"
                value={field.helpText}
              />
            </div>
            {field.type === "SELECTION" ? (
              <div className="mt-4">
                <label className="text-sm font-medium" htmlFor={`${fieldPrefix}-options`}>Allowed choices</label>
                <Textarea
                  className="mt-2 min-h-20"
                  id={`${fieldPrefix}-options`}
                  onChange={(event) => updateField(index, { options: event.target.value })}
                  placeholder={"Choice one\nChoice two"}
                  required
                  value={field.options}
                />
                <p className="mt-1.5 text-xs text-muted">One customer-facing choice per line.</p>
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  checked={field.required}
                  className={checkboxClassName}
                  onChange={(event) => updateField(index, { required: event.target.checked })}
                  type="checkbox"
                />
                Required from the customer
              </label>
              <button
                className="rounded-md border px-3 py-2 text-xs font-semibold outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setFields((current) => current.filter((_, fieldIndex) => fieldIndex !== index))}
                type="button"
              >
                Remove field
              </button>
            </div>
          </fieldset>
        );
      })}
      <button
        className="rounded-md border bg-surface px-4 py-2 text-sm font-semibold outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-disabled disabled:text-disabled-foreground"
        disabled={fields.length >= MAX_CUSTOM_FIELDS}
        onClick={() => setFields((current) => [...current, newCustomerField()])}
        type="button"
      >
        Add customer field
      </button>
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
  const [pricingMode, setPricingMode] = useState(values.pricingMode);
  const [sizeMode, setSizeMode] = useState(values.sizeMode || "NO_SIZE");
  const [variationsEnabled, setVariationsEnabled] = useState(values.variationsEnabled);
  const [complexity, setComplexity] = useState(values.defaultComplexity ?? "");
  const difficulty = complexity
    ? SERVICE_DIFFICULTY_DEFAULTS[complexity as ServiceComplexityDefault]
    : null;
  const usesPresets = sizeMode === "PRESET" || sizeMode === "PRESET_OR_CUSTOM";
  const usesCustom = sizeMode === "CUSTOM" || sizeMode === "PRESET_OR_CUSTOM";

  return (
    <div className="space-y-5">
      <fieldset className="space-y-5 rounded-lg border bg-surface-raised p-4 sm:p-5">
        <legend className="px-1 font-semibold">A. Basic Information</legend>
        <div>
          <label className="text-sm font-medium" htmlFor={`${prefix}-name`}>Service name</label>
          <Input className="mt-2" defaultValue={values.name} id={`${prefix}-name`} maxLength={MAX_SERVICE_NAME_LENGTH} name="name" required />
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor={`${prefix}-description`}>Public summary</label>
          <Textarea className="mt-2" defaultValue={values.description} id={`${prefix}-description`} maxLength={MAX_SERVICE_DESCRIPTION_LENGTH} name="description" placeholder="A concise, factual description of this service" />
          <p className="mt-1.5 text-xs leading-5 text-muted">Shown in the public service catalogue when provided.</p>
        </div>
      </fieldset>

      <details className={sectionClassName} open>
        <summary className={summaryClassName}>B. Quantity &amp; Pricing</summary>
        <p className="mt-2 text-xs leading-5 text-muted">Set only the limits this service needs. Quick choices never prevent another valid custom quantity.</p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium" htmlFor={`${prefix}-unit`}>Quantity unit</label>
            <Input className="mt-2" defaultValue={values.quantityUnit} id={`${prefix}-unit`} maxLength={MAX_QUANTITY_UNIT_LENGTH} name="quantityUnit" placeholder="pieces, copies, sheets…" />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor={`${prefix}-increment`}>Order in multiples of</label>
            <Input className="mt-2" defaultValue={values.quantityIncrement} id={`${prefix}-increment`} max={MAX_SERVICE_QUANTITY} min={1} name="quantityIncrement" placeholder="Optional, e.g. 5" type="number" />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor={`${prefix}-minimum`}>Minimum quantity</label>
            <Input className="mt-2" defaultValue={values.quantityMinimum} id={`${prefix}-minimum`} max={MAX_SERVICE_QUANTITY} min={1} name="quantityMinimum" placeholder="No service minimum" type="number" />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor={`${prefix}-maximum`}>Maximum quantity (optional)</label>
            <Input className="mt-2" defaultValue={values.quantityMaximum} id={`${prefix}-maximum`} max={MAX_SERVICE_QUANTITY} min={1} name="quantityMaximum" placeholder="No upper limit" type="number" />
          </div>
        </div>
        <div className="mt-5">
          <label className="text-sm font-medium" htmlFor={`${prefix}-presets`}>Quick quantity choices</label>
          <Input className="mt-2" defaultValue={values.quantityPresets} id={`${prefix}-presets`} name="quantityPresets" placeholder="50, 100, 200, 500" />
          <p className="mt-1.5 text-xs leading-5 text-muted">Enter unique valid quantities in ascending order.</p>
        </div>

        <div className="mt-6 border-t pt-5">
          <label className="text-sm font-medium" htmlFor={`${prefix}-pricing-mode`}>Pricing method</label>
          <Select className="mt-2" id={`${prefix}-pricing-mode`} name="pricingMode" onChange={(event) => setPricingMode(event.target.value as "FIXED" | "ON_REQUEST")} value={pricingMode}>
            <option value="ON_REQUEST">Price on request</option>
            <option value="FIXED">Fixed pricing</option>
          </Select>
          {pricingMode === "ON_REQUEST" ? (
            <div className="mt-3 space-y-3 rounded-md border bg-surface-muted p-3">
              <p className="text-xs leading-5 text-muted">No automatic total will be shown. Authorized management confirms pricing after reviewing the job.</p>
              <label className="flex items-start gap-3 text-sm">
                <input className={checkboxClassName} defaultChecked={values.allowPriceNegotiation} name="allowPriceNegotiation" type="checkbox" />
                <span><span className="font-medium">Allow price negotiation</span><span className="mt-1 block text-xs leading-5 text-muted">Off by default. When enabled, customers may propose a counteroffer on an issued manual quotation; management must still issue and the customer must accept the final price.</span></span>
              </label>
            </div>
          ) : (
            <div className="mt-5 space-y-5 rounded-lg border bg-surface p-4">
              <p className="text-xs leading-5 text-muted">Fixed pricing uses the quantity multiple above. Mixed sizes or printing options are sent for individual pricing.</p>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium" htmlFor={`${prefix}-starting-quantity`}>Starting quantity</label>
                  <Input className="mt-2" defaultValue={values.startingQuantity} id={`${prefix}-starting-quantity`} min={1} name="startingQuantity" required type="number" />
                </div>
                <div>
                  <label className="text-sm font-medium" htmlFor={`${prefix}-starting-price`}>Starting price (GH₵)</label>
                  <Input className="mt-2" defaultValue={values.startingPrice} id={`${prefix}-starting-price`} inputMode="decimal" name="startingPrice" pattern="(?:0|[1-9][0-9]{0,6})(?:\.[0-9]{1,2})?" required />
                </div>
                <div>
                  <label className="text-sm font-medium" htmlFor={`${prefix}-step-price`}>Additional price per quantity step (GH₵)</label>
                  <Input className="mt-2" defaultValue={values.additionalStepPrice} id={`${prefix}-step-price`} inputMode="decimal" name="additionalStepPrice" pattern="(?:0|[1-9][0-9]{0,6})(?:\.[0-9]{1,2})?" required />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium" htmlFor={`${prefix}-coverage`}>What this fixed price covers</label>
                <Textarea className="mt-2" defaultValue={values.fixedPriceCoverage} id={`${prefix}-coverage`} maxLength={MAX_SERVICE_INSTRUCTIONS_LENGTH} name="fixedPriceCoverage" placeholder="Describe the included size, material, finish, or other limits" required />
              </div>
              <p className="text-xs font-medium leading-5">Total = starting price + (additional steps × additional price per step).</p>
            </div>
          )}
        </div>
      </details>

      <details className={sectionClassName}>
        <summary className={summaryClassName}>C. Sizes &amp; Printing Options</summary>
        <div className="mt-5 space-y-6">
          <div>
            <label className="text-sm font-medium" htmlFor={`${prefix}-size-mode`}>Size rule</label>
            <Select className="mt-2" id={`${prefix}-size-mode`} name="sizeMode" onChange={(event) => setSizeMode(event.target.value)} value={sizeMode}>
              {SIZE_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode === "NO_SIZE" ? "No size needed" : mode === "FIXED" ? "One fixed size" : mode === "PRESET" ? "Choose from standard sizes" : mode === "CUSTOM" ? "Custom size only" : "Standard sizes or custom size"}
                </option>
              ))}
            </Select>
          </div>
          {sizeMode === "FIXED" ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label className="text-sm font-medium" htmlFor={`${prefix}-fixed-width`}>Width</label><Input className="mt-2" defaultValue={values.fixedSizeWidth} id={`${prefix}-fixed-width`} inputMode="decimal" name="fixedSizeWidth" required /></div>
              <div><label className="text-sm font-medium" htmlFor={`${prefix}-fixed-height`}>Height</label><Input className="mt-2" defaultValue={values.fixedSizeHeight} id={`${prefix}-fixed-height`} inputMode="decimal" name="fixedSizeHeight" required /></div>
              <div><label className="text-sm font-medium" htmlFor={`${prefix}-fixed-unit`}>Unit</label><Select className="mt-2" defaultValue={values.fixedSizeUnit} id={`${prefix}-fixed-unit`} name="fixedSizeUnit" required><option value="">Choose unit</option>{DIMENSION_UNITS.map((unit) => <option key={unit} value={unit}>{unit === "INCHES" ? "inches" : unit === "FEET" ? "feet" : unit.toLowerCase()}</option>)}</Select></div>
            </div>
          ) : null}
          {usesPresets ? (
            <OptionsField defaultValue={values.standardSizeOptions} description="Enter only the size names this service offers." id={`${prefix}-standard-sizes`} label="Standard size choices" name="standardSizeOptions" placeholder={"Size name one\nSize name two"} />
          ) : null}
          {usesCustom ? (
            <fieldset>
              <legend className="text-sm font-medium">Allowed custom-size units</legend>
              <div className="mt-3 flex flex-wrap gap-4">
                {DIMENSION_UNITS.map((unit) => <label className="flex items-center gap-2 text-sm" key={unit}><input className={checkboxClassName} defaultChecked={values.customDimensionUnits.includes(unit)} name="customDimensionUnits" type="checkbox" value={unit} />{unit === "INCHES" ? "inches" : unit === "FEET" ? "feet" : unit.toLowerCase()}</label>)}
              </div>
            </fieldset>
          ) : null}
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <OptionsField defaultValue={values.materialOptions} description="Add only materials currently offered." id={`${prefix}-materials`} label="Material choices" name="materialOptions" placeholder={"Material one\nMaterial two"} />
              <label className="mt-3 flex items-center gap-2 text-xs text-muted"><input className={checkboxClassName} defaultChecked={values.materialsRequired} name="materialsRequired" type="checkbox" />Customer must choose a material</label>
            </div>
            <div>
              <OptionsField defaultValue={values.finishingOptions} description="Add only finishing currently offered." id={`${prefix}-finishing`} label="Finishing choices" name="finishingOptions" placeholder={"Finishing one\nFinishing two"} />
              <label className="mt-3 flex items-center gap-2 text-xs text-muted"><input className={checkboxClassName} defaultChecked={values.finishingRequired} name="finishingRequired" type="checkbox" />Customer must choose a finish</label>
            </div>
          </div>
        </div>
      </details>

      <details className={sectionClassName}>
        <summary className={summaryClassName}>D. Customer Information</summary>
        <div className="mt-5 space-y-6">
          <label className="flex items-start gap-3 text-sm">
            <input
              checked={variationsEnabled}
              className={checkboxClassName}
              name="variationsEnabled"
              onChange={(event) => setVariationsEnabled(event.target.checked)}
              type="checkbox"
            />
            <span><span className="font-medium">Allow several variations in one job</span><span className="mt-1 block text-xs leading-5 text-muted">Each variation will keep its own quantity and variation-specific answers. Service minimums apply to the combined quantity.</span></span>
          </label>
          <CustomerFieldsEditor initialFields={values.customFields} prefix={prefix} variationsEnabled={variationsEnabled} />
          <div>
            <label className="text-sm font-medium" htmlFor={`${prefix}-artwork`}>Artwork arrangement</label>
            <Select className="mt-2" defaultValue={values.artworkRequirement} id={`${prefix}-artwork`} name="artworkRequirement">
              <option value="">Not configured</option>
              <option value="CUSTOMER_PROVIDED">Customer provides artwork</option>
              <option value="BUSINESS_DESIGN">Business designs the artwork</option>
              <option value="EITHER">Either option is acceptable</option>
              <option value="NOT_REQUIRED">No artwork needed</option>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor={`${prefix}-instructions`}>Instructions for customers</label>
            <Textarea className="mt-2" defaultValue={values.customInstructions} id={`${prefix}-instructions`} maxLength={MAX_SERVICE_INSTRUCTIONS_LENGTH} name="customInstructions" placeholder="What should the customer prepare or explain?" />
          </div>
        </div>
      </details>

      <details className={sectionClassName}>
        <summary className={summaryClassName}>E. Job Difficulty</summary>
        <div className="mt-5">
          <label className="text-sm font-medium" htmlFor={`${prefix}-complexity`}>Usual difficulty</label>
          <Select className="mt-2" id={`${prefix}-complexity`} name="defaultComplexity" onChange={(event) => setComplexity(event.target.value)} value={complexity}>
            <option value="">Decide during job review</option>
            <option value="SIMPLE">Simple</option>
            <option value="MEDIUM">Medium</option>
            <option value="COMPLEX">Complex</option>
          </Select>
          <p className="mt-2 text-xs leading-5 text-muted">
            {difficulty ? `Automatically maps to ${difficulty.workload.toLowerCase()} workload and ${difficulty.stars} worker star${difficulty.stars === 1 ? "" : "s"}.` : "No service default. An authorized reviewer can classify each future job."} Actual jobs may be changed during review.
          </p>
        </div>
      </details>

      <details className={sectionClassName} open>
        <summary className={summaryClassName}>F. Availability</summary>
        <div className="mt-5 space-y-4">
          <label className="flex items-start gap-3 text-sm"><input className={checkboxClassName} defaultChecked={values.onlineSubmissionEnabled} name="onlineSubmissionEnabled" type="checkbox" /><span><span className="font-medium">Eligible for future online submission</span><span className="mt-1 block text-xs leading-5 text-muted">This does not launch customer submission by itself.</span></span></label>
          {includeActiveState ? <label className="flex items-start gap-3 text-sm"><input className={checkboxClassName} defaultChecked={values.isActive} name="isActive" type="checkbox" /><span><span className="font-medium">Active in public catalogue</span><span className="mt-1 block text-xs leading-5 text-muted">Inactive services stay in history but are hidden publicly.</span></span></label> : null}
        </div>
      </details>
    </div>
  );
}
