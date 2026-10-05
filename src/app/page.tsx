import { SiteHeader } from "@/components/layout/site-header";
import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />

      <main id="main-content" className="flex flex-1 items-center py-16 sm:py-24">
        <Container>
          <section aria-labelledby="foundation-heading" className="max-w-3xl">
            <Badge>Brick 1 · Foundation</Badge>
            <h1
              id="foundation-heading"
              className="mt-7 text-4xl font-medium tracking-[-0.045em] text-balance sm:text-6xl sm:leading-[1.04]"
            >
              A clear foundation for the work that comes next.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted sm:text-xl sm:leading-9">
              JobSubmit is the remote job-submission and production workflow
              platform for Capt. Bob Cedi&apos;s Artworks. This first brick
              establishes the application shell, design system, and engineering
              baseline only.
            </p>

            <div className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <Button disabled>Application features are deferred</Button>
              <p className="text-sm leading-6 text-muted">
                No accounts, jobs, workflows, or business data exist yet.
              </p>
            </div>
          </section>

          <section
            aria-label="Foundation summary"
            className="mt-16 grid gap-4 sm:mt-24 sm:grid-cols-2"
          >
            <Card>
              <p className="font-mono text-xs font-medium uppercase tracking-[0.16em] text-muted">
                Product
              </p>
              <h2 className="mt-4 text-xl font-medium tracking-tight">
                JobSubmit
              </h2>
              <p className="mt-2 max-w-md leading-7 text-muted">
                A dedicated, independent system for Capt. Bob Cedi&apos;s
                Artworks.
              </p>
            </Card>

            <Card className="bg-surface-muted">
              <p className="font-mono text-xs font-medium uppercase tracking-[0.16em] text-muted">
                Current scope
              </p>
              <h2 className="mt-4 text-xl font-medium tracking-tight">
                Production-ready groundwork
              </h2>
              <p className="mt-2 max-w-md leading-7 text-muted">
                Responsive structure, accessible primitives, semantic theme
                tokens, strict typing, and documented decisions.
              </p>
            </Card>
          </section>
        </Container>
      </main>

      <footer className="border-t py-6">
        <Container className="flex flex-col gap-1 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>Capt. Bob Cedi&apos;s Artworks</p>
          <p className="font-mono text-xs uppercase tracking-[0.14em]">
            JobSubmit · Foundation
          </p>
        </Container>
      </footer>
    </div>
  );
}
