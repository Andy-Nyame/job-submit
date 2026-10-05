# JobSubmit

JobSubmit is the remote job-submission and production workflow platform for **Capt. Bob Cedi's Artworks**. This repository is a new, independent production project with its own source tree, Git history, environment, and future infrastructure.

## Brick 1 scope

Brick 1 establishes foundation only:

- Next.js App Router with React and strict TypeScript
- Tailwind CSS and semantic light/dark design tokens
- a responsive, accessible root application shell
- four small internal UI primitives: `Button`, `Container`, `Card`, and `Badge`
- ESLint, metadata, environment hygiene, and architecture documentation

Database access, Prisma, authentication, user accounts, jobs, queues, worker/admin/owner interfaces, notifications, uploads, storage, payments, pickup codes, stars, and all business workflows are intentionally deferred to later bricks.

## Requirements

- Node.js 20.9 or newer (development currently uses Node.js 22)
- npm 10 or newer

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Quality commands:

```bash
npm run lint
npm run typecheck
npm run build
npm audit
```

No environment variables are required in Brick 1. `.env.example` records that fact; real `.env*` files remain ignored.

## Project structure

```text
src/
  app/                  App Router shell, metadata, page, and global tokens
  components/
    layout/             Structural presentation components
    ui/                 Small reusable UI primitives
  config/               Factual product and site configuration
  lib/                  Framework-agnostic utilities
docs/
  ARCHITECTURE.md       Boundaries, decisions, and documented future rules
```

Server-only modules, domain types, and domain constants will be added only when a later brick introduces a real server or domain requirement. This avoids empty speculative structure. Server Components remain the default under `src/app`; future privileged modules will live behind an explicit server-only boundary.

## Visual and theme direction

The visual foundation is premium, modern, clean, and restrained. Black and white carry the interface; gold (`#D4AF37`) and goldenrod (`#DAA520`) are deliberate accents. Components consume semantic tokens such as background, surface, border, muted text, primary, accent, destructive, and ring rather than embedding brand colors.

Light and dark token sets respond to the operating-system preference and already support a future explicit `data-theme` selection. Final theme controls are not part of Brick 1. Future access rules are documented in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Project separation

This repository is not part of Footwear Empire, Vault Commerce, CIV, Kobby's Kitchen, or any other existing client system. It must receive its own database, storage, environment configuration, deployment, and remote repository when those are introduced. No existing project's code, data, credentials, or infrastructure should be connected to JobSubmit.
