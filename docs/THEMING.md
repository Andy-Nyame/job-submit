# JobSubmit theming

JobSubmit presents **Light** and **Dark** through one shared sun/moon toggle.
When no valid explicit preference has been saved, the internal System default
follows the operating system in real time. Clicking the toggle selects the
opposite of the currently applied theme and stops following system changes.
The explicit choice is stored in `localStorage` under `jobsubmit-theme`;
unavailable storage falls back safely to System for the next visit while
in-session switching still works. A legacy stored `system` value is treated as
the automatic default for compatibility with the previous selector.

An early root-layout initializer resolves the saved preference before React
hydrates. Interactive toggles use one shared client store, so changes apply
immediately across desktop and mobile navigation without converting pages or
layouts into Client Components.

## Palette and token conventions

JobSubmit's identity is Royal Blue, Metallic Gold, and Soft Charcoal. Light
uses `#F5F7FB` for the page, `#FFFFFF` for cards, `#262B34` for primary text,
`#2452A2` for primary actions, and `#C49A45` for restrained gold accents. Dark
uses `#181C23` for the page, `#252B35`–`#394351` for cards and interactive
surfaces, `#F4F7FB` for primary text, an accessible `#77A5F2` blue for primary
actions, and `#D5AD5B` for gold accents.

Future UI must consume the semantic variables mapped in `globals.css`, such as
`background`, `foreground`, `surface`, `surface-muted`, `surface-hover`,
`input`, `input-border`, `border`, `muted`, `primary`, `primary-hover`,
`primary-surface`, `accent`, `disabled`, `destructive`, and `success`. Gold is
an accent rather than the default action colour. Add or refine a semantic token
when a new visual role is needed; do not place theme palette values in
individual components.
