# Frontend Coding Guidelines

---

## Use typed ApiClient for all API calls

Never use raw `fetch()`. Use `ApiClient` from `packages/frontend/src/lib/api-client.ts`.

```typescript
// ✅ Correct
import { ApiClient } from "../lib/api-client";
import type { ApiRoutes } from "backend/api";

const api = new ApiClient<ApiRoutes>();
const health = await api.fetch("/api/health", "GET");
const hello = await api.fetch("/api/hello", "GET", { query: { name: "World" } });
```

```typescript
// ❌ Wrong
const response = await fetch("/api/health");
```

---

## Import backend types directly

Never duplicate types that exist in backend. Import them directly.

```typescript
// ✅ Correct
import type { SomeType } from "backend/lib/some-type";
```

```typescript
// ❌ Wrong - duplicating backend types
interface SomeType {
  id: string;
  name: string;
}
```

---

## Use loadConfig() for configuration (scripts only)

In scripts (e.g., `scripts/dev.ts`, `scripts/deploy.ts`), use `loadConfig()` to read `tss.json`:

```typescript
import { loadConfig } from "shared/config";
const config = loadConfig();
```

This does NOT apply to runtime code (`src/`) which runs in the browser and cannot access the filesystem.

---

## Build custom UI components — do NOT use shadcn

This project does **not** use shadcn/ui. Build custom components with Tailwind CSS v4 and Lucide icons. Existing UI primitives live in `packages/frontend/src/components/ui/`.

- Utility: `packages/frontend/src/lib/utils.ts` (provides `cn()` for class merging)
- Never run `npx shadcn` — it is not installed
- Build new UI primitives by hand in `packages/frontend/src/components/ui/`

---

## Use useMutation for async actions

Use the `useMutation` hook for async actions (API calls on button click, form submissions, etc.). Never use manual `useState` for loading/error state.

```typescript
// ✅ Correct - useMutation handles loading/error state
import { useMutation } from "@/hooks/useMutation";

const { mutate, isPending } = useMutation(async () => {
  await api.fetch("/api/channels", "POST", { body: { type: "telegram" } });
});

<Button onClick={mutate} disabled={isPending}>Create</Button>
```

```typescript
// ❌ Wrong - manual loading/error state
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

const handleClick = async () => {
  setLoading(true);
  try {
    await api.fetch("/api/channels", "POST", { body: { type: "telegram" } });
  } catch (e) {
    setError(e.message);
  } finally {
    setLoading(false);
  }
};
```

---

## Use react-hook-form for form state — never hand-roll `useState` per field

Forms with multiple inputs go through `react-hook-form` (already a project
dep — see `ProfilePageLoaded.tsx` for the canonical pattern). Don't chain
`useState` per field, then a separate `useState` for submission/error
state. `useForm` consolidates: typed values, dirty tracking, validation,
async submission status, and field-level + form-level errors — all out
of the box.

For form-level errors (e.g. "invalid email or password" from an auth
endpoint), use `setError("root", { message })` and read via
`formState.errors.root?.message`. Don't introduce a parallel `useState`.

```tsx
// ✅ Correct — useForm owns all form state
import { useForm } from "react-hook-form";

type Values = { email: string; password: string };

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const { register, handleSubmit, setError, formState } = useForm<Values>({
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    const { error } = await signIn.email({ email, password });
    if (error) {
      setError("root", { message: error.message ?? "Invalid email or password." });
      return;
    }
    onSuccess();
  });

  return (
    <form onSubmit={(e) => { void onSubmit(e); }}>
      <Input {...register("email", { required: true })} type="email" />
      <Input {...register("password", { required: true })} type="password" />
      {formState.errors.root && (
        <div className="text-error">{formState.errors.root.message}</div>
      )}
      <Button type="submit" loading={formState.isSubmitting}>Log in</Button>
    </form>
  );
}
```

```tsx
// ❌ Wrong — three useState calls + manual loading flag
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [error, setError] = useState<string | null>(null);
const submit = useMutation(async () => {
  setError(null);
  const { error } = await signIn.email({ email, password });
  if (error) setError(error.message);
});
// <Input value={email} onChange={(e) => setEmail(e.target.value)} />  ← noise
```

Single-input prototypes can stay `useState`; the rule kicks in once you
have 2+ fields, or any combination of fields + validation + submission
status. Use `useFieldArray` for repeating sections; `Controller` for
non-native inputs that don't accept a ref through spread.

---

## Use cn() for conditional classes

Use `cn()` from `@/lib/utils` for conditional Tailwind classes. Never use template literals with ternaries.

```typescript
// ✅ Correct
import { cn } from "@/lib/utils";

<div className={cn("rounded-lg border", isError ? "border-red-400" : "border-blue-400")} />
<p className={cn("text-sm text-gray-700", isLong && "line-clamp-3")} />
```

```typescript
// ❌ Wrong - template literal with conditional
<div className={`rounded-lg border ${isError ? "border-red-400" : "border-blue-400"}`} />
<p className={`text-sm text-gray-700 ${isLong ? "line-clamp-3" : ""}`} />
```

---

## Avoid `unknown` and `as` casts — use generics and inline construction

`unknown` is banned by ESLint. Instead of returning `unknown` and casting the result, make the function generic so callers specify the type at the call site.

```typescript
// ✅ Correct - generic return type, caller specifies T
async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(path);
  return res.json() as Promise<T>;
}
const data = await apiFetch<{ items: Event[] }>("/events");
```

```typescript
// ❌ Wrong - returns unknown, caller casts with as
async function apiFetch(path: string): Promise<unknown> {
  const res = await fetch(path);
  return res.json();
}
const data = (await apiFetch("/events")) as { items: Event[] };
```

Don't build objects imperatively with a mutable `Record<string, unknown>` — construct them inline as a single expression. TypeScript infers the type automatically.

```typescript
// ✅ Correct - single inline object, no type annotation needed
const data = await apiFetch<Event>(`/events/${id}`, {
  method: "PATCH",
  body: JSON.stringify({
    summary: params.title,
    start: params.start ? { dateTime: params.start } : undefined,
    description: params.description,
  }),
});
```

```typescript
// ❌ Wrong - mutable object, needs explicit type, multiple statements
const body: Record<string, unknown> = {};
if (params.title !== undefined) body.summary = params.title;
if (params.start !== undefined) body.start = { dateTime: params.start };
if (params.description !== undefined) body.description = params.description;
const data = (await apiFetch(`/events/${id}`, {
  method: "PATCH",
  body: JSON.stringify(body),
})) as Event;
```

---

## Never add redundant type annotations

Never annotate a type that TypeScript already infers. Explicit annotations on variables, return types, and parameters are noise when the compiler knows the type.

Always start without type annotations. If eslint complains about an unresolved type, fix the underlying issue — don't add a type annotation as a workaround. Annotations to "help eslint" or "work around deep type inference" are never acceptable.

```typescript
// ✅ Correct - type is inferred
const baseUrl = c.get("baseUrl");
const items = rows.map((r) => r.id);
const logs = await api.fetch("/api/agents/:agentId/logs", "GET", { ... });
```

```typescript
// ❌ Wrong - redundant annotation
const baseUrl: string = c.get("baseUrl");
const items: string[] = rows.map((r) => r.id);
// ❌ Wrong - "workaround" annotation for eslint type resolution
const logs: AgentLogRow[] = await api.fetch("/api/agents/:agentId/logs", "GET", { ... });
```

---

## Use superjson for localStorage with non-JSON types

When storing objects that contain `Date`, `Map`, `Set`, or other non-JSON-native types in localStorage, use `superjson` instead of `JSON.stringify`/`JSON.parse`. Encapsulate the cache in a typed class with `get`/`set`/`clear` methods.

```typescript
// ✅ Correct - superjson preserves Date types automatically
import superjson from "superjson";

class SessionCache<T extends { session: { expiresAt: Date } }> {
  constructor(private key: string) {}

  get(): T | null {
    const stored = localStorage.getItem(this.key);
    if (!stored) return null;
    return superjson.parse<T>(stored); // Dates are real Dates
  }

  set(session: T): void {
    localStorage.setItem(this.key, superjson.stringify(session));
  }

  clear(): void {
    localStorage.removeItem(this.key);
  }
}
```

```typescript
// ❌ Wrong - manual Date reconstitution
const stored = JSON.parse(localStorage.getItem(key)!);
stored.session.expiresAt = new Date(stored.session.expiresAt);
stored.session.createdAt = new Date(stored.session.createdAt);
stored.user.createdAt = new Date(stored.user.createdAt);
```

---

