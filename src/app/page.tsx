import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Container } from "@/components/layout/container";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/config/site";
import { getAuthenticatedIdentity } from "@/server/auth/identity";
import {
  getActivePublicServices,
  type PublicService,
  type PublicServicesResult,
} from "@/server/public/services";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Printing & Design Jobs, Made Easier",
  description: siteConfig.description,
};

const serviceDescriptions: Record<string, string> = {
  designing:
    "Design support for clearly briefed print materials and customer artwork.",
  "sav-sticker-printing":
    "Sticker and self-adhesive vinyl requests, organized from brief to pickup.",
  "flexi-banner-printing":
    "Banner printing requests reviewed against the artwork and instructions supplied.",
  "document-printing":
    "Document printing requests with files, quantities, and notes kept together.",
  "for-sale-sticker-printing":
    "Dedicated production for For Sale sticker printing requests.",
  "container-head-sticker-batch-numbers-printing":
    "Container identification and batch-number printing requests.",
};

const servicePublicNames: Record<string, string> = {
  "container-head-sticker-batch-numbers-printing":
    "Container Head / Batch Number Printing",
};

const workflowSteps = [
  {
    description: "Sign in securely using the available authentication methods.",
    title: "Create an Account",
  },
  {
    description: "Select a service and provide instructions and files.",
    title: "Submit Your Job",
  },
  {
    description:
      "The team reviews the request, clarifies details, and confirms pricing.",
    title: "Job Review",
  },
  {
    description: "Follow updates as the job moves through production.",
    title: "Track Progress",
  },
  {
    description:
      "Receive a notification and secure pickup code when completed.",
    title: "Ready for Pickup",
  },
  {
    description:
      "Present the code for verification and collect the finished job.",
    title: "Collect Your Work",
  },
] as const;

const benefits = [
  {
    description:
      "Begin a request remotely before making an unnecessary initial trip.",
    title: "Start from wherever you are",
  },
  {
    description:
      "Keep artwork, instructions, and later revisions connected to the right job.",
    title: "Keep details organized",
  },
  {
    description:
      "See the current stage of work without relying on scattered conversations.",
    title: "Follow progress clearly",
  },
  {
    description:
      "Discuss questions and approvals in the context of each individual request.",
    title: "Communicate with context",
  },
  {
    description:
      "Know when completed work is prepared for verified collection.",
    title: "Plan pickup with confidence",
  },
  {
    description:
      "Choose regular handling or request priority review when the planned option launches.",
    title: "Choose the right priority",
  },
] as const;

const frequentlyAskedQuestions = [
  {
    answer:
      "JobSubmit is the secure online workspace being developed for Capt. Bob Cedi's Artworks. Account access is available now; job submission, progress tracking, job messages, and pickup verification are planned for later releases.",
    question: "What is JobSubmit?",
  },
  {
    answer:
      "Yes. An account will keep each request connected to the correct customer and protect private job details. Google sign-in is available now, while broader customer workflows are still being prepared.",
    question: "Do I need an account?",
  },
  {
    answer:
      "Secure artwork and document uploads are planned, but they are not available on the public site yet. Original customer files will be handled through protected job workflows when that capability launches.",
    question: "Can I upload my artwork or documents?",
  },
  {
    answer:
      "The planned workflow will notify customers and provide a secure one-time pickup code after a job is completed and ready. Notifications and pickup verification have not launched yet.",
    question: "How will I know when my job is ready?",
  },
  {
    answer:
      "Express or Urgent is the planned priority-handling option. It will add 40% to the confirmed normal base price, but it will not promise instant work or guarantee a particular completion time.",
    question: "What is Express/Urgent service?",
  },
  {
    answer:
      "Yes. If a request does not match a listed service, the business can clarify whether it can be handled as a custom request. A verified public contact channel will be published here when configured.",
    question: "Can I request a service that is not listed?",
  },
] as const;

