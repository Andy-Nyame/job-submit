"use client";

import { upload } from "@vercel/blob/client";
import { useActionState, useMemo, useState } from "react";

import {
  initialJobSubmissionActionState,
  submitCustomerJobAction,
} from "@/app/app/jobs/actions";
import {
  ALLOWED_JOB_ATTACHMENT_TYPES,
  MAX_JOB_ATTACHMENTS,
  MAX_JOB_ATTACHMENT_BYTES,
  customerUploadPath,
  validateAttachmentBatch,
  type CustomerUploadReference,
} from "@/domain/job-attachments";
import {
  JobSubmissionValidationError,
  validateJobSubmission,
  type JobSubmissionPayload,
  type JobSubmissionSnapshot,
  type SubmissionService,
} from "@/domain/job-submission";
import {
  formatQuantityRule,
  readQuantityConfiguration,
  readSpecificationConfiguration,
  type CustomerFieldConfiguration,
} from "@/domain/service-configuration";
import {
  formatGhanaCediMinor,
  readPricingConfiguration,
} from "@/domain/service-pricing";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/form-controls";

type SizeDraft = JobSubmissionPayload["selection"]["size"];
type VariationDraft = JobSubmissionPayload["selection"]["variations"][number];

interface Draft {
  finishing: string;
  instructions: string;
  jobFields: Record<string, string>;
  material: string;
  priority: "EXPRESS" | "REGULAR";
  quantity: string;
  size: SizeDraft;
  title: string;
  variations: VariationDraft[];
}

function initialSize(service: SubmissionService | undefined): SizeDraft {
  const mode = readSpecificationConfiguration(
    service?.specificationConfiguration,
  )?.sizes.mode;
  if (mode === "FIXED") {
    return { height: "", kind: "FIXED", option: "", unit: "", width: "" };
  }
  if (mode === "CUSTOM") {
    return { height: "", kind: "CUSTOM", option: "", unit: "", width: "" };
  }
  if (mode === "PRESET" || mode === "PRESET_OR_CUSTOM") {
    return { height: "", kind: "PRESET", option: "", unit: "", width: "" };
  }
  return { height: "", kind: "NONE", option: "", unit: "", width: "" };
}

function initialDraft(service: SubmissionService | undefined): Draft {
  return {
    finishing: "",
    instructions: "",
    jobFields: {},
    material: "",
    priority: "REGULAR",
    quantity: "",
    size: initialSize(service),
    title: "",
    variations: [],
  };
}

function fileProgressKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function errorMessage(error: unknown) {
  if (error instanceof JobSubmissionValidationError) {
    const messages: Partial<Record<JobSubmissionValidationError["code"], string>> = {
      ATTACHMENTS: "Check the selected files. Customer-provided artwork is required when the service says so.",
      CUSTOM_FIELDS: "Complete the required service information using the requested format.",
      DIMENSIONS: "Enter valid custom width, height, and measurement units.",
      FINISHING: "Choose an available finishing option.",
      INSTRUCTIONS: "Keep the instructions within 4,000 characters and remove unsupported markup.",
      MATERIAL: "Choose an available material option.",
      QUANTITY: "Enter a quantity that follows the service rules.",
      SERVICE_CONFIGURATION: "This service needs an administrator to correct its workflow defaults before submission.",
      SERVICE_UNAVAILABLE: "That service is no longer available for online requests.",
      SIZE: "Choose an available size or complete the custom dimensions.",
      TITLE: "Enter a short job title between 2 and 200 characters.",
      VARIATIONS: "Check the variation quantities and required variation details.",
    };
    return messages[error.code] ?? "Review the job details and try again.";
  }
  return "The request could not be prepared. Review the details and try again.";
}