## Never cast discriminated union types

When a type is already a discriminated union (e.g. `InstallableSkillConfig` with `skill_id` discriminant), never cast it to `Record<string, unknown>` or any other type. Use the discriminant to narrow and let TypeScript infer the config shape.

```typescript
// ✅ Correct - narrow via discriminant, TypeScript infers config type
if (record.data.skill_id === "telegram") {
  const { config } = record.data; // TelegramConfig
  config.botToken; // string
}

// ✅ Correct - typed map where each entry receives narrowed type
const extras: { [K in SkillId]?: React.FC<{ record: NarrowedRow<K> }> } = {
  telegram: ({ record }) => {
    const { config } = record.data; // TelegramConfig, no cast needed
  },
};
```

```typescript
// ❌ Wrong - casting away the union type
const config = record.data.config as Record<string, unknown>;
config.botToken as string; // double cast, loses all type safety
```

---

## Use AppLink for navigation — prefer asChild pattern

Use `AppLink` from `@/components/ui/app-link` when wrapping a component with a link. `AppLink` uses `createLink` + Radix `Slot` to merge link behavior onto its child element — the child becomes the `<a>` directly with no wrapper DOM.

Use TanStack Router's `<Link>` only for simple inline text links (e.g. "Back", breadcrumbs, nav items).

```tsx
// ✅ Correct — AppLink merges onto Tile, DOM is just <a>...</a>
import { AppLink } from "@/components/ui/app-link";

<AppLink to="/dashboard/$agentId/cron" params={{ agentId }}>
  <Tile className={className}>
    <TileHeader icon={ClockIcon} label="Scheduled Tasks" />
    <TileBody>...</TileBody>
  </Tile>
</AppLink>
```

```tsx
// ❌ Wrong — Link wrapping Tile creates <a><div>...</div></a>
import { Link } from "@tanstack/react-router";

<Link to="/dashboard/$agentId/cron" params={{ agentId }} className={className}>
  <Tile>
    <TileHeader icon={ClockIcon} label="Scheduled Tasks" />
    <TileBody>...</TileBody>
  </Tile>
</Link>
```

```tsx
// ✅ OK — simple inline text link, no wrapping
import { Link } from "@tanstack/react-router";

<Link to="/dashboard" className="text-sm text-text-2">Back</Link>
```

---

## Route file structure

Routes use TanStack Router with manual route definitions (not file-based auto-generation). Each route lives in a `_route.tsx` file inside a directory that mirrors the URL path.

**Convention:**
- Each URL segment gets its own directory under `src/routes/`
- The route definition goes in `_route.tsx` inside that directory
- Dynamic segments use `$param` directories (e.g. `$agentId/`, `$skillId/`)
- Sibling components are colocated in the same directory as `_route.tsx`
- Parent route is imported via relative path (e.g. `../_route`) — not absolute `@/routes/...`
- The `path` in `createRoute` declares the segment(s) from the parent — it does NOT repeat the full URL
- The route tree is manually assembled in `src/routeTree.gen.ts`

```
src/routes/app/dashboard/
├── _route.tsx                        # dashboardRoute — path: "/dashboard"
├── $index/_route.tsx                 # dashboardIndexRoute — path: "/"
├── $agentId/
│   ├── _route.tsx                    # agentDetailRoute — path: "/$agentId"
│   ├── cron/
│   │   ├── _route.tsx                # agentCronRoute — path: "/cron"
│   │   └── AgentCronPage.tsx         # colocated component
│   ├── logs/
│   │   ├── _route.tsx                # agentLogsRoute — path: "/logs"
│   │   └── page.tsx
│   ├── settings/
│   │   ├── _route.tsx                # agentSettingsRoute — path: "/settings"
│   │   ├── NamePanel.tsx
│   │   └── ...
│   ├── memories/
│   │   ├── _route.tsx                # agentMemoriesRoute — path: "/memories" (layout)
│   │   ├── index/_route.tsx          # agentMemoriesIndexRoute — path: "/"
│   │   └── $nodeId/_route.tsx        # agentMemoriesNodeRoute — path: "/$nodeId"
│   └── skills/
│       └── $skillId/
│           ├── _route.tsx            # skillDetailRoute — path: "/skills/$skillId"
│           └── ChatInput.module.css
```

```typescript
// ✅ Correct — _route.tsx with relative parent import
// File: $agentId/cron/_route.tsx
import { createRoute } from "@tanstack/react-router";
import { agentDetailRoute } from "../_route";
import { AgentCronPage } from "./AgentCronPage";

export const agentCronRoute = createRoute({
  getParentRoute: () => agentDetailRoute,
  path: "/cron",
  component: AgentCronPage,
});
```

```typescript
// ❌ Wrong — route defined in a named .tsx file, not _route.tsx
// File: $agentId/skills/SkillDetailView.tsx
export const skillDetailRoute = createRoute({ ... });
```

```typescript
// ❌ Wrong — absolute import for parent route
import { agentDetailRoute } from "@/routes/app/dashboard/$agentId/_route";
```

---

## Component-specific animations live in a colocated `.module.css`, not `global.css`

`global.css` is for design-system primitives (color tokens, selectable-button
utilities, site-wide keyframes reused by many components). A keyframe that
only one component uses does not belong there — it pollutes the global
namespace and makes `global.css` a catch-all dumping ground.

Put the keyframe + its wrapper class in a colocated `.module.css`. CSS modules
hash both class and keyframe names, so no collision risk.

```css
/* ✅ Correct — ChatConversation.module.css, colocated */
@keyframes fireflyBreathe {
  0%, 100% { transform: translateY(0) scale(0.7); opacity: 0.25; }
  50%      { transform: translateY(-2px) scale(1); opacity: 1;   }
}

.breathe {
  animation: fireflyBreathe 1.6s ease-in-out infinite;
}
```

```tsx
// ✅ Consumer reads the hashed class; per-instance delay stays inline
import styles from "./ChatConversation.module.css";

<span className={styles.breathe} style={{ animationDelay: "200ms" }} />
```

```css
/* ❌ Wrong — one-component animation polluting global.css */
/* global.css */
@keyframes firefly-breathe { ... }
.leaf-sway { animation: firefly-breathe ...; }
```

---

## Tailwind v4: register custom animations with `@theme`, not `@utility`

`@utility foo { animation: ... }` in Tailwind v4 does NOT register an
animation utility. The class resolves (Tailwind emits the `@utility` CSS),
but the animation-name the caller references often fails to wire up to the
keyframes correctly. The v4 pattern for named animation utilities is:

```css
/* ✅ Correct — @theme registers --animate-foo, Tailwind generates animate-foo */
@theme {
  --animate-breathe: breathe 1.6s ease-in-out infinite;
}
@keyframes breathe { ... }
```

Then `className="animate-breathe"` works.

```css
/* ❌ Wrong — looks like it should work, doesn't */
@utility breathe {
  animation: breathe 1.6s ease-in-out infinite;
}
@keyframes breathe { ... }
```

If you need a per-instance parameter (e.g. `animation-delay` per sibling),
skip the utility entirely and inline the animation in `style`:

```tsx
// ✅ Correct — per-instance delay needs inline style anyway;
// don't introduce a utility for indirection
<span style={{ animation: `breathe 1.6s ease-in-out ${delay} infinite` }} />
```

---

## Never `@import "tailwindcss"` in CSS modules

CSS modules must not import Tailwind. Tailwind is already loaded once via `global.css`. Adding `@import "tailwindcss"` to a `.module.css` file creates a dependency on the entire Tailwind build — when any Tailwind class changes anywhere in the app, Vite invalidates that CSS module and every component that imports it, causing a massive HMR cascade.

```css
/* ✅ Correct — plain CSS, no Tailwind import */
.button {
  color: #fff;
  background: var(--base-color);
  box-shadow: 0 4px 16px oklch(from var(--base-color) l c h / 0.3);
}
```

```css
/* ❌ Wrong — creates HMR dependency on entire Tailwind build */
@import "tailwindcss";

.button {
  color: #fff;
  background: var(--base-color);
}
```

---

## CSS-module class names must always go through `styles.foo` — never a bare string

CSS modules hash class names at build time (`.mt2` becomes `.demo_mt2_a8f3c`). If you define a class in a `.module.css` and reference it as a bare string in JSX (`className="mt2"`), the bare name does **not** match the hashed name — your styles silently don't apply, no error, no warning, the element just renders without the rule.

This bites hardest when a `.module.css` defines helpers that *look like* Tailwind utilities (`.mt2`, `.flex`, `.gap4`, `.gap2`). At a glance the JSX looks correct ("oh, that's just Tailwind"); in reality it's a broken module reference that should have been `${styles.mt2}`.