const primaryLinkClassName =
  "inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground outline-none transition-[opacity,transform] hover:-translate-y-0.5 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const secondaryLinkClassName =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border bg-surface px-6 text-sm font-semibold outline-none transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function ArrowIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 20 20">
      <path
        d="M4 10h12m-4.5-4.5L16 10l-4.5 4.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}



function CheckIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 20 20">
      <path
        d="m5 10 3.2 3.2L15.5 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function ServiceIcon({ slug }: { slug: string }) {
  let drawing: ReactNode;

  switch (slug) {
    case "designing":
      drawing = (
        <>
          <path d="m6 19 1.4-5.1L17.8 3.5a2 2 0 0 1 2.8 2.8L10.2 16.7 6 19Z" />
          <path d="m14.8 6.5 2.7 2.7M7.4 13.9l2.8 2.8" />
        </>
      );
      break;
    case "sav-sticker-printing":
    case "for-sale-sticker-printing":
      drawing = (
        <>
          <path d="M4 4h10l6 6-10 10-6-6V4Z" />
          <circle cx="9" cy="9" r="1.5" />
        </>
      );
      break;
    case "flexi-banner-printing":
      drawing = (
        <>
          <path d="M4 5h16v11H4zM7 16v4m10-4v4M8 9h8m-8 3h5" />
        </>
      );
      break;
    case "document-printing":
      drawing = (
        <>
          <path d="M7 3h8l4 4v14H7V3Z" />
          <path d="M15 3v5h4M10 12h6m-6 4h6" />
        </>
      );
      break;
    case "container-head-sticker-batch-numbers-printing":
      drawing = (
        <>
          <path d="M3 7h18v12H3zM7 7V4h10v3M7 11h2m3 0h2m3 0h1M7 15h10" />
        </>
      );
      break;
    default:
      drawing = (
        <>
          <path d="M5 4h14v16H5zM8 8h8m-8 4h8m-8 4h5" />
        </>
      );
  }

  return (
    <span className="grid size-11 place-items-center rounded-xl border border-accent/35 bg-accent/10 text-foreground">
      <svg
        aria-hidden="true"
        className="size-6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.45"
        viewBox="0 0 24 24"
      >
        {drawing}
      </svg>
    </span>
  );
}

