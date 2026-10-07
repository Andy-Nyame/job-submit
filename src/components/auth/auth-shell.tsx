import Link from "next/link";
import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { siteConfig } from "@/config/site";

interface AuthShellProps {
  children: ReactNode;
  description: string;
  heading: string;
}

export function AuthShell({ children, description, heading }: AuthShellProps) {
  return (
    <main
      id="main-content"
      className="flex min-h-dvh items-center justify-center px-5 py-12 sm:px-8"
    >
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-8 inline-flex flex-col rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
        >
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            {siteConfig.businessName}
          </span>
          <span className="mt-1 text-lg font-semibold tracking-tight">
            {siteConfig.productName}
          </span>
        </Link>

        <Card className="p-6 sm:p-8">
          <header>
            <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
            <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
          </header>
          <div className="mt-7">{children}</div>
        </Card>
      </div>
    </main>
  );
}
