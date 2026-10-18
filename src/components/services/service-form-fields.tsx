import {
  Input,
  Select,
  Textarea,
} from "@/components/ui/form-controls";
import {
  MAX_SERVICE_DESCRIPTION_LENGTH,
  MAX_SERVICE_NAME_LENGTH,
  MAX_SERVICE_SORT_ORDER,
  type ServiceComplexityDefault,
  type ServiceWorkloadDefault,
} from "@/domain/service-policy";

export interface ServiceFormValues {
  defaultComplexity: ServiceComplexityDefault | null;
  defaultWorkloadClass: ServiceWorkloadDefault | null;
  description: string;
  isActive: boolean;
  name: string;
  onlineSubmissionEnabled: boolean;
  proofRequiredByDefault: boolean | null;
  sortOrder: number;
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
    <div className="space-y-6">
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
        <label className="text-sm font-medium" htmlFor={`${prefix}-description`}>
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

      <div>
        <label className="text-sm font-medium" htmlFor={`${prefix}-sort-order`}>
          Display order
        </label>
        <Input
          className="mt-2"
          defaultValue={values.sortOrder}
          id={`${prefix}-sort-order`}
          max={MAX_SERVICE_SORT_ORDER}
          min={0}
          name="sortOrder"
          required
          type="number"
        />
        <p className="mt-1.5 text-xs text-muted">
          Lower numbers appear first in service lists.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium" htmlFor={`${prefix}-complexity`}>
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
      <p className="-mt-3 text-xs leading-5 text-muted">
        Defaults are future review aids only. Every job can receive its own
        complexity and workload classification.
      </p>

      <div>
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

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex min-h-11 items-start gap-3 rounded-md border bg-surface-muted p-4 text-sm">
          <input
            className="mt-1 size-4 accent-[var(--accent)]"
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
              className="mt-1 size-4 accent-[var(--accent)]"
              defaultChecked={values.isActive}
              name="isActive"
              type="checkbox"
            />
            <span>
              <span className="font-medium">Create as active</span>
              <span className="mt-1 block leading-5 text-muted">
                Active services are eligible for the public catalogue.
              </span>
            </span>
          </label>
        ) : null}
      </div>
    </div>
  );
}
