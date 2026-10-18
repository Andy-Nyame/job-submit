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

Light uses `#F7F8FA` for the page, `#FFFFFF` for cards, `#24272D` for primary
text, and `#B58A35` for gold accents. Dark uses `#24272D` for the page,
`#343840` for cards, `#3B4048`–`#484D55` for inset and hover surfaces,
`#F4F4F5` for primary text, and `#D2A64B` for gold accents.

Future UI must consume the semantic variables mapped in `globals.css`, such as
`background`, `foreground`, `surface`, `surface-muted`, `surface-hover`,
`input`, `border`, `muted`, `primary`, `accent`, `disabled`, `destructive`, and
`success`. Add or refine a semantic token when a new visual role is needed;
do not place theme palette values in individual components.