Rule: every class defined in a `.module.css` is applied via the `styles` import. If you find yourself defining helpers that mirror Tailwind utilities, **delete them** and use Tailwind directly — don't shadow framework utilities with hashed locals.

```tsx
// ❌ Wrong — bare "mt2" never matches the hashed module class; styles drop silently
import styles from "./demo.module.css";
<h1 className={`${styles.display} mt2`}>Title</h1>
```

```tsx
// ✅ Correct (option A) — go through the styles import
<h1 className={`${styles.display} ${styles.mt2}`}>Title</h1>
```

```tsx
// ✅ Correct (option B, preferred) — use Tailwind directly, drop .mt2 from the module
<h1 className={`${styles.display} mt-2`}>Title</h1>
```

If a `.module.css` exports `.mt2`, `.flex`, `.gap4`, `.flex-wrap` etc., that's a smell — they shadow Tailwind utilities and create exactly this confusion. Drop them; consume Tailwind from the JSX side.

---

## CSS modules must not redeclare `:root` design tokens

Design tokens (`--bg`, `--text-1`, `--accent-1`, `--border`, the channel palette, etc.) live on `:root` in `global.css` exactly once. CSS modules **consume** them via `var(--token)` — they do not redeclare them inside their own scope.

Redeclaring a token in a `.module.css` (e.g. `.demo { --bg: #0E0A07; --text-1: #EFE4CF; ... }`) creates a parallel schema. The value now lives in two places: `:root` and the module's local scope. Change one, the other doesn't pick it up. The next person to retune the token in `global.css` will be surprised when the module's scope still resolves the old value.

Rule: tokens are declared once on `:root`. Modules consume `var(--token)`; they don't define `--token`.

```css
/* ❌ Wrong — redeclares global tokens inside the module's scope */
.demo {
  --bg:     #0E0A07;
  --cream:  #EFE4CF;
  --cyan:   #5BC8FF;
  /* …30 more shadowing :root… */

  background: var(--bg);
  color: var(--cream);
}
```

```css
/* ✅ Correct — consume from :root, declare only module-specific styles */
.demo {
  background: var(--bg);
  color: var(--cream);
}
```

The exception is *derived* values. A module can compute a local var from a token (e.g. `--demo-tint: color-mix(in oklch, var(--bg) 80%, var(--cyan) 20%);`) because that derived shape is module-specific. What you can't do is repeat the canonical token value.

---

## Only export React components from `.tsx` files

Every export from a `.tsx` file must be a React component (or a type). Exporting non-component values (cva variants, constants, utility functions) breaks Vite's React Fast Refresh — the entire file is invalidated on every change, cascading to all importers.

If you need to export a non-component value, move it to a separate `.ts` file.

```typescript
// ✅ Correct — only component exported from .tsx
// button.tsx
export function Button({ variant, size, className, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
```

```typescript
// ❌ Wrong — non-component export breaks Fast Refresh
// button.tsx
export function Button({ ... }: ButtonProps) { ... }
export { buttonVariants };  // ← breaks Fast Refresh for this file
```

---

## Never use hardcoded colors — always use design tokens

Never write hardcoded colors anywhere in component code. No `bg-[#FAFAF8]`, no `text-neutral-500`, no `border-gray-200`, no `bg-white`, no inline hex values. This applies to landing pages, marketing pages, app pages — every component without exception.

All colors must come from the design tokens defined in `packages/frontend/src/global.css`:

- **Backgrounds:** `bg-background`, `bg-muted`, `bg-surface` (via `--color-popover`/`--color-card`)
- **Text:** `text-text-1` (primary), `text-text-2` (secondary), `text-text-3` (tertiary)
- **Accents:** `text-accent-1`, `text-accent-2`, `text-accent-3` (and `bg-*` equivalents)
- **Borders:** `border-border`
- **State:** `text-error`, `text-success`

If you need a color that doesn't exist as a token, **stop and ask**. Either we add a new token to `global.css`, or we reuse an existing one. Never reach for `#FAFAF8`, `neutral-200`, or `gray-500` as a shortcut.

```tsx
// ✅ Correct — design tokens
<div className="bg-background text-text-1 border-border">
  <h1 className="text-text-1">Title</h1>
  <p className="text-text-2">Description</p>
</div>
```

```tsx
// ❌ Wrong — hardcoded hex
<div className="bg-[#FAFAF8] text-neutral-900 border-neutral-200">

// ❌ Wrong — Tailwind palette colors
<div className="bg-white text-gray-900 border-gray-200">

// ❌ Wrong — arbitrary values
<p className="text-[#666]">
```

This rule has zero exceptions. Hardcoded colors break theming, dark mode, and design system consistency. If you're tempted to hardcode a color "just for this one landing page," the answer is no — add a token instead.

---

## Use `selectable-button-accent-*` utilities — do NOT hand-roll hover/active state classes

The project defines `selectable-button-accent-1` / `-2` / `-3` utilities in `global.css`. They encapsulate the canonical normal / hover / active / selected visual language:

- Transparent resting background
- `bg-muted` at 50% on hover, 70% on active
- `bg-accent-{n}` at 18% / 24% / 30% on selected + hover-selected + active-selected, with `text-accent-{n}` when `aria-current="page"` or `data-selected="true"`

Any new interactive element that shows these states — list rows, sidebar items, tabs, toggles, ghost-style buttons, icon buttons — **must** use one of those utilities. Never re-implement the same `hover:bg-muted/40 active:bg-muted/70` pattern by hand.

```tsx
// ✅ Correct — utility handles normal/hover/active/selected
<button
  type="button"
  className={cn(
    "selectable-button-accent-1",
    "flex w-full items-center gap-4 px-4 py-3 text-left",
  )}
>
  ...
</button>

// Selected state — set via attribute, not a class toggle:
<Link
  to={href}
  activeOptions={{ exact: true }}
  // TanStack Router / React Router set aria-current="page" automatically when active.
  className={cn("selectable-button-accent-1", "h-8 rounded-md px-2.5")}
/>
```

```tsx
// ❌ Wrong — duplicates the utility's hover/active logic
<button
  className={cn(
    "transition-colors duration-150",
    "hover:bg-muted/40 active:bg-muted/70",
  )}
/>

// ❌ Wrong — manual bg/text toggle for selected state
<button
  className={selected
    ? "bg-accent-1/10 text-accent-1 hover:bg-accent-1/15"
    : "hover:bg-muted active:bg-muted/80"}
/>
```

### When the class string is a composition of utilities, use `@apply` — don't copy-paste the chain

