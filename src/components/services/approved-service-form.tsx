"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage, Input, Select, Textarea } from "@/components/ui/form-controls";
import { profileForPricing, profilesForService, SERVICE_BLUEPRINTS, type ServiceConfigurationProfile } from "@/domain/service-blueprints";
import { MAX_SERVICE_DESCRIPTION_LENGTH, MAX_SERVICE_NAME_LENGTH } from "@/domain/service-policy";

const checkboxClassName = "mt-1 size-4 shrink-0 accent-[var(--accent)] focus-visible:ring-2 focus-visible:ring-ring";

export function ApprovedServiceForm(props: {
  allowPriceNegotiation: boolean;
  description: string;
  name: string;
  onlineSubmissionEnabled: boolean;
  pricingConfiguration: unknown;
  serviceId: string;
  slug: string;
  version: number;
}) {
  const profiles = profilesForService(props.slug);
  const savedProfile = profileForPricing(props.pricingConfiguration);
  const [profile, setProfile] = useState<ServiceConfigurationProfile>(profiles.includes(savedProfile) ? savedProfile : "ON_REQUEST");
  const router = useRouter();
  const [state, setState] = useState<{ field?: string; message: string; status: "error" | "idle" | "success" }>({ message: "", status: "idle" });
  const [pending, setPending] = useState(false);
  const blueprint = SERVICE_BLUEPRINTS[profile];

  return (
    <form className="space-y-5" onSubmit={async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      setPending(true);
      setState({ message: "", status: "idle" });
      try {
        const response = await fetch(`/api/management/services/${encodeURIComponent(props.serviceId)}`, {
          body: JSON.stringify({
            allowPriceNegotiation: form.get("allowPriceNegotiation") === "on",
            configurationProfile: profile,
            description: String(form.get("description") ?? ""),
            expectedVersion: props.version,
            name: String(form.get("name") ?? ""),
            onlineSubmissionEnabled: form.get("onlineSubmissionEnabled") === "on",
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const result = await response.json() as { field?: string; message?: string };
        setState({ field: result.field, message: result.message ?? "The service could not be saved.", status: response.ok ? "success" : "error" });
        if (response.ok) router.refresh();
      } catch {
        setState({ field: "form", message: "The service could not be saved. Check your connection and try again.", status: "error" });
      } finally {
        setPending(false);
      }
    }}>
      <input name="serviceId" type="hidden" value={props.serviceId} />
      <input name="version" type="hidden" value={props.version} />
      <fieldset className="space-y-5 rounded-lg border bg-surface-raised p-4 sm:p-5">
        <legend className="px-1 font-semibold">1. Basic information</legend>
        <div><label className="text-sm font-medium" htmlFor="approved-service-name">Service name</label><Input className="mt-2" defaultValue={props.name} id="approved-service-name" maxLength={MAX_SERVICE_NAME_LENGTH} name="name" required /></div>
        {state.status === "error" && state.field === "name" ? <p className="text-sm text-destructive" role="alert">{state.message}</p> : null}
        <div><label className="text-sm font-medium" htmlFor="approved-service-description">Short description</label><Textarea className="mt-2" defaultValue={props.description} id="approved-service-description" maxLength={MAX_SERVICE_DESCRIPTION_LENGTH} name="description" /></div>
      </fieldset>
      <fieldset className="space-y-4 rounded-lg border bg-surface-raised p-4 sm:p-5">
        <legend className="px-1 font-semibold">2. Pricing</legend>
        <div>
          <label className="text-sm font-medium" htmlFor="configuration-profile">How should this service be priced?</label>
          <Select className="mt-2" id="configuration-profile" name="configurationProfile" onChange={(event) => setProfile(event.target.value as ServiceConfigurationProfile)} value={profile}>
            {profiles.map((value) => <option key={value} value={value}>{SERVICE_BLUEPRINTS[value].label}</option>)}
          </Select>
        </div>
        {state.status === "error" && state.field === "configurationProfile" ? <p className="text-sm text-destructive" role="alert">{state.message}</p> : null}
        <div className="rounded-md border bg-surface-muted p-4 text-sm leading-6"><p className="font-medium">What customers will be charged</p><p className="mt-1 text-muted">{blueprint.summary}</p></div>
        {profile === "ON_REQUEST" ? <label className="flex items-start gap-3 text-sm"><input className={checkboxClassName} defaultChecked={props.allowPriceNegotiation} name="allowPriceNegotiation" type="checkbox" /><span><span className="font-medium">Allow price negotiation</span><span className="mt-1 block text-xs leading-5 text-muted">Off unless management deliberately allows counteroffers on manual quotations.</span></span></label> : null}
      </fieldset>
      <section aria-labelledby="requirements-heading" className="rounded-lg border bg-surface-raised p-4 sm:p-5">
        <h3 className="font-semibold" id="requirements-heading">3. Customer requirements</h3>
        <p className="mt-2 text-sm leading-6 text-muted">{blueprint.specification?.customInstructions ?? "Customers can explain the work and add optional files. No technical proof is required."}</p>
        {blueprint.specification?.artworkRequirement === "CUSTOMER_PROVIDED" ? <p className="mt-3 text-sm font-medium">Finished artwork is required for printing-only requests.</p> : null}
      </section>
      <fieldset className="space-y-4 rounded-lg border border-primary/25 bg-primary-surface p-4 sm:p-5">
        <legend className="px-1 font-semibold">4. Review &amp; save</legend>
        <label className="flex items-start gap-3 text-sm"><input className={checkboxClassName} defaultChecked={props.onlineSubmissionEnabled} name="onlineSubmissionEnabled" type="checkbox" /><span><span className="font-medium">Accept online orders for this service</span><span className="mt-1 block text-xs leading-5 text-muted">Customers can choose it only while the shop is open. This setting does not change the shop switch.</span></span></label>
        <div className="rounded-md border bg-surface-muted p-4 text-sm leading-6">
          <p className="font-medium">Test calculation</p>
          <p className="mt-1 text-muted">{blueprint.example}</p>
        </div>
        <p className="text-xs leading-5 text-muted">Review: {blueprint.label}. Prices are calculated again on the server at submission.</p>
      </fieldset>
      {state.field !== "name" && state.field !== "configurationProfile" ? <FormMessage message={state.message} status={state.status} /> : null}
      <Button disabled={pending} type="submit">{pending ? "Saving…" : "Save service settings"}</Button>
    </form>
  );
}
