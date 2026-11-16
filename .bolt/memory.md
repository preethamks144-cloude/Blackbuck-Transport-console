# Project memory

## Product intent & audience

- Blackbuck Transport Admin Console: internal admin tool for managing transport operations.
- Core domains: loads, drivers, trips, subscriptions, invoices, and payments.
- Secondary surfaces: notifications, reports, global search, status updates, CSV export, session/logout.
- Audience: transport operations admins (internal users), single‑operator trial context for now.

## Brand personality & voice

- Admin/utility tool: functional, clear, trustworthy. Prioritize legibility and task completion over marketing tone.
- UI labels and status terms should be direct and operational (e.g., load/trip statuses, payment states).

## Visual design & UX direction

- Responsive web app; must work across desktop and mobile (responsive navigation implemented).
- Stack-driven UI: React + TypeScript + Tailwind CSS; `lucide-react` for all icons/logos.
- Prefer `@/` path alias for project imports over deep relative paths.
- Production-grade polish required (not cookie-cutter); fully featured pages expected.
- Working interactions over static/mock UI: create/update flows, status changes, search, export, and logout must actually function.

## Decisions, constraints & rationale

- App is currently running in **local trial mode** (browser `localStorage`); it is **not** connected to Supabase.
  - Rationale: user explicitly requested no backend connection until they attach their own; trial/testing only.
  - Records persist locally across refreshes; reset by clearing browser site data.
- Trial admin credentials hardcoded for now:
  - Email: `preethamks@gmail.com`
  - Password: `preethu@123`
- Supabase remains in the project stack/config but is intentionally left empty/disconnected for the trial phase.
- All previously visual-only pages were converted to functional local flows (create/update, status updates, search, CSV export, logout).
- Linting, type checks, and production build pass in the current offline/local-mode state.

## Open questions & assumptions

- Assumption: Supabase schema/env values will be supplied later by the user; no backend wiring to add yet.
- Assumption: single admin account is sufficient for the trial; no multi-user/auth backend expected now.
- Open: whether data model/migrations should be prepped for Supabase in advance of connection, or deferred entirely.
- Open: whether CSV export columns and status enums match the eventual backend schema or need alignment later.
- `.bolt/prompt` contains authoritative global UI/build instructions (icons, path alias, Tailwind, quality bar); not restated here.