If you find yourself writing the same multi-class `className` in more than one place (e.g. `icon-ghost-button`: a selectable accent-1 button that's centered, rounded, icon-sized), define a named utility in `global.css` using `@apply` instead of duplicating the class string:

```css
/* global.css */
@utility icon-ghost-button {
  @apply selectable-button-accent-1 inline-flex items-center justify-center rounded-md text-text-2;
  &:hover { color: var(--text-1); }
}
```

```tsx
// ✅ Correct — single utility name
<button type="button" className="icon-ghost-button size-7">
  <PaperPlaneTiltIcon size={14} />
</button>
```

```tsx
// ❌ Wrong — copy-pasted chain at every call site
<button
  className={cn(
    "selectable-button-accent-1",
    "flex size-7 items-center justify-center rounded-md text-text-2 hover:text-text-1",
  )}
/>
```

### Exceptions

Only hand-roll styles when the button is genuinely not a "selectable" pattern:

- **Solid/filled primary action buttons** (e.g. a "Save changes" button with `bg-accent-1` always filled) — these are call-to-actions, not selectable rows. Use the `Button` component instead.
- **Destructive buttons** with `text-error` + error-tinted hover — the accent theming of `selectable-button-accent-*` doesn't apply.

If you think you need a new variant, add it to `global.css` rather than inventing a one-off set of hover/active classes. Don't reuse the `selectable-button-*` prefix for non-selectable variants — that family is specifically for patterns with a selected/current state. Use a different name like `ghost-button-error` for destructive ghost buttons.

---

## Interactive elements must have four distinct visual states

Every button, link, menu item, tab, or interactive control must visually distinguish **normal**, **hover**, **active** (pressed), and **selected** states, and transition between them smoothly.

| State | Meaning | Typical treatment |
|-------|---------|-------------------|
| **Normal** | Resting | Muted text, no fill |
| **Hover** | Pointer over | Subtle tinted fill + text shift |
| **Active** | Mouse/touch down | Stronger fill + slight compress (`active:scale-[0.98]`) |
| **Selected** | Represents the current route, value, or toggle-on state | Accent-tinted fill + accent text (`bg-accent-1/10 text-accent-1`) |

Rules:
- A selected element still needs working hover and active layers — don't just lock it to one style when selected.
- All visual changes must animate via `transition-all duration-150` (or narrower if needed). No abrupt snaps.
- Stateless triggers (e.g. sign out, close) have no selected state — use normal/hover/active only.
- Never use a single `hover:` with no `active:` — the press feedback is part of the design, not optional.

```tsx
// ✅ Correct — all four states, smooth transitions
<Link
  to={href}
  className={cn(
    "flex h-8 items-center rounded-md px-2.5 transition-all duration-150 active:scale-[0.98]",
    selected
      ? "bg-accent-1/10 text-accent-1 hover:bg-accent-1/15 active:bg-accent-1/20"
      : "text-text-2 hover:bg-muted hover:text-text-1 active:bg-muted/80",
  )}
>
  {label}
</Link>
```

```tsx
// ✅ Correct — stateless icon button (no selected)
<button
  className="rounded-md p-1.5 text-text-2 transition-all duration-150 hover:bg-muted hover:text-text-1 active:scale-95 active:bg-muted/80"
  onClick={onClick}
/>
```

```tsx
// ❌ Wrong — only hover, no active, no transition
<button className="text-text-2 hover:bg-muted hover:text-text-1">
```

```tsx
// ❌ Wrong — selected locks out hover/active
<Link className={selected ? "bg-accent-1/10 text-accent-1" : "hover:bg-muted"}>
```

---

## Use `@phosphor-icons/react`, not `lucide-react`

For any new component, import icons from `@phosphor-icons/react`. Existing `lucide-react` usage will be migrated out — do not add new usage.

- Phosphor icon component names always end in `Icon` (e.g. `HouseIcon`, `EyeIcon`, `SparkleIcon`).
- Use the `weight` prop to control stroke/fill variants: `"regular"` (default), `"bold"`, `"fill"`, `"duotone"`.
- For generic icon typing, `import type { Icon } from "@phosphor-icons/react"`.

```tsx
// ✅ Correct
import { HouseIcon, ChatCircleIcon } from "@phosphor-icons/react";

<HouseIcon size={16} weight="regular" />
```

```tsx
// ❌ Wrong — do not use lucide in new code
import { Home } from "lucide-react";
```

---

## All overlaying UI must have enter AND exit animations

Every component that overlays content — modals, popovers, dropdowns, tooltips, sheets, toasts, context menus — must animate both in and out. **No exceptions.** A snap-in or snap-out overlay is a bug.

Rules:
- **Enter:** 150–220ms, `ease-out` (fast start, soft landing).
- **Exit:** 120–180ms, `ease-in` (soft start, quick disappear). Always *shorter* than enter.
- **Always pair opacity with motion.** Modals scale `0.95 → 1`; popovers/dropdowns/tooltips slide 4–8px from their anchor; sheets slide from the edge.
- **Backdrop fades only**, no transform. Same duration as content.
- **The exit animation must actually play.** If the overlay's open state is driven by route change, the overlay component must stay mounted long enough for the exit animation to finish. Cache the content in local state so it keeps rendering through the exit.

### Pattern: Radix `data-state` + `tw-animate-css`

Radix primitives (`Dialog`, `Popover`, `DropdownMenu`, `HoverCard`, `Tooltip`, …) set `data-state="open" | "closed"` on their content. Drive animations off that:

```tsx
<Dialog.Overlay
  className={cn(
    "fixed inset-0 z-40 bg-background/60 backdrop-blur-sm",
    "data-[state=open]:animate-in data-[state=closed]:animate-out",
    "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
    "data-[state=open]:duration-200 data-[state=closed]:duration-150",
  )}
/>
<Dialog.Content
  className={cn(
    "...",
    "data-[state=open]:animate-in data-[state=closed]:animate-out",
    "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
    "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
    "data-[state=open]:ease-out data-[state=closed]:ease-in",
    "data-[state=open]:duration-200 data-[state=closed]:duration-150",
  )}
/>
```

### Pattern: route-driven overlays

A dialog tied to a URL (e.g. `/memories/$id`) must not be unmounted by the route transition — otherwise the exit animation is skipped. Mount the overlay in the **parent** route, derive `open` from the URL, and cache the content so it stays rendered during exit:

```tsx
// ✅ Correct — overlay is owned by parent route, stays mounted during exit
export function MemoryPage() {
  const activeId = useRouterState({
    select: (s) => s.location.pathname.match(/\/memories\/([^/]+)$/)?.[1],
  });
  return (
    <>
      <List />
      <MemoryDetailDialog memoryId={activeId} />
    </>
  );
}

function MemoryDetailDialog({ memoryId }: { memoryId: string | undefined }) {
  // Cache the last memory so content still renders during exit animation
  const [cached, setCached] = useState(() => memoryId ? lookup(memoryId) : undefined);
  useEffect(() => { if (memoryId) setCached(lookup(memoryId)); }, [memoryId]);

  return (
    <Dialog.Root open={!!memoryId} onOpenChange={(o) => !o && navigate("/memories")}>
      ...
    </Dialog.Root>
  );
}
```

```tsx
// ❌ Wrong — dialog component is the route component, unmount cancels exit animation
export const detailRoute = createRoute({
  component: () => {
    const { id } = detailRoute.useParams();
    return <Dialog.Root open>...</Dialog.Root>;
  },
});
```

---

## 100-line component limit — break it down

If any component file is over ~100 lines, stop and ask: *why is this so complicated, and how can I break it into smaller, more obvious pieces?* A component that won't fit on a screen is a component nobody reads top-to-bottom — it's where inline duplication, tangled state, and hidden coupling accumulate.

Common ways a component balloons past the limit:

- **Inline sub-blocks** — headers, toolbars, empty states, loading skeletons, list items built inline. Extract each into a named component (`Toolbar`, `EmptyState`, `LoadingState`, `FooRow`) colocated in the same file or next to it.
- **Repeated UI patterns** — the same icon-button shell, the same form row, the same pill rendered in three spots. Lift into a primitive (`IconButton`, `FormField`, `Tag`) in `components/ui/` or a local helper.
- **Branching on type / state** — a single function returning different JSX based on a discriminated union. Split each branch into its own component (`CallMetadataEditor`, `DocumentMetadataEditor`) dispatched by a tiny `switch`.
- **Mixed concerns** — data fetching, form state, and presentation in one body. Separate into a loader/container component that fetches, then a presenter component that renders.

The rule isn't "exactly 100 lines" — it's *treat 100 as the smell threshold.* Sometimes the right component really is 130 lines and decomposing would hurt readability. Usually it isn't. Default to splitting and only keep it big if you can defend why.

```tsx
// ❌ Wrong — one 240-line MemoryPage with toolbar, list, empty state,
// search panel, table header, and hook all inline
export function MemoryPage() {
  // ... 30 lines of hooks + fetchers ...
  return (
    <PageShell title="Memory">
      <div className="flex items-center gap-3 px-8 py-3 border-b">
        {/* 30 lines of search input */}
        {/* 15 lines of new button */}
      </div>
      {debounced.length > 0 ? (
        <>{/* 40 lines of search list */}</>
      ) : memories.length === 0 ? (
        <>{/* 15 lines of empty state */}</>
      ) : (
        <>{/* 25 lines of table + rows */}</>
      )}
      <MemoryDetailDialog ... />
      <CreateMemoryModal ... />
    </PageShell>
  );
}
```

```tsx
// ✅ Correct — each chunk is its own named component, the top-level
// component just composes them
export function MemoryPage() {
  const { records } = usePaginatedQuery(...);
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query.trim(), 400);

  return (
    <PageShell title="Memory">
      <Toolbar query={query} onQueryChange={setQuery} onCreate={() => setCreateOpen(true)} />
      {debounced ? <SearchResultList query={debounced} /> : <MemoryList memories={records} />}
      <MemoryDetailDialog ... />
      <CreateMemoryModal open={createOpen} onOpenChange={setCreateOpen} ... />
    </PageShell>
  );
}
```

---

## Reuse the DOM tree across variants — don't branch into separate subtrees

When a component has two display modes (collapsed/expanded, compact/detailed, loading/loaded), don't return two entirely different JSX trees from the same component. Keep one layout, conditionally render the *parts* that actually differ, and let React reuse the DOM nodes.

Separate subtrees:
- Break animation / focus continuity (React unmounts and remounts everything).
- Duplicate shared markup — every future change has to be made twice.
- Often come with a private sub-component extracted just to dedupe the pieces you copied.

```tsx
// ❌ Wrong — two fully separate branches, same button rendered twice, and
// an unnecessary ToggleButton helper born just to avoid the duplication
function BrandHeader({ collapsed, onToggle }: Props) {
  if (collapsed) {
    return (
      <div className="flex h-14 items-center justify-center border-b border-border">
        <ToggleButton label="Expand sidebar" onClick={onToggle} />
      </div>
    );
  }
  return (
    <div className="flex h-14 items-center justify-between gap-2 border-b border-border pr-2 pl-5">
      <div className="min-w-0">{/* brand */}</div>
      <ToggleButton label="Collapse sidebar" onClick={onToggle} />
    </div>
  );
}
```

```tsx
// ✅ Correct — one tree, conditionally renders what actually differs.
// No extra ToggleButton needed.
function BrandHeader({ collapsed, onToggle }: Props) {
  return (
    <div className={cn(
      "flex h-14 items-center border-b border-border",
      collapsed ? "justify-center" : "justify-between gap-2 pr-2 pl-5",
    )}>
      {!collapsed && <div className="min-w-0">{/* brand */}</div>}
      <button
        type="button"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        onClick={onToggle}
        className="icon-ghost-button"
      />
    </div>
  );
}
```

If you catch yourself writing `if (state) return <A/>; return <B/>;` at the top of a render, ask whether the two trees are actually different *shapes* or just the same shape with different props.

---

## Don't attach Radix primitives per list item — hoist to list level

Each Radix `ContextMenu.Root`, `Tooltip.Root`, `DropdownMenu.Root`, `Popover.Root` attaches its own event listeners and renders its own Trigger instance. Putting one per row inside a list of hundreds or thousands of items means hundreds of listener sets for no reason.

For list-wide interactions (right-click, hover tooltip, etc.), keep **one** shared menu/tooltip at the list level. Each row just forwards its native DOM event (`onContextMenu`, `onMouseEnter`) up to the list, which tracks which row triggered it and opens the single shared surface.

```tsx
// ❌ Wrong — Radix Root per row; O(rows) listener sets and Triggers
export function MemoryRow({ memory }: { memory: Memory }) {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <Link>...</Link>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content>...</ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
```

```tsx
// ✅ Correct — single shared menu, rows just forward the native event
export function MemoryList({ memories }: { memories: Memory[] }) {
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  return (
    <>
      {memories.map((m) => (
        <MemoryRow
          key={m.id}
          memory={m}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenu({ id: m.id, x: e.clientX, y: e.clientY });
          }}
        />
      ))}
      <MemoryContextMenu state={menu} onClose={() => setMenu(null)} />
    </>
  );
}
```

Same principle for tooltip on list rows, hover cards on rows, drag handles — one shared surface driven by list-level state.

---

## Draft state matches the persisted type

When you pull a value into `useState` to edit it, the draft type should match the underlying persisted type. Don't stringify numbers because you're going to render them in an `<input>`. Don't `JSON.stringify` objects into a text field for editing. The conversion happens at the render boundary, not in the state.

```tsx
// ❌ Wrong — duration is number on disk; stored as string in state because
// "inputs take strings." Now every save needs `Number(...)`, every compare
// needs to think about "20" vs 20.
const [duration, setDuration] = useState(String(metadata.duration));
// ... onChange={(e) => setDuration(e.target.value)}
// ... save: Number(duration) || 0
```

```tsx
// ✅ Correct — draft is a number, same as the model
const [duration, setDuration] = useState(metadata.duration);
<input
  type="number"
  value={duration}                                // React coerces to string
  onChange={(e) => setDuration(Math.max(0, Number(e.target.value) || 0))}
/>
```

If the input can legitimately be "empty," use `number | null` — don't repurpose `0` or `""` as the empty sentinel.

---

## Don't add hypothetical optional props

When extracting a component, only ship the props *current* callers need. A `size` prop with no caller using a non-default value, a `className` override "for flexibility," an `iconSize` knob "in case we reuse this later" — all dead weight. They widen the API surface, force every future reader to understand the permutations, and tend to rot into lies (the default gets tuned and the "other" size path breaks silently).

Add the optional prop the moment a second caller actually needs a different value. Not before.

```tsx
// ❌ Wrong — size, iconSize, and className all land unused
export function MemoryTypeBadge({
  type,
  size = 7,         // nobody passes size=8
  iconSize = 14,    // nobody overrides
  className,        // only one caller; could be inlined there
}: { type: MemoryType; size?: 7 | 8; iconSize?: number; className?: string }) { ... }
```

```tsx
// ✅ Correct — just what callers actually pass today
export function MemoryTypeBadge({ type, className }: { type: MemoryType; className?: string }) {
  const style = memoryTypeStyle(type);
  return (
    <div className={cn("flex size-7 shrink-0 items-center justify-center rounded-md", style.iconClass, className)}>
      <style.icon size={14} weight="fill" />
    </div>
  );
}
```

---

## Repeated class strings belong in a `@utility`, not a JS constant

If the same Tailwind class string shows up in three or more JSX sites, promote it to a custom `@utility` in `global.css`. A local `const BTN = "..."` in one file is marginally better than copy-paste — across files it's pure duplication with no single source of truth.

An `@utility` gives you one class name per callsite, one place to tune hover/active/focus, and participates in Tailwind's ordering/conflict resolution (unlike a JS string, which Tailwind's merger doesn't see). Rule: never name a class-string constant `BTN` or `CLS`; if you must extract one locally, suffix it `ClassName` and keep it file-local.

```tsx
// ❌ Wrong — same 6-class string copy-pasted across 7 files; and when
// someone does extract it, they name it something opaque.
const BTN = "selectable-button-accent-1 flex size-8 items-center justify-center rounded-md text-text-2";
<button className={BTN}>...</button>
// ...same string repeated in 6 other files
```

```css
/* ✅ Correct — shared utility in global.css */
@utility icon-ghost-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.375rem;
  color: var(--text-2);
  background-color: transparent;
  transition: background-color 150ms ease, color 150ms ease;
  outline: none;
  &:hover  { background-color: color-mix(in oklch, var(--muted) 50%, transparent); color: var(--text-1); }
  &:active { background-color: color-mix(in oklch, var(--muted) 70%, transparent); }
}
```

```tsx
// ✅ Callsite collapses to one class
<button type="button" aria-label="Close" className="icon-ghost-button"><XIcon size={16} /></button>
```

---

## Loading buttons: preserve width, put the spinner *inside*

When an action button is submitting, do not swap the label text (`"Create"` → `"Creating..."`) — the button resizes, the layout jumps, and the eye loses where it was. Keep the label mounted (just invisible), and overlay a spinner in the same centered position. Width is preserved because the label still takes space.

Use the shared `Button`'s `loading` prop instead of building this at every callsite:

```tsx
// ✅ Correct — width doesn't change, spinner is inside
<Button type="submit" loading={submit.status === "loading"}>
  Create
</Button>
```

```tsx
// ❌ Wrong — label swap causes a width jump on every submit
<Button type="submit" disabled={submit.status === "loading"}>
  {submit.status === "loading" ? "Creating..." : "Create"}
</Button>
```

Under the hood: the button stays `disabled` while loading (pointer events off, `aria-busy`), but its visual opacity stays at 100% so it still reads as "active, just working." The children are wrapped in an `invisible` span so they reserve space without painting, and a `CircleNotchIcon` is absolutely positioned on top.

---

## Never `window.confirm` / `window.alert` / `window.prompt` — use the custom modal

Browser-native dialogs look wrong in any themed app (system chrome, wrong typography, unfocusable, unstylable), are inaccessible via our testing tools, and break the design system. Use the custom modal instead.

For yes/no confirmation, call `useConfirm()` from `@/components/ui/modal` and `await` the returned promise:

```tsx
// ✅ Correct — custom themed dialog, animated, keyboard-navigable
import { useConfirm } from "@/components/ui/modal";

function DeleteButton({ id }: { id: string }) {
  const confirm = useConfirm();
  const handleDelete = async () => {
    const ok = await confirm({
      title: "Delete memory?",
      description: "This can't be undone.",
      confirmText: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    await deleteMemory(id);
  };
  return <button onClick={() => void handleDelete()}>Delete</button>;
}
```

```tsx
// ❌ Wrong — native dialog; breaks theme, inaccessible, cannot be styled
if (!window.confirm("Delete this memory? This can't be undone.")) return;
await deleteMemory(id);
```

For surfacing errors / info, use a toast (or a custom modal if the message truly needs modality). Never reach for `window.alert`.

`useConfirm()` requires the `<ModalProvider>` wrapping the app (already mounted in `main.tsx`).

---

## Don't wrap `api.fetch` with thin "rename" helpers

`api.fetch` is already typed and ergonomic. Wrapping it in a same-shape helper just to give it a nicer name buys nothing and costs a layer of indirection. Readers chase the wrapper, maintainers re-duplicate type annotations, and the actual endpoint gets hidden from the callsite.

A wrapper is worth it **only** when it does one of:

- Adds domain-level defaults that matter at every call (pagination, auth, etc.).
- Validates / narrows the response beyond what the route's return type gives.
- Combines multiple `api.fetch` calls into one logical operation.
- Provides caching / retry / deduplication.

If it doesn't, inline `api.fetch` at the callsite.

```typescript
// ❌ Wrong — pure rename, no value added
export async function listMemories(params?: { limit?: number; before?: string }): Promise<Memory[]> {
  return api.fetch("/api/memories", "GET", {
    query: { limit: params?.limit, before: params?.before },
  });
}
// ...
const data = await listMemories({ limit: 50, before: cursor });
```

```typescript
// ✅ Correct — callsite reads the URL and method directly
const data = await api.fetch("/api/memories", "GET", {
  query: { limit: 50, before: cursor },
});
```

---

## Extract clusters of useState / useEffect / useRef into named hooks

When a component grows a group of hooks that together implement one feature (resize, drag, keyboard focus trap, file upload, infinite scroll, …), move that group into a named custom hook. The component body should read top-to-bottom as: call hooks → compute a few values → return JSX. Anything more than trivial side-effect wiring belongs behind a hook name.

Signals that a cluster is ready to extract:

- Two or more of `useState` / `useEffect` / `useRef` / `useCallback` all touch the same feature and nothing else.
- The effect closes over the same state + set-function + refs.
- You'd have trouble naming the component's concern because it's actually doing two things (render the dialog *and* manage resize).
- The cluster is genuinely reusable (even once it's likely to move again).

```tsx
// ❌ Wrong — resize logic (ref + two effects + handler) bleeds into the
// component body. Reading the JSX requires paging past it.
function DialogShell({ memoryId, onClose }: Props) {
  const [fullScreen, setFullScreen] = useState(false);
  const [persistedWidth, setPersistedWidth] = useLocalStorageState(...);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!contentRef.current) return;
    contentRef.current.style.width = `${persistedWidth}px`;
  }, [persistedWidth]);

  useEffect(() => {
    const max = Math.floor(window.innerWidth * 0.8);
    if (persistedWidth > max) setPersistedWidth(max);
  }, [persistedWidth, setPersistedWidth]);

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    // 15 lines of mouse-tracking, cleanup, clamping, body.style.userSelect…
  }, [persistedWidth, setPersistedWidth]);

  return <Dialog.Content ref={contentRef} /* … */>{/* … */}</Dialog.Content>;
}
```

```tsx
// ✅ Correct — the feature is named; DialogShell just composes it.
function DialogShell({ memoryId, onClose }: Props) {
  const [fullScreen, setFullScreen] = useState(false);
  const { ref, onResizeStart } = useResizableWidth({
    storageKey: "memory-detail-width",
    defaultWidth: 560,
    minWidth: 400,
    maxRatio: 0.8,
  });

  return (
    <Dialog.Content ref={ref} /* … */>
      {!fullScreen && <ResizeHandle onMouseDown={onResizeStart} />}
      {/* … */}
    </Dialog.Content>
  );
}
```

This is the mirror of the 100-line component rule but one level down: even a small component can be "too tall" if half of its body is plumbing. If you wouldn't name it confidently, it's probably two components / one hook + one component.

---

## Never use `""` to mean "no value" — use `null`

Empty string is a legitimate value (a user cleared a text input, a field was explicitly blanked). `null` / `undefined` is the absence of a value. Conflating the two is a type lie: the signature claims "always a string," callers have to guess whether `""` means "really empty" or "missing," and bugs slip through truthiness checks and form state.

```typescript
// ✅ Correct — null signals absence, "" signals "empty string value"
function sourceLabel(source: { id: string } | null): string | null {
  return source?.id ?? null;
}

<input value={title ?? ""} onChange={(e) => setTitle(e.target.value || null)} />
```

```typescript
// ❌ Wrong — returning "" to mean "no source"
function sourceLabel(source: { id: string } | null): string {
  return source?.id ?? "";   // lies: missing ≠ empty string
}
```

Same rule applies to object fields, API request/response shapes, form state: if a field is optional, type it as `T | null` and use `null` — not `T` with `""` as a sentinel.

---

## Don't put `overflow-hidden` on overlay containers that host rich editors

Rich-text editors (BlockNote, Tiptap, any ProseMirror-based editor) render floating UI — slash menus, block-handle popovers, formatting toolbars — outside the editor's own bounds, often positioned relative to the viewport via portals or near the block's left margin. Putting `overflow-hidden` on the surrounding overlay container (`Dialog.Content`, sheet, popover) clips those floating surfaces.

Move the scroll boundary to an *inner* body. The outer overlay stays `overflow-visible` so floating editor UI can escape; the inner container handles vertical scroll.

```tsx
// ✅ Correct — no overflow on Dialog.Content; inner body owns scroll
<Dialog.Content className="fixed ... flex flex-col border-l">
  <Header />
  <div className="min-h-0 flex-1 overflow-auto">
    <BlockNoteView editor={editor} />  {/* slash menu + handles can extend outside */}
  </div>
</Dialog.Content>
```

```tsx
// ❌ Wrong — overflow-hidden clips the editor's portalled popovers
<Dialog.Content className="fixed ... flex flex-col overflow-hidden border-l">
  <Header />
  <div className="min-h-0 flex-1 overflow-auto">
    <BlockNoteView editor={editor} />  {/* slash menu gets cut at Dialog edge */}
  </div>
</Dialog.Content>
```

Same principle applies to any container wrapping a rich editor — don't clip the space where its hover UI needs to render.

---

## Restrict rich-editor schema to blocks the storage format can round-trip

When a rich editor's content is serialized to a lossy format (e.g. markdown can't represent toggle lists; no upload infrastructure means image/audio/video/file blocks vanish), restrict the editor's schema so only blocks that survive a save/load cycle are available. Otherwise the slash menu offers features that silently disappear on save — worst kind of data loss because it looks like it worked.

```tsx
// ✅ Correct — explicit allowlist; only blocks markdown can round-trip
import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";

const schema = BlockNoteSchema.create({
  blockSpecs: {
    paragraph: defaultBlockSpecs.paragraph,
    heading: defaultBlockSpecs.heading,
    bulletListItem: defaultBlockSpecs.bulletListItem,
    numberedListItem: defaultBlockSpecs.numberedListItem,
    checkListItem: defaultBlockSpecs.checkListItem,
    codeBlock: defaultBlockSpecs.codeBlock,
    quote: defaultBlockSpecs.quote,
    divider: defaultBlockSpecs.divider,
    table: defaultBlockSpecs.table,
  },
});
const editor = useCreateBlockNote({ schema });
```

```tsx
// ❌ Wrong — default schema includes toggleListItem, image, audio, video, file;
// they show up in the slash menu and vanish on the next save
const editor = useCreateBlockNote();
```

---

## Preserve empty paragraphs across markdown round-trip with a ZWSP marker

`blocksToMarkdown` → parser → `markdownToBlocks` collapses consecutive blank lines into a single paragraph break. Users who left intentional spacing see it vanish on reload — disruptive for any editor that treats empty blocks as visual whitespace.

Fix: before serializing, replace empty paragraph blocks with a paragraph containing a zero-width space (`\u200B`). Markdown preserves the ZWSP line; re-parse restores it as a visually-empty paragraph. On each subsequent serialize, strip stray ZWSPs from paragraphs that *also* contain real text — so if the user typed into a previously-placeholder block, the marker doesn't pollute their content.

```typescript
// ✅ Correct — ZWSP survives round-trip; cleanup handles mixed content
const ZWSP = "\u200B";

function preserveEmptyParagraphs(blocks: Block[]): Block[] {
  return blocks.map((b) => {
    if (b.type !== "paragraph" || !Array.isArray(b.content)) return b;
    const text = b.content.map((c) => c.type === "text" ? c.text : "").join("");
    if (text === "") {
      return { ...b, content: [{ type: "text", text: ZWSP, styles: {} }] };
    }
    if (text.includes(ZWSP)) {
      const cleaned = b.content
        .map((c) => c.type === "text" ? { ...c, text: c.text.replaceAll(ZWSP, "") } : c)
        .filter((c) => !(c.type === "text" && c.text === ""));
      return { ...b, content: cleaned };
    }
    return b;
  });
}

const md = editor.blocksToMarkdownLossy(preserveEmptyParagraphs(editor.document));
```

```typescript
// ❌ Wrong — raw serialization; every empty line vanishes on save/reload
const md = editor.blocksToMarkdownLossy();
```

---

## Tailwind v4 `@source` from `node_modules` is unreliable — add explicit CSS fallbacks

Tailwind v4's `@source "path/to/node_modules/..."` directive is supposed to scan and emit utilities referenced inside a third-party package. In practice, attribute-variant utilities (`aria-selected:bg-accent`, `data-state:…`) compiled into library classes sometimes don't get picked up. Visual state that depends on those utilities becomes invisible — attributes are set correctly, computed styles show transparent.

When integrating a third-party component library that ships Tailwind utilities, verify the state-dependent CSS is actually emitted. If not, add an explicit fallback in `global.css` keyed off the library's class + attribute.

```css
/* ✅ Correct — explicit fallback so @blocknote/shadcn's selected menu item is visible */
.bn-suggestion-menu-item[aria-selected="true"] {
  background-color: var(--muted);
  color: var(--text-1);
}
```

```css
/* ❌ Wrong — relies entirely on @source finding aria-selected:bg-accent
   inside node_modules; selected state silently invisible when it doesn't */
@source "../../node_modules/@blocknote/shadcn/dist";
/* no fallback — hope it works */
```

Symptom check: attribute-driven state (`aria-selected`, `data-state`, etc.) has no visible change despite the attribute being set. DOM inspector shows the utility class in the `className` but `getComputedStyle` returns the default/transparent value.

---

## `global.css` is for *shared* design tokens — don't add single-use palettes

A chart, badge family, or component that needs N visually distinct colors is not a reason to register `--chart-1`…`--chart-N` in `global.css`. Tokens in the global stylesheet are a shared contract — once they exist, any component can depend on them, and removing one breaks callers you don't know about. Adding tokens "for one chart" contaminates the namespace with things no design-system doc can explain.

Derive the palette *locally* by rotating hue off an existing accent token. One-off, scoped to the component's own file, no global fallout.

```ts
// ✅ Correct — colors derived from --accent-1 at the callsite, no globals
const USAGE_TYPE_KEYS = Object.keys(USAGE_TYPE_LABELS) as UsageKey[];
const HUE_STEP = 360 / USAGE_TYPE_KEYS.length;
export const USAGE_TYPE_COLOR = Object.fromEntries(
  USAGE_TYPE_KEYS.map((key, i) => [
    key,
    `oklch(from var(--accent-1) l c calc(h + ${i * HUE_STEP}))`,
  ]),
) as Record<UsageKey, string>;
```

```css
/* ❌ Wrong — nine categorical slots nobody else will ever use */
:root {
  --chart-1: oklch(0.64 0.17 45);
  --chart-2: oklch(0.70 0.16 55);
  /* ...through --chart-9 */
}
```

```css
/* ❌ Also wrong — hardcoded hex values at the callsite, off-brand and not theme-aware */
const USAGE_TYPE_COLOR = {
  "llm:input":  "#e97319",
  "llm:output": "#f97316",
  /* ... */
};
```

Threshold: a token belongs in `global.css` once **three unrelated components** need the same value. Until then, derive it where you use it.

---

## Use plain numbers (not `deg`) for hue offsets in `oklch()` relative-color syntax

In CSS's relative-color syntax `oklch(from <color> l c h)`, `h` is exposed as a `<number>` — not an `<angle>`. Adding `deg` to a hue offset reclassifies the expression as an angle, which doesn't match the expected number type; the browser treats the whole color as invalid and the element renders black / with a fallback. No warning, no error, just silently-wrong output.

This bit us on the Usage chart — every bar rendered black because `calc(h + ${i * 40}deg)` invalidated the `fill`.

```ts
// ✅ Correct — plain number, degrees implied
`oklch(from var(--accent-1) l c calc(h + ${i * 40}))`
```

```ts
// ❌ Wrong — `deg` invalidates the color; SVG fill falls back to black
`oklch(from var(--accent-1) l c calc(h + ${i * 40}deg))`
```

Same rule applies to the other relative-color numeric components: `l`, `c` in `oklch`/`oklab`, and the RGB channels in `rgb(from ...)`. They are numbers in the relative context — no units.

---

## Don't trust `File.type` for upload validation — sniff the actual bytes

The browser's `File.type` is derived from the file extension / OS metadata. Renaming `evil.html → pretend.mp3` gives you a File whose `type === "audio/mpeg"` even though the bytes are HTML. Using that value to gate an upload is a rubber-stamp, not a check.

Pass the file through a byte-level sniff (e.g. `fileTypeFromBlob` from the `file-type` package) before you call the presigned-URL endpoint. Reject anything whose sniffed MIME isn't in the allow-list — *then* send the sniffed MIME as the `contentType` body param. The backend zod enum rejects anything that sneaks past, but the frontend catches it earlier so the user sees a useful error instead of a generic 422.

```tsx
// ✅ Correct — sniff magic bytes, reject before presigning
import { fileTypeFromBlob } from "file-type";

const upload = useMutation(async (file: File) => {
  const sniffed = await fileTypeFromBlob(file);
  if (!sniffed || !isAudioMime(sniffed.mime)) {
    throw new Error(`Unsupported audio format${sniffed ? ` (${sniffed.mime})` : ""}.`);
  }
  const { url, key } = await api.fetch("/api/memories/:id/file-upload-url", "POST", {
    params: { id: memory.id },
    body: { type: "audio", contentType: sniffed.mime },
  });
  // …PUT, PATCH…
});
```

```tsx
// ❌ Wrong — File.type is spoofable; a renamed .html passes this check.
body: { type: "audio", contentType: file.type || "audio/mpeg" },
```

Also: `accept="audio/*"` on the `<input type="file">` is UX guidance, not security. Pair it with the bytes sniff.

---

## Every async user action needs a visible loading state — no exceptions

If a click triggers anything async — API call, OAuth redirect, file upload, form submission, navigation that awaits — the control must show a loading state until it resolves. **Every** kind: form submits, "Continue with Google" / OAuth buttons, icon-only buttons (trash, star, pin, copy), labeled CTAs, sidebar actions. Not "the important ones" — all of them.

Why this rule is absolute:
- Without feedback the user sees a dead-looking button after click and re-clicks. A second OAuth popup, a duplicate `POST`, a double-fired delete — every one of these is a real bug we've shipped.
- "It's fast in dev so I'll skip it" is exactly how the laggy-network case ships broken. Treat the loading state as part of the click handler, not as polish.
- The user asked to never have to ask for this again. Don't ship an async-triggered control without a loading state.

Mechanism — always `useMutation` + a visible "working" indicator + `disabled` on the trigger:

```tsx
// ✅ Correct — labeled button uses Button's loading prop
const submit = useMutation(async (values) => { /* signIn / api.fetch / ... */ }, []);

<Button type="submit" loading={submit.status === "loading"}>Log in</Button>
```

```tsx
// ✅ Correct — OAuth / external redirect: still wrap in useMutation + loading
const googleSignIn = useMutation(
  async () => { await signIn.social({ provider: "google", callbackURL: "/dashboard" }); },
  [],
);

<Button
  variant="secondary"
  loading={googleSignIn.status === "loading"}
  onClick={() => void googleSignIn.call()}
>
  Continue with Google
</Button>
```

```tsx
// ✅ Correct — icon-only button: swap icon + disable
const remove = useMutation(async () => { /* PATCH + DELETE */ }, [...]);

<button
  type="button"
  onClick={() => void remove.call()}
  disabled={remove.status === "loading"}
  className="ghost-button-error disabled:opacity-100"
>
  {remove.status === "loading"
    ? <CircleNotchIcon size={14} className="animate-spin" />
    : <TrashIcon size={14} />}
</button>
```

```tsx
// ❌ Wrong — bare async handler, no loading, double-click fires twice
<Button onClick={() => void signIn.social({ provider: "google", callbackURL: "/dashboard" })}>
  Continue with Google
</Button>

<button onClick={() => void remove()}>
  <TrashIcon size={14} />
</button>
```

Notes:
- The `Button` component's `loading` prop already handles `aria-busy`, `disabled`, spinner overlay, and width preservation. Use it; don't reimplement.
- For icon buttons, pair the icon swap with `disabled:opacity-100` so the button reads as "alive, working" instead of graying out.
- "But the redirect happens immediately so loading never shows" is fine — the cost of the prop is zero, and the slow path (popup-blocked, network stall, error) gets feedback for free.

---

## Don't lock a surface to one theme — use the tokens; both modes are already wired

When a section needs visual lift from the page (login card, callout, dialog, code block), it's tempting to "just" hardcode `bg-white` because you only thought about light mode. Don't. Every surface token (`--surface`, `--surface-secondary`, `--muted`, `--border`, `--text-1`, `--text-2`) already has both a light and a dark value — using them gives you both modes for free. We shipped this bug on `/login`: hardcoded `bg-white` plus per-element `style={{ color: "var(--forest)" }}` overrides looked fine in light mode and rendered cream-on-white invisible inputs in dark mode.

Two failure modes to avoid:

1. **Hardcode + per-element overrides.** Sets `bg-white`, then patches the heading and subtitle text colors inline, leaving `<Input>` / `<Button>` / `border-border` reading themed tokens that don't match the forced background. Looks fine in one mode, broken in the other.
2. **Fork the tokens locally.** Scope-override `--text-1` / `--muted` / `--border` on a wrapper to "fix" descendants. This duplicates the token system, drifts from global values the moment they change, and is exactly as much work as just rendering a theme-aware tree to begin with. **Don't introduce local CSS variables to compensate for a hardcoded color** — the global tokens already encode every value you'd want.

```tsx
// ✅ Correct — tokens flip per theme automatically; one tree, both modes
<div className="bg-surface text-text-1 border border-border ...">
  <h1>Log in</h1>
  <p className="text-text-2">Access your agents, skills, and memories.</p>
  <Input ... />          {/* var(--text-1) flips per theme */}
  <Button ... />         {/* border + muted + accent all theme-aware */}
</div>
```

```tsx
// ❌ Wrong — bg-white locks one mode; inline color overrides only patch the
// elements you remember; descendants like <Input> ship invisible in the other.
<div className="bg-white">
  <h1 style={{ color: "var(--forest)" }}>Log in</h1>
  <p style={{ color: "oklch(from var(--forest) 0.38 0.04 h)" }}>...</p>
  <Input ... />          {/* still reads themed --text-1 */}
</div>
```

```tsx
// ❌ Also wrong — local CSS-var overrides fork the token system.
const lightCardVars = {
  "--text-1": "...",
  "--muted": "...",
  "--border": "...",
} as React.CSSProperties;

<div className="bg-white" style={lightCardVars}>{/* ... */}</div>
```

If the design genuinely calls for a surface that looks the same in both modes (always-white card on always-dark backdrop), express it as **two theme-aware variants** — render with `useIsDark()` and pick the existing tokens that achieve the look in each mode. Don't build a new private palette.

---

## Frontend never talks to the DB — always through the backend API

`@supabase/supabase-js` (or any other DB client) is not a frontend dependency. Every data read goes through `api.fetch(...)` against a backend endpoint. Pair that with `useRepositoryQuery` / `useRepositoryListQuery` so the row caches in `RepositoryContext` and stays in sync via the MQTT `entity_update` stream.

Wrap by-id fetchers in `useCallback` (their closure depends on the id). List fetchers without external deps can be inline arrow functions.

No generic `useRepositorySupabaseQuery` helper — endpoints are purpose-built per-resource. If you find yourself wanting a generic "fetch any row by id" hook, write a backend endpoint instead.

```tsx
// ✅ Correct — by-id fetcher through backend
const { entity: memory } = useRepositoryQuery(
  "memories",
  { id },
  useCallback(
    async () => await api.fetch("/api/memories/:id", "GET", { params: { id } }),
    [id],
  ),
);

// ✅ Correct — list fetcher through backend
const { records } = useRepositoryListQuery(
  "memories",
  user.id,
  {
    filter: (m) => m.user_id === user.id,
    order: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  },
  async () => await api.fetch("/api/memories", "GET"),
);
```

```tsx
// ❌ Wrong — frontend query via Supabase client
const { supabase, user } = useRequiredAuth();
const { data } = await supabase
  .from("memories")
  .select()
  .eq("user_id", user.id)
  .order("created_at", { ascending: true });
```

---

## When you consume `usePaginatedQuery`, wire **all four** returned fields

`usePaginatedQuery` returns `{ records, status, hasMore, loadMore }`. Destructuring only `records` is a silent bug — the list renders the first page, looks complete, and stops there. No error, no warning, no console message; just a list that quietly caps at `PAGE_SIZE` items. The fact that data flows through the repository (so *new* items still arrive via realtime) makes the bug even harder to spot in dev where seed data is small.

Every consumer must:
1. Read `records` for the current items.
2. Read `status` to drive the **initial-load skeleton** (`status === "fetching" && records.length === 0`).
3. Read `hasMore` to render the load-more sentinel.
4. Wire `loadMore` to a sentinel via `useInfiniteScroll` (or a button) so older pages actually fetch.

```tsx
// ✅ Correct — all four wired up
const { records, status, hasMore, loadMore } = usePaginatedQuery(...);
const sentinelRef = useInfiniteScroll({ hasMore, loading: status === "fetching", onLoadMore: loadMore });

return (
  <>
    {records.length === 0 && status === "fetching" && <RowSkeletons />}
    {records.map(...)}
    {hasMore && <div ref={sentinelRef} className="h-1" />}
    {hasMore && status === "fetching" && <LoadMoreIndicator />}
  </>
);
```

```tsx
// ❌ Wrong — only first page ever loads; no skeleton, no spinner
const { records } = usePaginatedQuery(...);
return <>{records.map(...)}</>;
```

If you genuinely only need the first page (bounded set, like Skills' connected accounts), use `useRepositoryListQuery` instead — `usePaginatedQuery` without `loadMore` is a code smell that the wrong hook was picked.

---

## Initial-loading state needs a skeleton — never collide with the empty state

The pattern `if (records.length === 0) return <EmptyState/>` shows the "no items yet" message *during the initial fetch*, before any data has loaded. The user sees "No memories yet" while the request is in flight, then the list pops in. Confusing — looks like a bug, looks like data was deleted, looks like the screen is broken.

Every list screen must distinguish three states cleanly:

| Condition | Render |
|---|---|
| `records.length === 0 && status === "fetching"` | Row skeletons (mirror the real row layout) |
| `records.length === 0 && status !== "fetching"` | Empty state ("No items yet") |
| `records.length > 0` | Real rows + (if `hasMore`) sentinel + spinner |

```tsx
// ✅ Correct — skeleton during initial fetch, empty state only when truly empty
if (records.length === 0 && status === "fetching") return <RowSkeletons />;
if (records.length === 0) return <EmptyState />;
return <RealList />;
```

```tsx
// ❌ Wrong — "No items yet" shows during the initial fetch
if (records.length === 0) return <EmptyState />;
return <RealList />;
```

Render ~6 skeleton rows that mirror the real row's column widths (use `Skeleton` from `components/ui/skeleton.tsx`). Don't substitute "Loading…" text — it's smaller, doesn't reserve layout space, and the page jumps when real rows arrive.

---

## List screens: newest on top, older paginates toward the bottom

Default mental model for every list screen (memories, chat sessions, radars, radar events, etc.): the *newest* item is at the top of the screen, older items below it, and the user scrolls **down** to load older pages. Cursor is `before=<created_at>` (or `updated_at`) of the oldest item currently loaded; the next fetch returns items strictly older than that.

Sort: `(a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()` (descending). Pass to `usePaginatedQuery` with no `direction` (defaults to `"forward"` which appends pages toward the bottom).

**Exception: chat conversations.** Messages render chronologically (oldest top, newest bottom) because reading order matters — assistant replies have to come *after* the questions they answer. Use `direction: "backward"` so older pages prepend at the top, and put the load-more sentinel at the *top* of the scroll container, not the bottom.

```tsx
// ✅ Correct — list screen, newest first, older below
const { records } = usePaginatedQuery("memories", undefined, fetcher, {
  sort: (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
});
```

```tsx
// ✅ Correct — chat messages, chronological with backward pagination
const { records } = usePaginatedQuery("chat_session_messages", sessionId, fetcher, {
  sort: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  direction: "backward",
});
```

If you find yourself wanting newest-at-bottom for a *list* screen (not a conversation), stop and ask. The convention is shared so the user's mental model carries between screens.

---

## Never manually fix lint errors

Always run ESLint with `--fix`. Never hand-edit code to fix lint issues.

```bash
./packages/frontend/scripts/lint.ts --fix
```