function CustomFieldControl({
  field,
  id,
  onChange,
  value,
}: {
  field: CustomerFieldConfiguration;
  id: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const common = {
    id,
    name: id,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => onChange(event.target.value),
    required: field.required,
    value,
  };
  return (
    <div>
      <label className="text-sm font-medium" htmlFor={id}>
        {field.label}{field.required ? " *" : ""}
      </label>
      {field.type === "LONG_TEXT" ? (
        <Textarea className="mt-2" maxLength={field.maxLength ?? undefined} {...common} />
      ) : field.type === "SELECTION" ? (
        <Select className="mt-2" {...common}>
          <option value="">Choose an option</option>
          {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
        </Select>
      ) : (
        <Input
          className="mt-2"
          maxLength={field.maxLength ?? undefined}
          type={field.type === "DATE" ? "date" : field.type === "NUMBER" ? "text" : "text"}
          inputMode={field.type === "NUMBER" ? "decimal" : undefined}
          {...common}
        />
      )}
      {field.helpText ? <p className="mt-1.5 text-xs leading-5 text-muted">{field.helpText}</p> : null}
    </div>
  );
}

function PriceSummary({ pricing }: { pricing: JobSubmissionSnapshot["pricing"] }) {
  if (pricing.mode === "ON_REQUEST") {
    return (
      <div className="rounded-lg border border-accent/35 bg-accent/10 p-4">
        <p className="font-semibold">Price on request</p>
        <p className="mt-1 text-sm leading-6 text-muted">
          The team will review the specifications and confirm pricing. No GH₵0 quotation or payment is recorded.
          {pricing.expressSurchargeBasisPoints === 4_000
            ? " Express priority will add 40% to the confirmed base price."
            : ""}
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-accent/35 bg-accent/10 p-4">
      <p className="font-semibold">Calculated fixed price: {formatGhanaCediMinor(BigInt(pricing.totalMinor))}</p>
      {pricing.expressSurchargeBasisPoints === 4_000 ? (
        <p className="mt-1 text-sm text-muted">
          Base {formatGhanaCediMinor(BigInt(pricing.basePriceMinor))} + 40% Express {formatGhanaCediMinor(BigInt(pricing.expressSurchargeMinor))}.
        </p>
      ) : null}
      <p className="mt-1 text-xs leading-5 text-muted">Covers: {pricing.coverage}. This does not record a payment.</p>
    </div>
  );
}

export function CustomerJobSubmissionForm({
  customerEmail,
  customerName,
  idempotencyKey,
  initialServiceSlug,
  services,
}: {
  customerEmail: string;
  customerName: string | null;
  idempotencyKey: string;
  initialServiceSlug?: string;
  services: SubmissionService[];
}) {
  const initialService = services.find((service) => service.slug === initialServiceSlug) ?? services[0];
  const [selectedServiceId, setSelectedServiceId] = useState(initialService?.id ?? "");
  const selectedService = services.find((service) => service.id === selectedServiceId);
  const [draft, setDraft] = useState<Draft>(() => initialDraft(initialService));
  const [files, setFiles] = useState<File[]>([]);
  const [uploaded, setUploaded] = useState<CustomerUploadReference[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [preparing, setPreparing] = useState(false);
  const [localError, setLocalError] = useState("");
  const [review, setReview] = useState<ReturnType<typeof validateJobSubmission> | null>(null);
  const [payloadJson, setPayloadJson] = useState("");
  const [state, formAction, pending] = useActionState(
    submitCustomerJobAction,
    initialJobSubmissionActionState,
  );

  const quantity = useMemo(
    () => readQuantityConfiguration(selectedService?.quantityConfiguration),
    [selectedService],
  );
  const specification = useMemo(
    () => readSpecificationConfiguration(selectedService?.specificationConfiguration),
    [selectedService],
  );
  const pricing = useMemo(
    () => readPricingConfiguration(selectedService?.pricingConfiguration),
    [selectedService],
  );
  const jobFields = specification?.customerFields.filter((field) => field.scope === "JOB") ?? [];
  const variationFields = specification?.customerFields.filter((field) => field.scope === "VARIATION") ?? [];

  function updateDraft<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setReview(null);
  }

  function selectService(serviceId: string) {
    const service = services.find((candidate) => candidate.id === serviceId);
    setSelectedServiceId(serviceId);
    setDraft(initialDraft(service));
    setFiles([]);
    setUploaded([]);
    setReview(null);
    setLocalError("");
  }

  function payloadWithAttachments(attachments: CustomerUploadReference[]): JobSubmissionPayload {
    return {
      attachments,
      idempotencyKey,
      instructions: draft.instructions,
      priority: draft.priority,
      quantity: draft.variations.length > 0 ? "" : draft.quantity,
      selection: {
        finishing: draft.finishing,
        jobFields: draft.jobFields,
        material: draft.material,
        size: draft.size,
        variations: draft.variations,
      },
      serviceId: selectedServiceId,
      title: draft.title,
    };
  }

  async function prepareReview() {
    if (!selectedService) {
      setLocalError("Choose an available service.");
      return;
    }
    setPreparing(true);
    setLocalError("");
    try {
      validateAttachmentBatch(
        files.map((file) => ({
          byteSize: file.size,
          mimeType: file.type,
          originalFilename: file.name,
        })),
      );
      let references = uploaded;
      if (files.length > 0 && references.length === 0) {
        const planned = files.map((file) => {
          const uploadId = crypto.randomUUID();
          return {
            file,
            reference: {
              originalFilename: file.name,
              pathname: customerUploadPath(uploadId, file.name),
              uploadId,
            },
          };
        });
        validateJobSubmission(
          payloadWithAttachments(planned.map((item) => item.reference)),
          selectedService,
        );
        references = await Promise.all(
          planned.map(async ({ file, reference }) => {
            const blob = await upload(reference.pathname, file, {
              access: "private",
              clientPayload: JSON.stringify({
                originalFilename: reference.originalFilename,
                uploadId: reference.uploadId,
              }),
              contentType: file.type,
              handleUploadUrl: "/api/customer-uploads",
              onUploadProgress: ({ percentage }) => {
                setUploadProgress((current) => ({
                  ...current,
                  [fileProgressKey(file)]: Math.round(percentage),
                }));
              },
            });
            return { ...reference, pathname: blob.pathname };
          }),
        );
        setUploaded(references);
      }
      const payload = payloadWithAttachments(references);
      const validated = validateJobSubmission(payload, selectedService);
      setPayloadJson(JSON.stringify(payload));
      setReview(validated);
    } catch (error) {
      setLocalError(errorMessage(error));
    } finally {
      setPreparing(false);
    }
  }

  function addVariation() {
    if (!specification || draft.variations.length >= specification.variations.maxItems) {
      return;
    }
    updateDraft("variations", [
      ...draft.variations,
      { fieldValues: {}, id: crypto.randomUUID(), quantity: 1 },
    ]);
  }

  return (
    <form action={formAction} className="space-y-6">
      <input name="submission" type="hidden" value={payloadJson} />

      {review ? (
        <Card className="p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-muted">Review request</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">{review.snapshot.request.title}</h2>
            </div>
            <span className="rounded-full border border-accent/45 bg-accent/10 px-3 py-1 text-xs font-semibold">Not submitted yet</span>
          </div>
          <dl className="mt-6 grid gap-5 text-sm sm:grid-cols-2">
            <div><dt className="font-medium text-muted">Service</dt><dd className="mt-1 font-semibold">{review.snapshot.service.name}</dd></div>
            <div><dt className="font-medium text-muted">Priority</dt><dd className="mt-1 font-semibold">{review.snapshot.request.priority === "EXPRESS" ? "Express / Urgent" : "Regular"}</dd></div>
            <div><dt className="font-medium text-muted">Quantity</dt><dd className="mt-1">{review.snapshot.request.quantity?.toLocaleString("en-US") ?? "Not applicable"}{quantity?.unit ? ` ${quantity.unit}` : ""}</dd></div>
            <div><dt className="font-medium text-muted">Customer</dt><dd className="mt-1">{customerName ?? customerEmail}<span className="block text-muted">{customerEmail}</span></dd></div>
            {review.snapshot.request.material ? <div><dt className="font-medium text-muted">Material</dt><dd className="mt-1">{review.snapshot.request.material}</dd></div> : null}
            {review.snapshot.request.finishing ? <div><dt className="font-medium text-muted">Finishing</dt><dd className="mt-1">{review.snapshot.request.finishing}</dd></div> : null}
            {review.snapshot.request.size.kind !== "NONE" ? <div><dt className="font-medium text-muted">Size</dt><dd className="mt-1">{review.snapshot.request.size.kind === "PRESET" ? review.snapshot.request.size.option : `${review.snapshot.request.size.width} × ${review.snapshot.request.size.height} ${review.snapshot.request.size.unit.toLowerCase()}`}</dd></div> : null}
            <div className="sm:col-span-2"><dt className="font-medium text-muted">Instructions</dt><dd className="mt-1 whitespace-pre-wrap leading-6">{review.snapshot.request.instructions || "No additional instructions."}</dd></div>
          </dl>
          {Object.keys(review.snapshot.request.jobFields).length > 0 ? (
            <div className="mt-6 border-t pt-5">
              <h3 className="font-semibold">Service information</h3>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                {Object.entries(review.snapshot.request.jobFields).map(([id, value]) => <div key={id}><dt className="text-muted">{jobFields.find((field) => field.id === id)?.label ?? id}</dt><dd className="mt-1 whitespace-pre-wrap">{value}</dd></div>)}
              </dl>
            </div>
          ) : null}
          {review.snapshot.request.variations.length > 0 ? (
            <div className="mt-6 border-t pt-5"><h3 className="font-semibold">Variations</h3><ol className="mt-3 space-y-3 text-sm">{review.snapshot.request.variations.map((variation, index) => <li className="rounded-lg border bg-surface-muted p-4" key={variation.id}><p className="font-medium">Variation {index + 1}: {variation.quantity.toLocaleString("en-US")}{quantity?.unit ? ` ${quantity.unit}` : ""}</p>{Object.entries(variation.fieldValues).map(([id, value]) => <p className="mt-1 text-muted" key={id}>{variationFields.find((field) => field.id === id)?.label ?? id}: <span className="text-foreground">{value}</span></p>)}</li>)}</ol></div>
          ) : null}
          <div className="mt-6 border-t pt-5">
            <h3 className="font-semibold">Reference files</h3>
            {uploaded.length > 0 ? <ul className="mt-2 space-y-1 text-sm text-muted">{uploaded.map((file) => <li key={file.uploadId}>{file.originalFilename}</li>)}</ul> : <p className="mt-2 text-sm text-muted">No files attached. Technical proof is not required.</p>}
          </div>
          <div className="mt-6"><PriceSummary pricing={review.snapshot.pricing} /></div>
          {(localError || state.status === "error") ? <p className="mt-5 rounded-md border border-destructive/45 bg-destructive/10 p-3 text-sm" role="alert">{localError || state.message}</p> : null}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button disabled={pending} onClick={() => { setReview(null); setLocalError(""); }} type="button" variant="outline">Edit details</Button>
            <Button disabled={pending} type="submit">{pending ? "Submitting safely…" : "Submit job request"}</Button>
          </div>
        </Card>
      ) : (
        <>
          <Card className="p-5 sm:p-7">
            <h2 className="text-xl font-semibold">1. Choose a service</h2>
            <label className="mt-5 block text-sm font-medium" htmlFor="job-service">Available for online requests</label>
            <Select className="mt-2" id="job-service" onChange={(event) => selectService(event.target.value)} required value={selectedServiceId}>
              {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
            </Select>
            {selectedService ? <div className="mt-4 rounded-lg border bg-surface-muted p-4 text-sm leading-6"><p>{selectedService.description ?? "Provide the details needed for the team to review this request."}</p><p className="mt-2 font-medium">{pricing.mode === "FIXED" ? "Fixed pricing is calculated from the configured quantity rules." : "Price on request — pricing will be confirmed after review."}</p>{specification?.customInstructions ? <p className="mt-2 text-muted">{specification.customInstructions}</p> : null}</div> : null}
          </Card>

          <Card className="p-5 sm:p-7">
            <h2 className="text-xl font-semibold">2. Job details</h2>
            <div className="mt-5 grid gap-5">
              <div><label className="text-sm font-medium" htmlFor="job-title">Job title *</label><Input className="mt-2" id="job-title" maxLength={200} onChange={(event) => updateDraft("title", event.target.value)} placeholder="e.g. Product labels for October batch" required value={draft.title} /></div>
              <div><label className="text-sm font-medium" htmlFor="job-instructions">Instructions</label><Textarea className="mt-2 min-h-32" id="job-instructions" maxLength={4000} onChange={(event) => updateDraft("instructions", event.target.value)} placeholder="Explain what you need, wording, colours, or anything the team should review." value={draft.instructions} /><p className="mt-1.5 text-xs text-muted">Optional when the title and configured service information fully describe the request.</p></div>
              <div><label className="text-sm font-medium" htmlFor="job-priority">Handling priority</label><Select className="mt-2" id="job-priority" onChange={(event) => updateDraft("priority", event.target.value as Draft["priority"])} value={draft.priority}><option value="REGULAR">Regular</option><option value="EXPRESS">Express / Urgent (+40%)</option></Select><p className="mt-1.5 text-xs leading-5 text-muted">Express means priority handling, not instant or guaranteed completion. For Price on Request, the surcharge applies after the base price is confirmed.</p></div>
            </div>
          </Card>

          <Card className="p-5 sm:p-7">
            <h2 className="text-xl font-semibold">3. Quantity and options</h2>
            <div className="mt-5 space-y-6">
              {specification?.variations.enabled ? (
                <div className="rounded-lg border bg-surface-muted p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium">Variations</p><p className="mt-1 text-xs leading-5 text-muted">Use variations when quantities or configured details differ. The service quantity rule applies to the combined total.</p></div><Button onClick={addVariation} type="button" variant="outline">Add variation</Button></div>{draft.variations.length > 0 ? <div className="mt-4 space-y-4">{draft.variations.map((variation, index) => <fieldset className="rounded-lg border bg-surface p-4" key={variation.id}><legend className="px-1 text-sm font-semibold">Variation {index + 1}</legend><div><label className="text-sm font-medium" htmlFor={`variation-${variation.id}-quantity`}>Quantity *</label><Input className="mt-2" id={`variation-${variation.id}-quantity`} inputMode="numeric" min={1} onChange={(event) => updateDraft("variations", draft.variations.map((item) => item.id === variation.id ? { ...item, quantity: Number(event.target.value) } : item))} required type="number" value={variation.quantity} /></div>{variationFields.length > 0 ? <div className="mt-4 grid gap-4 sm:grid-cols-2">{variationFields.map((field) => <CustomFieldControl field={field} id={`variation-${variation.id}-${field.id}`} key={field.id} onChange={(value) => updateDraft("variations", draft.variations.map((item) => item.id === variation.id ? { ...item, fieldValues: { ...item.fieldValues, [field.id]: value } } : item))} value={variation.fieldValues[field.id] ?? ""} />)}</div> : null}<button className="mt-4 text-sm font-medium text-destructive underline underline-offset-4" onClick={() => updateDraft("variations", draft.variations.filter((item) => item.id !== variation.id))} type="button">Remove variation</button></fieldset>)}</div> : <p className="mt-3 text-xs text-muted">No variations added. Enter one total quantity below.</p>}</div>
              ) : null}
              {draft.variations.length === 0 ? <div><label className="text-sm font-medium" htmlFor="job-quantity">Quantity{quantity || pricing.mode === "FIXED" ? " *" : ""}</label><Input className="mt-2" id="job-quantity" inputMode="numeric" min={1} onChange={(event) => updateDraft("quantity", event.target.value)} required={Boolean(quantity || pricing.mode === "FIXED")} type="number" value={draft.quantity} />{formatQuantityRule(quantity) ? <p className="mt-1.5 text-xs text-muted">{formatQuantityRule(quantity)}{quantity?.increment ? ` · increments of ${quantity.increment.toLocaleString("en-US")}` : ""}</p> : <p className="mt-1.5 text-xs text-muted">Leave blank only when quantity does not apply to this request.</p>}</div> : <p className="text-sm text-muted">Combined variation quantity: {draft.variations.reduce((sum, item) => sum + (Number.isFinite(item.quantity) ? item.quantity : 0), 0).toLocaleString("en-US")}{quantity?.unit ? ` ${quantity.unit}` : ""}</p>}

              {specification?.sizes.mode === "FIXED" && specification.sizes.fixed ? <div><p className="text-sm font-medium">Configured size</p><p className="mt-2 text-sm text-muted">{specification.sizes.fixed.width} × {specification.sizes.fixed.height} {specification.sizes.fixed.unit.toLowerCase()}</p></div> : null}
              {(specification?.sizes.mode === "PRESET" || specification?.sizes.mode === "PRESET_OR_CUSTOM") ? <div><label className="text-sm font-medium" htmlFor="job-size">Size *</label><Select className="mt-2" id="job-size" onChange={(event) => { const custom = event.target.value === "__CUSTOM__"; updateDraft("size", custom ? { height: "", kind: "CUSTOM", option: "", unit: "", width: "" } : { height: "", kind: "PRESET", option: event.target.value, unit: "", width: "" }); }} required value={draft.size.kind === "CUSTOM" ? "__CUSTOM__" : draft.size.option}><option value="">Choose a size</option>{specification.sizes.options.map((option) => <option key={option} value={option}>{option}</option>)}{specification.sizes.mode === "PRESET_OR_CUSTOM" ? <option value="__CUSTOM__">Custom size</option> : null}</Select></div> : null}
              {draft.size.kind === "CUSTOM" ? <div className="grid gap-4 sm:grid-cols-3"><div><label className="text-sm font-medium" htmlFor="custom-width">Width *</label><Input className="mt-2" id="custom-width" inputMode="decimal" onChange={(event) => updateDraft("size", { ...draft.size, width: event.target.value })} required value={draft.size.width} /></div><div><label className="text-sm font-medium" htmlFor="custom-height">Height *</label><Input className="mt-2" id="custom-height" inputMode="decimal" onChange={(event) => updateDraft("size", { ...draft.size, height: event.target.value })} required value={draft.size.height} /></div><div><label className="text-sm font-medium" htmlFor="custom-unit">Unit *</label><Select className="mt-2" id="custom-unit" onChange={(event) => updateDraft("size", { ...draft.size, unit: event.target.value })} required value={draft.size.unit}><option value="">Choose unit</option>{specification?.sizes.customUnits.map((unit) => <option key={unit} value={unit}>{unit === "INCHES" ? "inches" : unit === "FEET" ? "feet" : unit.toLowerCase()}</option>)}</Select></div></div> : null}
              {specification && specification.materials.options.length > 0 ? <div><label className="text-sm font-medium" htmlFor="job-material">Material{specification.materials.required ? " *" : ""}</label><Select className="mt-2" id="job-material" onChange={(event) => updateDraft("material", event.target.value)} required={specification.materials.required} value={draft.material}><option value="">{specification.materials.required ? "Choose a material" : "No preference"}</option>{specification.materials.options.map((option) => <option key={option} value={option}>{option}</option>)}</Select></div> : null}
              {specification && specification.finishing.options.length > 0 ? <div><label className="text-sm font-medium" htmlFor="job-finishing">Finishing{specification.finishing.required ? " *" : ""}</label><Select className="mt-2" id="job-finishing" onChange={(event) => updateDraft("finishing", event.target.value)} required={specification.finishing.required} value={draft.finishing}><option value="">{specification.finishing.required ? "Choose a finish" : "No preference"}</option>{specification.finishing.options.map((option) => <option key={option} value={option}>{option}</option>)}</Select></div> : null}
              {jobFields.length > 0 ? <div className="grid gap-5 sm:grid-cols-2">{jobFields.map((field) => <CustomFieldControl field={field} id={`job-field-${field.id}`} key={field.id} onChange={(value) => updateDraft("jobFields", { ...draft.jobFields, [field.id]: value })} value={draft.jobFields[field.id] ?? ""} />)}</div> : null}
            </div>
          </Card>

          <Card className="p-5 sm:p-7">
            <h2 className="text-xl font-semibold">4. Optional reference files</h2>
            <p className="mt-2 text-sm leading-6 text-muted">Attach artwork, images, documents, or instructions when useful. Technical proof is not required. If the service says the customer provides artwork, include that artwork here.</p>
            <Input accept=".ai,.doc,.docx,.jpeg,.jpg,.pdf,.png,.psd,.txt,.webp,.xls,.xlsx" className="mt-5 file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground" id="job-files" multiple onChange={(event) => { setFiles(Array.from(event.target.files ?? [])); setUploaded([]); setUploadProgress({}); setReview(null); }} type="file" />
            <p className="mt-2 text-xs leading-5 text-muted">Up to {MAX_JOB_ATTACHMENTS} files, {Math.round(MAX_JOB_ATTACHMENT_BYTES / 1024 / 1024)} MB each. Allowed: JPG, PNG, WebP, PDF, AI, PSD, TXT, Word, and Excel files.</p>
            {files.length > 0 ? <ul aria-live="polite" className="mt-4 space-y-2 text-sm">{files.map((file) => { const progress = uploadProgress[fileProgressKey(file)]; return <li className="flex items-center justify-between gap-3 rounded-md border px-3 py-2" key={fileProgressKey(file)}><span className="min-w-0 truncate">{file.name}</span><span className="shrink-0 text-xs text-muted">{progress === undefined ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : `${progress}%`}</span></li>; })}</ul> : null}
          </Card>

          <Card className="p-5 sm:p-7">
            <h2 className="text-xl font-semibold">5. Customer and review</h2>
            <p className="mt-2 text-sm leading-6 text-muted">This job will be connected to your signed-in customer account.</p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-muted">Name</dt><dd className="mt-1 font-medium">{customerName ?? "Not provided"}</dd></div><div><dt className="text-muted">Email</dt><dd className="mt-1 font-medium break-all">{customerEmail}</dd></div></dl>
            {localError ? <p className="mt-5 rounded-md border border-destructive/45 bg-destructive/10 p-3 text-sm" role="alert">{localError}</p> : null}
            <div className="mt-6 flex justify-end"><Button disabled={preparing} onClick={prepareReview} type="button">{preparing ? "Preparing secure review…" : "Review job request"}</Button></div>
          </Card>
        </>
      )}
      <span className="sr-only">Allowed upload content types: {ALLOWED_JOB_ATTACHMENT_TYPES.join(", ")}</span>
    </form>
  );
}