function HeroStudioVisual() {
  return (
    <div
      aria-label="Concept illustration of the planned JobSubmit production workflow"
      className="relative mx-auto w-full max-w-xl"
      role="img"
    >
      <div aria-hidden="true" className="absolute -inset-8 -z-10 bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--accent)_18%,transparent),transparent_68%)] blur-2xl" />
      <div className="relative overflow-hidden rounded-[2rem] border bg-surface p-4 shadow-[0_30px_80px_-50px_rgba(0,0,0,0.55)] sm:p-6">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted">
              Future JobSubmit flow
            </p>
            <p className="mt-1 text-sm font-semibold">One clear path to pickup</p>
          </div>
          <span className="rounded-full border border-accent/45 bg-accent/10 px-3 py-1 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.14em]">
            Launching soon
          </span>
        </div>

        <div className="relative mt-5 min-h-80 rounded-2xl bg-surface-muted p-4 sm:min-h-96 sm:p-6">
          <div className="absolute right-4 top-4 h-40 w-28 rotate-6 rounded-lg border bg-background p-3 shadow-[0_14px_35px_-24px_rgba(0,0,0,0.8)] sm:right-8 sm:top-7 sm:h-48 sm:w-36">
            <div className="h-16 rounded-md bg-[linear-gradient(135deg,var(--foreground)_0_42%,var(--accent)_42%_58%,var(--surface)_58%)]" />
            <div className="mt-4 h-1.5 w-16 rounded-full bg-foreground/80" />
            <div className="mt-2 h-1.5 w-11 rounded-full bg-muted/45" />
            <div className="absolute -left-1 -top-1 size-3 border-l border-t border-foreground/45" />
            <div className="absolute -bottom-1 -right-1 size-3 border-b border-r border-foreground/45" />
          </div>

          <div className="absolute bottom-4 left-4 z-10 w-[82%] rounded-2xl border bg-surface p-4 shadow-[0_22px_50px_-34px_rgba(0,0,0,0.75)] sm:bottom-7 sm:left-7 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                  Planned journey
                </p>
                <p className="mt-1 font-semibold tracking-tight">Brief to collection</p>
              </div>
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
                <CheckIcon />
              </span>
            </div>
            <div className="mt-5 grid grid-cols-4 gap-2" aria-hidden="true">
              {["Brief", "Review", "Produce", "Pickup"].map((stage, index) => (
                <div key={stage}>
                  <div className="flex items-center">
                    <span className="size-2 rounded-full bg-accent" />
                    {index < 3 ? <span className="h-px flex-1 bg-border" /> : null}
                  </div>
                  <p className="mt-2 text-[0.62rem] text-muted">{stage}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="absolute left-4 top-5 w-36 -rotate-3 rounded-xl border bg-background p-3 sm:left-8 sm:top-8 sm:w-44">
            <div className="flex gap-2">
              <span className="size-4 rounded-full bg-foreground" />
              <span className="size-4 rounded-full bg-accent" />
              <span className="size-4 rounded-full border bg-surface" />
            </div>
            <div className="mt-4 h-1.5 w-full rounded-full bg-border" />
            <div className="mt-2 h-1.5 w-2/3 rounded-full bg-border" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ServicesSection({ result }: { result: PublicServicesResult }) {
  return (
    <section
      aria-labelledby="services-heading"
      className="scroll-mt-24 border-y bg-surface-muted/55 py-20 sm:py-28"
      id="services"
      tabIndex={-1}
    >
      <Container>
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div>
            <p className="section-kicker">What we do</p>
            <h2
              className="mt-4 max-w-xl text-3xl font-semibold tracking-[-0.04em] text-balance sm:text-5xl"
              id="services-heading"
            >
              Print and design services, organized around your request.
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-7 text-muted lg:justify-self-end lg:text-lg lg:leading-8">
            Explore the active service categories currently configured for Capt.
            Bob Cedi&apos;s Artworks. Pricing and production details are confirmed
            only after the team reviews an actual brief.
          </p>
        </div>

        {result.status === "ready" && result.services.length > 0 ? (
          <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {result.services.map((service, index) => (
              <ServiceCard index={index} key={service.slug} service={service} />
            ))}
          </div>
        ) : (
          <div className="mt-12 rounded-2xl border bg-surface p-7 sm:p-9" role="status">
            <p className="font-semibold">Service information is temporarily unavailable.</p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              The public catalogue could not be loaded safely. Please try again
              later or sign in if you already have JobSubmit access.
            </p>
          </div>
        )}
      </Container>
    </section>
  );
}

function ServiceCard({
  index,
  service,
}: {
  index: number;
  service: PublicService;
}) {
  const description =
    service.description ??
    serviceDescriptions[service.slug] ??
    "A service request reviewed against the details and artwork supplied.";
  const publicName = servicePublicNames[service.slug] ?? service.name;

  return (
    <article className="group relative min-h-64 overflow-hidden rounded-2xl border bg-surface p-6 transition-[border-color,transform] hover:-translate-y-1 hover:border-accent/70 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <ServiceIcon slug={service.slug} />
        <span className="font-mono text-xs text-muted">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>
      <h3 className="mt-8 max-w-xs text-xl font-semibold tracking-[-0.025em]">
        {publicName}
      </h3>
      <p className="mt-3 max-w-sm text-sm leading-6 text-muted">{description}</p>
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 origin-left scale-x-0 bg-accent transition-transform group-hover:scale-x-100" />
    </article>
  );
}

async function isVisitorAuthenticated() {
  try {
    return Boolean(await getAuthenticatedIdentity());
  } catch {
    return false;
  }
}

export default async function HomePage() {
  const [isAuthenticated, servicesResult] = await Promise.all([
    isVisitorAuthenticated(),
    getActivePublicServices(),
  ]);
  const startHref = isAuthenticated ? "/app" : "/signup";
  const startLabel = isAuthenticated ? "Open workspace" : "Get Started";
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-svh overflow-x-clip">
      <SiteHeader isAuthenticated={isAuthenticated} />

      <main id="main-content">
        <section className="relative overflow-hidden py-16 sm:py-24 lg:py-28">
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,color-mix(in_srgb,var(--border)_35%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_srgb,var(--border)_35%,transparent)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:linear-gradient(to_bottom,black,transparent_82%)]" />
          <Container>
            <div className="grid items-center gap-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 xl:gap-20">
              <div>
                <Badge>Printing · Design · Artwork</Badge>
                <h1 className="mt-7 max-w-4xl text-5xl font-semibold leading-[0.98] tracking-[-0.055em] text-balance sm:text-6xl lg:text-7xl">
                  Your Printing &amp; Design Jobs, Made Easier.
                </h1>
                <p className="mt-7 max-w-2xl text-lg leading-8 text-muted sm:text-xl sm:leading-9">
                  Submit your printing and design requests remotely, stay informed
                  as your job progresses, and know when your work is ready for
                  pickup.
                </p>
                <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                  <Link className={primaryLinkClassName} href={startHref}>
                    {startLabel}
                    <span className="ml-2"><ArrowIcon /></span>
                  </Link>
                  <a className={secondaryLinkClassName} href="#how-it-works">
                    How It Works
                  </a>
                </div>
                <div className="mt-8 flex max-w-2xl items-start gap-3 border-t pt-5 text-sm leading-6 text-muted">
                  <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                  <p>
                    Secure account access is available now. Job submission,
                    tracking, messaging, and pickup tools are launching in future
                    releases.
                  </p>
                </div>
              </div>

              <HeroStudioVisual />
            </div>
          </Container>
        </section>

        <ServicesSection result={servicesResult} />

        <section
          aria-labelledby="workflow-heading"
          className="scroll-mt-24 py-20 sm:py-28"
          id="how-it-works"
          tabIndex={-1}
        >
          <Container>
            <div className="flex flex-col gap-7 border-b pb-10 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="section-kicker">How JobSubmit works</p>
                  <span className="rounded-full border border-accent/45 bg-accent/10 px-3 py-1 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.14em]">
                    Planned workflow
                  </span>
                </div>
                <h2
                  className="mt-4 max-w-2xl text-3xl font-semibold tracking-[-0.04em] text-balance sm:text-5xl"
                  id="workflow-heading"
                >
                  A clearer journey from request to collection.
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-6 text-muted sm:text-base sm:leading-7">
                Account sign-in works today. The six-step production journey below
                describes the experience being built, not currently available live
                job functionality.
              </p>
            </div>

            <ol className="mt-10 grid gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
              {workflowSteps.map((step, index) => (
                <li className="relative border-t pt-6" key={step.title}>
                  <div className="flex items-center justify-between gap-4">
                    <span className="grid size-9 place-items-center rounded-full bg-primary font-mono text-xs font-semibold text-primary-foreground">
                      {index + 1}
                    </span>
                    <span className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
                      Coming soon
                    </span>
                  </div>
                  <h3 className="mt-6 text-xl font-semibold tracking-tight">
                    {step.title}
                  </h3>
                  <p className="mt-3 max-w-sm text-sm leading-6 text-muted">
                    {step.description}
                  </p>
                </li>
              ))}
            </ol>
          </Container>
        </section>

        <section className="bg-primary py-20 text-primary-foreground sm:py-28">
          <Container>
            <div className="grid gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:gap-20">
              <div>
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground">
                  Why use JobSubmit?
                </p>
                <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-balance sm:text-5xl">
                  Less guesswork. Better job context.
                </h2>
                <p className="mt-6 max-w-lg text-base leading-7 text-primary-foreground/70">
                  JobSubmit is being designed to make requesting, discussing, and
                  collecting print work more organized for customers and the
                  production team.
                </p>
                <div className="mt-8 rounded-2xl border border-primary-foreground/20 bg-primary-foreground/6 p-5">
                  <p className="font-semibold text-primary-foreground">
                    Planned Express handling
                  </p>
                  <p className="mt-2 text-sm leading-6 text-primary-foreground/70">
                    Express/Urgent requests will carry a 40% surcharge on the
                    confirmed normal base price. Express means priority handling,
                    not instant or guaranteed completion.
                  </p>
                </div>
              </div>

              <div className="grid gap-px overflow-hidden rounded-2xl border border-primary-foreground/15 bg-primary-foreground/15 sm:grid-cols-2">
                {benefits.map((benefit) => (
                  <article className="bg-primary p-6 sm:p-7" key={benefit.title}>
                    <span className="grid size-8 place-items-center rounded-full bg-accent text-accent-foreground">
                      <CheckIcon />
                    </span>
                    <h3 className="mt-5 font-semibold tracking-tight">
                      {benefit.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-primary-foreground/65">
                      {benefit.description}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </Container>
        </section>

        <section
          aria-labelledby="about-heading"
          className="scroll-mt-24 py-20 sm:py-28"
          id="about"
          tabIndex={-1}
        >
          <Container>
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-20">
              <div className="relative min-h-96 overflow-hidden rounded-[2rem] border bg-surface-muted p-7 sm:p-10">
                <div aria-hidden="true" className="absolute -right-16 -top-16 size-64 rounded-full border-[32px] border-accent/20" />
                <div className="relative flex h-full min-h-80 flex-col justify-between">
                  <div className="flex items-center gap-3">
                    <span className="h-px w-12 bg-accent" />
                    <span className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted">
                      Print · Design · Artwork
                    </span>
                  </div>
                  <div>
                    <p className="max-w-md text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl">
                      Thoughtful production starts with a clear brief.
                    </p>
                    <div aria-hidden="true" className="mt-8 grid grid-cols-4 gap-2">
                      <span className="h-3 rounded-full bg-foreground" />
                      <span className="h-3 rounded-full bg-accent" />
                      <span className="h-3 rounded-full bg-[color:var(--brand-goldenrod)]" />
                      <span className="h-3 rounded-full border bg-surface" />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <p className="section-kicker">About the business</p>
                <h2
                  className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-balance sm:text-5xl"
                  id="about-heading"
                >
                  Practical print and design support, with a more connected workflow ahead.
                </h2>
                <p className="mt-6 text-lg leading-8 text-muted">
                  Capt. Bob Cedi&apos;s Artworks provides printing, design, and
                  artwork services across the categories listed above. JobSubmit
                  is the dedicated platform being built to make customer requests,
                  production updates, and pickup coordination easier to manage.
                </p>
                <p className="mt-5 text-base leading-7 text-muted">
                  The public welcome page explains that direction honestly while
                  secure operational capabilities are introduced in later releases.
                </p>
              </div>
            </div>
          </Container>
        </section>

        <section
          aria-labelledby="contact-heading"
          className="scroll-mt-24 border-y bg-surface-muted/55 py-20 sm:py-28"
          id="contact"
          tabIndex={-1}
        >
          <Container>
            <div className="overflow-hidden rounded-[2rem] border bg-surface">
              <div className="grid lg:grid-cols-[1.2fr_0.8fr]">
                <div className="p-7 sm:p-10 lg:p-14">
                  <p className="section-kicker">Unlisted or custom work</p>
                  <h2
                    className="mt-4 max-w-2xl text-3xl font-semibold tracking-[-0.04em] text-balance sm:text-5xl"
                    id="contact-heading"
                  >
                    Not every request fits neatly into a category.
                  </h2>
                  <p className="mt-6 max-w-2xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
                    Customers will be able to ask for clarification when a job does
                    not match the listed services. A verified public phone number or
                    email address has not been configured for this site, so no
                    unverified contact details are shown.
                  </p>
                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <Link className={primaryLinkClassName} href={isAuthenticated ? "/app" : "/login"}>
                      {isAuthenticated ? "Open workspace" : "Sign in to JobSubmit"}
                      <span className="ml-2"><ArrowIcon /></span>
                    </Link>
                    <a className={secondaryLinkClassName} href="#services">
                      Review services
                    </a>
                  </div>
                </div>
                <div className="grid min-h-72 place-items-center border-t bg-primary p-10 text-primary-foreground lg:border-l lg:border-t-0">
                  <div className="max-w-sm text-center lg:text-left">
                    <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent text-accent-foreground lg:mx-0">
                      <svg aria-hidden="true" className="size-6" fill="none" viewBox="0 0 24 24">
                        <path d="M5 6h14v10H9l-4 3V6Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.5" />
                        <path d="M8 10h8m-8 3h5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
                      </svg>
                    </span>
                    <p className="mt-6 text-xl font-semibold tracking-tight">
                      Verified contact options are coming.
                    </p>
                    <p className="mt-3 text-sm leading-6 text-primary-foreground/65">
                      They will be published here only after the business confirms
                      the correct public channel.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Container>
        </section>

        <section aria-labelledby="faq-heading" className="py-20 sm:py-28">
          <Container>
            <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20">
              <div>
                <p className="section-kicker">Frequently asked questions</p>
                <h2
                  className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-balance sm:text-5xl"
                  id="faq-heading"
                >
                  What to expect from JobSubmit.
                </h2>
                <p className="mt-5 max-w-md text-base leading-7 text-muted">
                  A clear distinction between what works today and what is planned
                  for the complete customer workflow.
                </p>
              </div>

              <div className="divide-y border-y">
                {frequentlyAskedQuestions.map((item, index) => (
                  <details className="group py-1" key={item.question} open={index === 0}>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-5 rounded-sm py-5 text-left font-semibold outline-none marker:content-none focus-visible:ring-2 focus-visible:ring-ring">
                      {item.question}
                      <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full border text-lg font-normal transition-transform group-open:rotate-45">
                        +
                      </span>
                    </summary>
                    <p className="max-w-2xl pb-6 pr-10 text-sm leading-7 text-muted sm:text-base">
                      {item.answer}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          </Container>
        </section>

        <section className="border-t py-16 sm:py-20">
          <Container className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-end">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                Ready when you are
              </p>
              <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.04em] text-balance sm:text-5xl">
                Begin with secure account access.
              </h2>
            </div>
            <Link className={primaryLinkClassName} href={startHref}>
              {startLabel}
              <span className="ml-2"><ArrowIcon /></span>
            </Link>
          </Container>
        </section>
      </main>

      <footer className="border-t bg-surface py-10">
        <Container>
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="font-semibold tracking-tight">{siteConfig.businessName}</p>
              <p className="mt-1 font-mono text-xs uppercase tracking-[0.16em] text-muted">
                {siteConfig.productName}
              </p>
            </div>
            <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted">
              <a className="outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" href="#services">Services</a>
              <a className="outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" href="#how-it-works">How It Works</a>
              <a className="outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" href="#about">About</a>
              <a className="outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" href="#contact">Contact</a>
              <Link className="outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" href="/login">Sign In</Link>
            </nav>
          </div>
          <div className="mt-10 flex flex-col gap-2 border-t pt-6 text-xs leading-5 text-muted sm:flex-row sm:items-center sm:justify-between">
            <p>© {currentYear} {siteConfig.businessName}. All rights reserved.</p>
            <p>JobSubmit customer workflow capabilities are launching progressively.</p>
          </div>
        </Container>
      </footer>
    </div>
  );
}

